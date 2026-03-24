/**
 * Agent - Turn-scoped execution manager
 * 
 * Instantiated per-turn by Session.callAgent().
 * Manages model calls, tool execution, and turn-scoped state.
 * Instance is discarded after turn completes.
 */

import type { Session } from './session';
import type { SessionEvent, AgentConfig, AgentMetadata } from '../types';
import type { WorkflowContext } from './workflows/types';
import { callModel } from './models';
import { executeTools, getTurnEvents } from './tools';
import {
  generateModelCallBudgetInstructions,
  generateCallScopedStatus,
  generateIterationWarningInstructions,
  generateFinalCallInstructions,
} from './instructions-registry';
import { runAgentJobWorkflow } from './workflows/agent-job';

/**
 * Round metric to 2 decimal places
 */
function roundMetric(value: number | undefined): number | undefined {
  return value !== undefined ? Math.round(value * 100) / 100 : undefined;
}

/**
 * Deep merge metadata from source into target
 * - usage: overwrite with latest
 * - nativeTools: sum callsCount and concatenate arrays
 * - mcpTools: sum callsCount and totalExecutionTime
 * - call-scoped metrics: copy from source (per-call values)
 * - turn-scoped totals: aggregate by summing per-call values
 */
function aggregateMetadata(
  target: AgentMetadata,
  source: AgentMetadata,
  sourceEvent?: SessionEvent
): void {
  // Reset and copy call-scoped metrics (per-call, not cumulative)
  target.modelCallDuration = source.modelCallDuration ?? undefined;
  target.toolExecutionDuration = source.toolExecutionDuration ?? undefined;

  // Aggregate turn-scoped totals (sum per-call values, re-round to avoid floating-point drift)
  if (source.modelCallDuration !== undefined) {
    target.totalModelCallDuration = roundMetric((target.totalModelCallDuration || 0) + source.modelCallDuration);
  }
  if (source.toolExecutionDuration !== undefined) {
    target.totalToolsExecutionDuration = roundMetric((target.totalToolsExecutionDuration || 0) + source.toolExecutionDuration);
  }

  // Aggregate usage (overwrite with latest)
  if (source.usage) {
    target.usage = source.usage;
  }

  // Aggregate native tools metadata
  if (source.nativeTools) {
    if (!target.nativeTools) target.nativeTools = [];

    for (const sourceTool of source.nativeTools) {
      const existingTool = target.nativeTools.find(t => t.tool === sourceTool.tool);

      if (existingTool) {
        existingTool.callsCount += sourceTool.callsCount;

        // Deep merge tool-specific data
        const sourceData = sourceTool as any;
        const existingData = existingTool as any;

        for (const key of Object.keys(sourceData)) {
          if (key === 'tool' || key === 'callsCount') continue;

          if (Array.isArray(sourceData[key])) {
            if (!existingData[key]) existingData[key] = [];
            existingData[key].push(...sourceData[key]);
          } else if (typeof sourceData[key] === 'object' && sourceData[key] !== null) {
            if (!existingData[key]) existingData[key] = {};
            Object.assign(existingData[key], sourceData[key]);
          } else {
            existingData[key] = sourceData[key];
          }
        }
      } else {
        target.nativeTools.push({ ...sourceTool } as any);
      }
    }
  }

  // Aggregate MCP tools from event context (preferred)
  if (sourceEvent?.type === 'tool-result' && source.toolExecutionDuration !== undefined) {
    const { server, tool } = sourceEvent.data;

    if (!target.mcpTools) target.mcpTools = [];

    const existingTool = target.mcpTools.find(
      t => t.server === server && t.tool === tool
    );

    if (existingTool) {
      existingTool.callsCount += 1;
      existingTool.totalExecutionTime = roundMetric(existingTool.totalExecutionTime + source.toolExecutionDuration)!;
    } else {
      target.mcpTools.push({
        server,
        tool,
        callsCount: 1,
        totalExecutionTime: source.toolExecutionDuration
      });
    }
  }

  // Model calls count
  if (source.modelCallsCount) {
    target.modelCallsCount = source.modelCallsCount;
  }
}

/**
 * Agent class - manages a single agent turn
 */
export class Agent {
  // Turn-scoped state (lives for duration of turn only)
  private turnMetadata: AgentMetadata;
  private turnStartTime: number;
  private turnInstructions: string = '';
  private modelCallIndex: number = 0;

  constructor(
    private session: Session,
    private config: AgentConfig,
    private turnId: string,
    initialMetadata: AgentMetadata = {}
  ) {
    this.turnMetadata = initialMetadata;
    this.turnStartTime = performance.now() - (initialMetadata.agentTurnDuration || 0);
    this.modelCallIndex = initialMetadata.modelCallsCount ?? 0;
  }

