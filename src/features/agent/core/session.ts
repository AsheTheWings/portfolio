/**
 * Session - Single session lifecycle manager
 */

import { mutate } from 'swr';
import type {
  SessionMetadata,
  AgentConfig,
  SessionEvent,
  AgentMetadata,
  ToolCallData,
} from '../types';
import type { ActiveWorkflow } from './workflows/types';
import { getPendingToolCalls, getTurnEvents } from './tools';
import { Agent } from './agent';

/**
 * Session Options
 */
export interface SessionOptions {
  persist: boolean;    // Save events to database? (Events always stored in memory)
  ephemeral: boolean;  // Send only last user message to model?
}

/**
 * Session - Event-sourcing conversation manager
 */
export class Session {
  private sessionMetadata: SessionMetadata;
  private options: SessionOptions;
  
  // Event-sourcing source of truth
  private sessionEvents: SessionEvent[] = [];
  private eventSequence: number = 0;
  
  
  // Persistence tracking
  private lastPersistPromise: Promise<void> | undefined;
  
  // Current turn ID (set in setUserTurn, used for event stamping)
  private currentTurnId: string = '';
  
  // Background mode (stamps events with isBackground: true when active)
  private isBackgroundMode: boolean = false;
  
  // Active job context (stamps events with jobId when set)
  private activeJob: { jobId: string; title: string } | null = null;
  
  // Active workflow (controls agent loop behavior)
  private activeWorkflow: ActiveWorkflow | null = null;
  
  // Buffer for streaming events (not persisted)
  private chunkBuffer: SessionEvent[] = [];

  // Persistence locking
  private isPersisting: boolean = false;
  private pendingPersist: boolean = false;

  // Event types that are streaming chunks (excluded from persistence)
  private chunkTypes: SessionEvent['type'][] = ['model-thought-chunk', 'model-message-chunk'];

  constructor(
    sessionMetadata: SessionMetadata,
    options: SessionOptions = { persist: true, ephemeral: false }
  ) {
    this.sessionMetadata = sessionMetadata;
    this.options = options;
  }

  // ============================================================
  // Getters
  // ============================================================

  get metadata(): SessionMetadata {
    return this.sessionMetadata;
  }

  get sessionOptions(): SessionOptions {
    return this.options;
  }

  // ============================================================
  // Agent Module Accessors (for Agent class)
  // ============================================================

  getSessionEvents(): SessionEvent[] {
    return this.sessionEvents;
  }

  getIsBackgroundMode(): boolean {
    return this.isBackgroundMode;
  }

  setIsBackgroundMode(active: boolean): void {
    this.isBackgroundMode = active;
  }

  getActiveJob(): { jobId: string; title: string } | null {
    return this.activeJob;
  }

  setActiveJob(job: { jobId: string; title: string } | null): void {
    this.activeJob = job;
  }

  getActiveWorkflow(): ActiveWorkflow | null {
    return this.activeWorkflow;
  }

  setActiveWorkflow(workflow: ActiveWorkflow | null): void {
    this.activeWorkflow = workflow;
  }

  nextSequence(): number {
    return this.eventSequence++;
  }