  /**
   * Enrich raw event with aggregated metadata and context stamps
   * Aggregates metadata into turn totals and adds sequence/timestamp
   */
  private enrichEvent(
    rawEvent: Omit<SessionEvent, 'sequence' | 'timestamp'>,
    systemInstructions?: string
  ): SessionEvent {
    // Aggregate raw metadata into turn totals
    if ((rawEvent.data as any)?.metadata) {
      aggregateMetadata(this.turnMetadata, (rawEvent.data as any).metadata, rawEvent as SessionEvent);
    }

    // Update running turn duration
    this.turnMetadata.agentTurnDuration = roundMetric(performance.now() - this.turnStartTime);

    // Deep copy mcpTools/nativeTools to prevent mutation affecting stored events
    const metadata = {
      ...this.turnMetadata,
      mcpTools: this.turnMetadata.mcpTools?.map(t => ({ ...t })),
      nativeTools: this.turnMetadata.nativeTools?.map(t => ({ ...t })),
    };

    // Stamp event with sequence, timestamp, turnId, and context
    return {
      ...rawEvent,
      turnId: this.turnId,
      sequence: this.session.nextSequence(),
      timestamp: new Date(),
      data: {
        ...rawEvent.data,
        metadata,
        ...(this.session.getIsBackgroundMode() && { isBackground: true }),
        ...(this.session.getActiveJob() && { jobId: this.session.getActiveJob()!.jobId }),
        ...(rawEvent.role === 'agent' && systemInstructions && { systemInstructions })
      }
    } as SessionEvent;
  }

  /**
   * Run the agent - routes to workflows or default flow
   */
  async *run(signal?: AbortSignal): AsyncGenerator<SessionEvent> {
    // Check for active workflow
    const activeWorkflow = this.session.getActiveWorkflow();

    if (activeWorkflow?.type === 'agentJob') {
      // Delegate to agent job workflow
      yield* runAgentJobWorkflow(this.createWorkflowContext(signal), activeWorkflow.data as Parameters<typeof runAgentJobWorkflow>[1]);
      return;
    }

    // Default flow: run agent loop with enrichment and storing
    yield* this.runDefaultFlow(signal);
  }

  /**
   * Default agent flow - runs loop, enriches/stores events, finalizes turn
   */
  private async *runDefaultFlow(signal?: AbortSignal): AsyncGenerator<SessionEvent> {
    // Run agent loop with enrichment and storing
    for await (const rawEvent of this.runAgentLoop(signal)) {
      if (rawEvent.type === 'tool-effects') {
        const effects = (rawEvent.data as any).toolEffects;

        // Handle workflow activation request (silently ignored if not enabled)
        if (effects?.activateWorkflow) {
          const { type, data } = effects.activateWorkflow;
          if (this.isWorkflowEnabled(type)) {
            this.session.setActiveWorkflow({ type, data });
            yield* runAgentJobWorkflow(this.createWorkflowContext(signal), data as Parameters<typeof runAgentJobWorkflow>[1]);
            return;
          }
          // Workflow not enabled - silently continue without activation
        }
      }

      // Normal path: enrich, store, yield
      const enrichedEvent = this.enrichEvent(rawEvent);
      this.session.storeEvent(enrichedEvent);
      yield enrichedEvent;
    }

    // Finalize turn (no workflow triggered)
    yield* this.finalizeTurn();
  }

  /**
   * Check if a workflow is enabled in config
   */
  private isWorkflowEnabled(workflowId: string): boolean {
    return this.config.enableWorkflows &&
      (this.config.selectedWorkflows?.includes(workflowId) ?? false);
  }

  /**
   * Core agent loop - yields raw events (no enrichment/storing)
   * Used by default flow and workflows
   */
  async *runAgentLoop(signal?: AbortSignal): AsyncGenerator<SessionEvent> {
    // Check for pending tools from previous turn (resumption)
    for await (const event of this.executePendingTools()) {
      yield event;
    }

    while (this.modelCallIndex++ < this.config.maxModelCalls) {
      // Track model call count
      this.turnMetadata.modelCallsCount = this.modelCallIndex;

      // Prepare config with combined system instructions
      const modifiedConfig = this.modifySystemInstructions();

      // Filter events for ephemeral mode (send only from last user message)
      const eventsForModel = this.session.sessionOptions.ephemeral
        ? this.session.getEventsFromLastUserTurn()
        : this.session.getSessionEvents();

      for await (const rawEvent of callModel(eventsForModel, modifiedConfig, signal)) {
        yield rawEvent;
      }

      // Execute pending tools after model call
      let hasPendingToolResults = false;
      for await (const rawEvent of this.executePendingTools()) {
        yield rawEvent;

        if (rawEvent.type === 'tool-result') {
          hasPendingToolResults = true;
        }
      }

      if (!hasPendingToolResults) {
        break;
      }
    }
  }