  clearChunkBuffer(): void {
    this.chunkBuffer = [];
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * Set user turn (records user input, prepares for agent loop)
   * Finalizes any incomplete agent turn before creating new user turn
   * Creates a new user-turn-completed event and stores it
   * Config is captured in the event for event-sourced execution
   */
  async *setUserTurn(userMessage: string, config: AgentConfig, libraryItemIds?: string[]): AsyncGenerator<SessionEvent> {
    if (!this.sessionMetadata?.sessionId) {
      return;
    }

    // Finalize incomplete agent turn before accepting new user input
    for await (const event of this.finalizeAgentTurn()) {
      yield event;
    }

    // Generate new turn ID for this user turn and all subsequent agent events
    this.currentTurnId = crypto.randomUUID();

    // Create user-turn-completed event
    const userTurnEventId = crypto.randomUUID();
    const userTurnEvent: SessionEvent = {
      type: 'user-turn-completed',
      eventId: userTurnEventId,
      componentId: userTurnEventId,
      turnId: this.currentTurnId,
      role: 'user',
      sequence: this.eventSequence++,
      timestamp: new Date(),
      data: {
        message: userMessage,
        agentConfig: config,
        libraryItemIds: libraryItemIds && libraryItemIds.length > 0 ? libraryItemIds : undefined,
        metadata: {}
      },
    };

    this.storeEvent(userTurnEvent);
    
    yield userTurnEvent;
  }

  /**
   * Check if the last agent turn is completed
   * Returns true if last event is agent-turn-completed or if no agent events exist
   */
  isAgentTurnCompleted(): boolean {
    // If buffer has content, agent turn is incomplete
    if (this.chunkBuffer.length > 0) return false;

    const events = this.sessionEvents;
    if (!events.length) return true;

    // Find last AGENT event
    const lastAgentEvent = events.findLast(e => e.role === 'agent');
    
    // If no agent event ever happened, it's complete (new session)
    if (!lastAgentEvent) return true;
    
    // Check if that agent event was a completion event
    return lastAgentEvent.type === 'agent-turn-completed';
  }

  /**
   * Finalize incomplete agent turn
   * Handles interrupted sessions by completing dangling events
   * - Completes chunk events (model-message-chunk, model-thought-chunk)
   * - Adds error results for pending tool-calls
   * - Emits agent-turn-completed event
   */
  async *finalizeAgentTurn(): AsyncGenerator<SessionEvent> {
    const events = this.sessionEvents;
    // Nothing to finalize if Agent Turn is completed
    if (this.isAgentTurnCompleted()) {
      return;
    }

    // Find last incomplete agent event
    const lastAgentEvent = events.findLast(e => e.role === 'agent');
    
    if (!lastAgentEvent) {
      return; // No incomplete agent events to finalize
    }
    
    // Extract metadata and turnId from last event (no aggregation needed)
    const metadata = (lastAgentEvent?.data as { metadata?: AgentMetadata })?.metadata
      ? { ...(lastAgentEvent.data as { metadata: AgentMetadata }).metadata }
      : {};
    const turnId = lastAgentEvent.turnId || this.currentTurnId;
    
    // Helper to stamp finalization events
    const stamp = (rawEvent: SessionEvent): SessionEvent => ({
      ...rawEvent,
      turnId,
      sequence: this.eventSequence++,
      timestamp: new Date(),
      data: { 
        ...rawEvent.data, 
        metadata,
        ...(this.isBackgroundMode && { isBackground: true }),
        ...(this.activeJob && { jobId: this.activeJob.jobId }),
      }
    } as SessionEvent);
    
    // Handle incomplete streaming - check buffer for pending chunks
    if (this.chunkBuffer.length) {
      const lastChunk = this.chunkBuffer[this.chunkBuffer.length - 1];
      const componentId = lastChunk.componentId;
      const isMessage = lastChunk.type === 'model-message-chunk';
      const chunkType = isMessage ? 'model-message-chunk' : 'model-thought-chunk';
      const completionType = isMessage ? 'model-message-completed' : 'model-thought-completed';
      const dataKey = isMessage ? 'message' : 'thoughts';
      
      // Accumulate chunks from buffer
      const accumulated = this.chunkBuffer
        .filter(e => e.type === chunkType && e.componentId === componentId)
        .map(e => ((e.data as unknown) as Record<string, unknown>)[dataKey] || '')
        .join('');
      
      const completionEvent = stamp({
        type: completionType,
        eventId: crypto.randomUUID(),
        componentId,
        role: 'agent',
        data: isMessage 
          ? { message: accumulated }
          : { thoughts: accumulated },
      } as SessionEvent);
      
      this.storeEvent(completionEvent);
      yield completionEvent;
    }
    
    // Handle pending tool-calls - add interruption error results
    const turnEvents = getTurnEvents(this.sessionEvents);
    const pendingToolCalls = getPendingToolCalls(turnEvents);
    
    for (const toolCall of pendingToolCalls) {
      const errorResultEvent = stamp({
        type: 'tool-result',
        eventId: crypto.randomUUID(),
        componentId: toolCall.componentId,
        role: 'agent',
        data: {
          server: toolCall.data.server,
          tool: toolCall.data.tool,
          arguments: toolCall.data.arguments || {},
          result: { status: 'error', message: 'Tool execution was interrupted' },
        },
      } as unknown as SessionEvent);
      
      this.storeEvent(errorResultEvent);
      yield errorResultEvent;
    }
    
    // Build agent-turn-completed event
    const lastComponentId = this.sessionEvents.findLast(e => 
      e.type === 'model-thought-completed' || e.type === 'model-message-completed' || e.type === 'tool-call'
    )?.componentId;
    
    const agentTurnEventId = crypto.randomUUID();
    const agentTurnEvent = stamp({
      type: 'agent-turn-completed',
      eventId: agentTurnEventId,
      componentId: lastComponentId || agentTurnEventId,
      role: 'agent',
      data: {},
    } as SessionEvent);
    
    this.storeEvent(agentTurnEvent);
    yield agentTurnEvent;
  }

  /**
   * Recover session state from tool-effects event history
   * Scans in reverse to find latest setBackgroundMode and setActiveJob
   * Stops early once both are found
   */
  private recoverSessionStateFromHistory(): void {
    let foundBackground = false;
    let foundActiveJob = false;

    // Scan events in reverse (newest first)
    for (let i = this.sessionEvents.length - 1; i >= 0; i--) {
      const event = this.sessionEvents[i];
      
      if (event.type !== 'tool-effects') continue;
      
      const toolEffects = (event.data as { toolEffects?: { setBackgroundMode?: { active: boolean }; setActiveJob?: { job: { jobId: string; title: string } | null } } })?.toolEffects;
      if (!toolEffects) continue;

      // Recover background mode
      if (!foundBackground && toolEffects.setBackgroundMode !== undefined) {
        this.isBackgroundMode = toolEffects.setBackgroundMode.active;
        foundBackground = true;
      }

      // Recover active job
      if (!foundActiveJob && toolEffects.setActiveJob !== undefined) {
        this.activeJob = toolEffects.setActiveJob.job;
        foundActiveJob = true;
      }

      // Early exit once both found
      if (foundBackground && foundActiveJob) break;
    }
  }

  /**
   * Call agent (runs agent loop from current state)
   * Validates session state and instantiates Agent for execution
   */
  async *callAgent(signal?: AbortSignal): AsyncGenerator<SessionEvent> {
    if (!this.sessionMetadata.sessionId) {
      return;
    }

    const events = this.sessionEvents;
    const firstNonSystemEvent = events.find(e => e.role !== 'system');
    const lastNonSystemEvent = events.findLast(e => e.role !== 'system');

    // First event must be 'user-turn-completed'
    if (!firstNonSystemEvent || firstNonSystemEvent.type !== 'user-turn-completed') {
      console.warn('Invalid session state: first event must be user-turn-completed');
      return;
    }
    
    // Agent turn already completed
    if (lastNonSystemEvent!.type === 'agent-turn-completed') {
      console.warn('Agent turn already completed');
      return;
    }
    
    // Retrieve config from last user-turn-completed event
    const lastUserTurnEvent = events.findLast(e => e.type === 'user-turn-completed');
    const config = (lastUserTurnEvent?.data as { agentConfig?: AgentConfig })?.agentConfig;
    
    if (!config) {
      console.warn('Invalid session state: no agent config found');
      return;
    }

    // Restore turnId from last user turn (for resumption scenarios)
    this.currentTurnId = lastUserTurnEvent?.turnId || this.currentTurnId;

    // Recover background mode and active job from history
    this.recoverSessionStateFromHistory();

    // Restore metadata from last event (for resumption scenarios)
    const initialMetadata = lastNonSystemEvent && (lastNonSystemEvent.data as { metadata?: AgentMetadata })?.metadata
      ? { ...(lastNonSystemEvent.data as { metadata: AgentMetadata }).metadata }
      : {};

    // Instantiate Agent for this turn and run
    const agent = new Agent(this, config, this.currentTurnId, initialMetadata);
    yield* agent.run(signal);
  }

  /**
   * Get session metadata
   */
  getMetadata(): SessionMetadata {
    return this.sessionMetadata;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | undefined {
    return this.sessionMetadata.sessionId;
  }

  /**
   * Add user feedback result event
   * Creates user-feedback-result event linked to tool-call via componentId
   */
  addUserFeedbackResult(componentId: string, result: unknown): SessionEvent {
    // Derive modelCallIndex and tool info from tool-call event
    const events = this.sessionEvents;
    let server = '';
    let tool = '';
    
    // Find the tool-call event with matching componentId
    const toolCallEvent = events.find(
      e => e.type === 'tool-call' && e.componentId === componentId
    ) as Extract<SessionEvent, { type: 'tool-call' }> | undefined;
    
    let arguments_: Record<string, unknown> = {};
    let turnId = this.currentTurnId;
    
    if (toolCallEvent) {
      server = toolCallEvent.data.server;
      tool = toolCallEvent.data.tool;
      arguments_ = toolCallEvent.data.arguments ?? {};
      turnId = toolCallEvent.turnId;
    } else {
      console.warn(`⚠️ Tool-call event not found for feedback componentId: ${componentId}`);
    }
    
    // Get metadata snapshot from tool-effects event (same componentId)
    const toolEffectsEvent = events.find(
      e => e.type === 'tool-effects' && e.componentId === componentId
    );
    const metadata = toolEffectsEvent && (toolEffectsEvent.data as { metadata?: AgentMetadata }).metadata
      ? { ...(toolEffectsEvent.data as { metadata: AgentMetadata }).metadata }
      : {};
    
    const feedbackResultEvent: SessionEvent = {
      type: 'user-feedback-result',
      eventId: crypto.randomUUID(),
      componentId,
      turnId,
      role: 'user',
      sequence: this.eventSequence++,
      timestamp: new Date(),
      data: {
        server,
        tool,
        arguments: arguments_,
        result,
        metadata,
      },
    };
    
    // storeEvent handles both memory storage and persistence
    this.storeEvent(feedbackResultEvent);
    
    return feedbackResultEvent;
  }

  /**
   * Emit a system-initiated tool call event
   * Used for user-triggered actions like job cancellation
   * The tool will be executed when the agent loop resumes
   * 
   * @param toolCall - Tool call specification (server, tool, arguments)
   * @returns The created tool-call event
   */
  emitSystemToolCall(toolCall: {
    server: string;
    tool: string;
    arguments: Record<string, unknown>;
  }): SessionEvent {
    // Get metadata from last event if available
    const lastEvent = this.sessionEvents.findLast(() => true);
    const metadata = lastEvent && (lastEvent.data as { metadata?: AgentMetadata }).metadata
      ? { ...(lastEvent.data as { metadata: AgentMetadata }).metadata }
      : {};

    const componentId = crypto.randomUUID();
    const toolCallEvent: SessionEvent = {
      type: 'tool-call',
      eventId: crypto.randomUUID(),
      componentId,
      turnId: this.currentTurnId,
      role: 'agent', // Tool calls are agent-role even when system-initiated
      sequence: this.eventSequence++,
      timestamp: new Date(),
      data: {
        server: toolCall.server,
        tool: toolCall.tool,
        arguments: toolCall.arguments,
        metadata,
        systemInitiated: true, // Mark as system-initiated for traceability
      } as ToolCallData,
    };

    this.storeEvent(toolCallEvent);
    return toolCallEvent;
  }

  /**
   * Get turn count (user + agent completed turns)
   */
  getTurnCount(): number {
    return this.sessionEvents.filter(e => 
      e.type === 'user-turn-completed' || e.type === 'agent-turn-completed'
    ).length;
  }

  /**
   * Called when agent turn completes
   * Handles session-level post-turn actions (title generation, etc.)
   */
  onTurnCompleted(): void {
    // Auto-generate title every 10 turns (2, 12, 22...)
    const turnsCount = this.getTurnCount();
    if (turnsCount % 10 === 2 && !this.sessionMetadata.titleLocked) {
      this.generateTitleInBackground().catch((err: unknown) => 
        console.warn('⚠️ Title generation failed:', err)
      );
    }
  }

  /**
   * Checkpoint - Wait for last persistence to complete
   */
  async checkpoint(): Promise<{ success: boolean; error?: string }> {
    if (!this.lastPersistPromise) {
      return { success: true };
    }

    try {
      await this.lastPersistPromise;
      return { success: true };
    } catch (err: unknown) {
      console.warn('[Session] checkpoint:failed', { error: err instanceof Error ? err.message : String(err) });
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      this.lastPersistPromise = undefined;
    }
  }

  /**
   * Update session metadata
   */
  updateSessionMetadata(metadata: SessionMetadata): void {
    this.sessionMetadata = metadata;
  }


  /**
   * Update session options
   */
  updateOptions(options: Partial<SessionOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Load events (for session resumption)
   */
  loadEvents(events: SessionEvent[]): void {
    this.sessionEvents = events;
    
    // Set sequence counter to max + 1
    const maxSequence = Math.max(...events.map(e => e.sequence), -1);
    this.eventSequence = maxSequence + 1;
  }

  /**
   * Clear events (for new session)
   */
  clearEvents(): void {
    this.sessionEvents = [];
    this.eventSequence = 0;
  }

  /**
   * Get events (defensive copy)
   */
  getEvents(): SessionEvent[] {
    return [...this.sessionEvents];
  }

  /**
   * Check if there's buffered streaming content (incomplete agent response)
   */
  hasBufferedContent(): boolean {
    return this.chunkBuffer.length > 0;
  }

  /**
   * Get events from last user turn (for ephemeral mode)
   * Returns all events starting from the last user-turn-completed
   */
  getEventsFromLastUserTurn(): SessionEvent[] {
    const lastUserTurnIndex = this.sessionEvents.findLastIndex(
      e => e.type === 'user-turn-completed'
    );
    
    if (lastUserTurnIndex === -1) {
      return this.sessionEvents; // Fallback to all events
    }
    
    return this.sessionEvents.slice(lastUserTurnIndex);
  }

  /**
   * Add branch event (called after successful branch creation)
   */
  addBranchEvent(componentId: string, relatedSessionId: string, isParent: boolean = false): void {
    // Get metadata and turnId from last event
    const lastEvent = this.sessionEvents[this.sessionEvents.length - 1];
    const eventMetadata = lastEvent && (lastEvent.data as { metadata?: AgentMetadata }).metadata
      ? { ...(lastEvent.data as { metadata: AgentMetadata }).metadata }
      : {};
    const turnId = lastEvent?.turnId || this.currentTurnId;
    
    const branchEvent: SessionEvent = {
      type: 'branch',
      eventId: crypto.randomUUID(),
      componentId,
      turnId,
      role: 'system',
      sequence: this.eventSequence++,
      timestamp: new Date(),
      data: {
        ...(isParent ? { parentSessionId: relatedSessionId } : { branchSessionId: relatedSessionId }),
        metadata: eventMetadata,
      },
    };

    this.storeEvent(branchEvent);
  }


  /**
   * Generate title in background (non-blocking)
   */
  async generateTitleInBackground(): Promise<void> {
    try {
      const context = this.gatherRecentTurns(10);
      if (!context) return;
      
      const title = await this.callModelForTitle(context);
      
      if (title) {
        // Update in-memory metadata
        this.sessionMetadata = { ...this.sessionMetadata, title };
        
        // Update in database if persist enabled
        if (this.options.persist && this.sessionMetadata.sessionId) {
          await this.updateTitleInDB(title);
        }
        
      }
    } catch (err: unknown) {
      console.warn('⚠️ Title generation failed:', err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Gather recent turn messages for title context
   */
  private gatherRecentTurns(count: number): string {
    const turnEvents = this.sessionEvents
      .filter(e => e.type === 'user-turn-completed' || e.type === 'agent-turn-completed')
      .slice(-count);
    
    if (turnEvents.length === 0) return '';
    
    return turnEvents.map(e => {
      const role = e.type === 'user-turn-completed' ? 'User' : 'Assistant';
      const message = ((e.data as { message?: string }).message) || '';
      return `${role}: ${message}`;
    }).join('\n\n');
  }

  /**
   * Call model to generate title from context
   */
  private async callModelForTitle(context: string): Promise<string | undefined> {
    try {
      const response = await fetch('/api/agent/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });
      
      if (!response.ok) return undefined;
      
      const { title } = await response.json();
      return title;
    } catch (err) {
      return undefined;
    }
  }

  /**
   * Update title in database and trigger SWR revalidation
   */
  private async updateTitleInDB(title: string): Promise<void> {
    try {
      const response = await fetch(`/api/agent/sessions/${this.sessionMetadata.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update title in database');
      }
      
      // Trigger immediate SWR cache revalidation for instant UI update
      mutate('/api/agent/sessions?limit=100');
    } catch (err: unknown) {
      console.error('❌ Failed to persist title:', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  // ============================================================
  // Persistence
  // ============================================================

  /**
   * Store an event: routes to buffer or session history based on type
   * Chunk events go to buffer (streaming only)
   * Completion events go to session history and are persisted
   */
  storeEvent(event: SessionEvent): void {
    // Route chunk events to buffer (streaming only, not persisted)
    if (this.chunkTypes.includes(event.type as SessionEvent['type'])) {
      this.chunkBuffer.push(event);
      return;
    }
    
    this.chunkBuffer = [];

    // Store completion events in session history
    this.sessionEvents.push(event);

    // Persist to database (conditionally)
    if (this.options.persist) {
      this.persistEvents();
    }
  }

  /**
   * Persist events to server (upsert full array)
   * uses conflated queue pattern:
   * - If saving, mark pending
   * - If not saving, save immediately
   * - When save finishes, if pending, save again (with latest state)
   */
  private persistEvents(): void {
    if (this.sessionEvents.length === 0) return;
    
    // If already persisting, mark as pending and return (conflation)
    if (this.isPersisting) {
      this.pendingPersist = true;
      return;
    }

    this.isPersisting = true;
    this.pendingPersist = false;

    const eventsToSend = this.sessionEvents.map(event => ({
      componentId: event.componentId,
      event,
    }));
    
    this.lastPersistPromise = fetch(
      `/api/agent/sessions/${this.sessionMetadata.sessionId}/events`, 
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend }),
      }
    )
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(error.error || `Persistence failed: ${res.status}`);
        }
      })
      .catch(err => {
        // Re-throw for checkpoint() to catch
        throw err;
      })
      .finally(() => {
        this.isPersisting = false;
        
        // If another change happened while we were saving, trigger again immediately
        if (this.pendingPersist) {
          // Recursively call self to save latest state
          // Note: lastPersistPromise will be overwritten with new promise
          this.persistEvents();
        }
      });
  }
  
}