  /**
   * Create workflow context with agent primitives
   */
  private createWorkflowContext(signal?: AbortSignal): WorkflowContext {
    return {
      runAgentLoop: (s?: AbortSignal) => this.runAgentLoop(s ?? signal),
      finalizeTurn: () => this.finalizeTurn(),
      enrichEvent: (event, sysInstr) => this.enrichEvent(event, sysInstr),
      storeEvent: (event) => this.session.storeEvent(event),
      session: this.session,
      config: this.config,
      turnMetadata: this.turnMetadata,
      turnId: this.turnId,
    };
  }

  /**
   * Execute pending tools from event history
   */
  private async *executePendingTools(): AsyncGenerator<SessionEvent> {
    const turnEvents = getTurnEvents(this.session.getSessionEvents());

    for await (const event of executeTools(
      turnEvents,
      this.config.availableTools || [],
      this.config.maxConcurrentTools || 5,
      this.turnId,
      this.config,
      this.turnMetadata
    )) {
      // Handle tool effects state updates
      if (event.type === 'tool-effects') {
        const effects = (event.data as any).toolEffects;

        if (effects.setBackgroundMode) {
          this.session.setIsBackgroundMode(effects.setBackgroundMode.active);
        }
        if (effects.setActiveJob) {
          this.session.setActiveJob(effects.setActiveJob.job);
        }
        if (effects.appendTurnInstructions) {
          this.appendTurnInstructions(effects.appendTurnInstructions);
        }

        // Stop if userActions present (wait for user feedback)
        if (effects.userActions) {
          yield event;
          return;
        }
      }

      yield event;
    }
  }

  /**
   * Modify agent config with combined system instructions
   */
  private modifySystemInstructions(): AgentConfig {
    const hasTools = this.config.enableTools &&
      this.config.availableTools &&
      this.config.availableTools.length > 0;

    // Initialize turn-scoped instructions on first call
    if (this.turnInstructions === '') {
      this.turnInstructions = hasTools
        ? generateModelCallBudgetInstructions(
          this.config.maxModelCalls,
          this.config.maxConcurrentTools,
          this.config.model
        )
        : '';
    }

    let modifiedConfig = this.config;
    const ephemeralParts: string[] = [];

    // Add call-scoped status
    if (hasTools) {
      ephemeralParts.push(
        generateCallScopedStatus(this.modelCallIndex, this.config.maxModelCalls)
      );
    }

    // Add ephemeral instructions for iteration limits
    const isFinalWarning = this.modelCallIndex === this.config.maxModelCalls - 1;
    const isFinalCall = this.modelCallIndex === this.config.maxModelCalls;

    if (isFinalWarning && hasTools) {
      ephemeralParts.push(
        generateIterationWarningInstructions(this.modelCallIndex, this.config.maxModelCalls)
      );
    }

    if (isFinalCall) {
      if (hasTools) {
        ephemeralParts.push(
          generateFinalCallInstructions(this.modelCallIndex, this.config.maxModelCalls)
        );
      }
      modifiedConfig = {
        ...this.config,
        enableTools: false,
        availableTools: [],
      };
    }

    const ephemeralSystemInstructions = ephemeralParts.filter(Boolean).join('\n\n');

    // Combine all instruction sources
    const combinedInstructions = [
      this.config.systemInstructions || '',
      this.turnInstructions,
      ephemeralSystemInstructions,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      ...modifiedConfig,
      systemInstructions: combinedInstructions,
    };
  }

  /**
   * Append instructions for this turn
   */
  private appendTurnInstructions(instructions: string): void {
    this.turnInstructions = this.turnInstructions
      ? `${this.turnInstructions}\n\n${instructions}`
      : instructions;
  }

  /**
   * Finalize the turn - emit agent-turn-completed event
   */
  private async *finalizeTurn(): AsyncGenerator<SessionEvent> {
    const lastEvent = this.session.getSessionEvents().findLast(e => e.role !== 'system');
    if (lastEvent?.type === 'user-turn-completed') {
      return;
    }
    const lastComponentId = lastEvent?.componentId;

    const agentTurnEventId = crypto.randomUUID();
    const rawAgentTurnEvent = {
      type: 'agent-turn-completed',
      eventId: agentTurnEventId,
      componentId: lastComponentId,
      role: 'agent',
      data: {},
    } as SessionEvent;

    this.session.clearChunkBuffer();

    const agentTurnEvent = this.enrichEvent(rawAgentTurnEvent);
    this.session.storeEvent(agentTurnEvent);
    yield agentTurnEvent;

    // Let session handle post-turn actions (title generation, etc.)
    this.session.onTurnCompleted();
  }
}
