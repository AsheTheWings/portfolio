/**
 * Approve Completion Utilities
 * Helpers for managing pending approvals within the Agent Job workflow
 */

import type { SessionEvent, Tool, AgentMetadata, AgentConfig } from '../../../types';

// ============================================================
// Types
// ============================================================

/** Approval data with tracking ID */
export interface ApprovalData {
  approvalId: string;
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
}

// ============================================================
// Approval Detection
// ============================================================

/**
 * Get all pending approval completions from turn events
 * Returns approvals that haven't been executed yet (tracked by approvalId)
 */
export function getPendingApprovals(turnEvents: SessionEvent[]): ApprovalData[] {
  const approvals = new Map<string, ApprovalData>();
  const executedIds = new Set<string>();
  
  for (const event of turnEvents) {
    // Collect approval requests from activateWorkflow effects
    if (event.type === 'tool-effects') {
      const workflow = (event.data as { toolEffects?: { activateWorkflow?: { type?: string; data?: { approvals?: unknown[] } } } })?.toolEffects?.activateWorkflow;
      if (workflow?.type === 'agentJob' && Array.isArray(workflow.data?.approvals)) {
        for (const approval of workflow.data.approvals as ApprovalData[]) {
          if (approval?.approvalId) {
            approvals.set(approval.approvalId, approval);
          }
        }
      }
    }
    // Collect executed approvals
    if (event.type === 'tool-result') {
      const executedId = (event.data as { result?: { executedApprovalId?: string } })?.result?.executedApprovalId;
      if (executedId) {
        executedIds.add(executedId);
      }
    }
  }
  
  // Return unexecuted approvals
  const pending: ApprovalData[] = [];
  for (const [id, approval] of approvals) {
    if (!executedIds.has(id)) {
      pending.push(approval);
    }
  }
  return pending;
}

// ============================================================
// Approval Execution
// ============================================================

// Import execution utilities from tools (avoid circular deps by importing at runtime)
import { executeSingleTool, buildToolResultEvent } from '../../tools';
import type { ToolCallEvent } from '../../../types';

/**
 * Create scoped metadata for approval execution
 */
function createScopedMetadata(): AgentMetadata {
  return {};
}

/**
 * Execute a single approval check
 * Creates synthetic tool-call and executes it
 * Pure async generator - yields raw events (no enrichment/storing)
 */
export async function* executeApprovalCheck(
  approval: ApprovalData,
  availableTools: Tool[],
  turnEvents: SessionEvent[],
  turnId?: string,
  agentConfig?: AgentConfig,
  turnMetadata?: AgentMetadata
): AsyncGenerator<SessionEvent> {
  const componentId = crypto.randomUUID();

  // Create synthetic tool-call event
  const toolCallEvent: ToolCallEvent = {
    type: 'tool-call',
    eventId: crypto.randomUUID(),
    componentId,
    turnId: turnId || crypto.randomUUID(),
    role: 'agent',
    sequence: 0,
    timestamp: new Date(),
    data: {
      server: approval.server,
      tool: approval.tool,
      arguments: {
        ...approval.arguments,
        _approvalId: approval.approvalId,
      },
      metadata: createScopedMetadata(),
    },
  };

  yield toolCallEvent;

  // Execute the approval tool
  try {
    const resultEvents = await executeSingleTool(
      toolCallEvent,
      availableTools,
      turnEvents,
      turnId,
      agentConfig,
      turnMetadata
    );
    if (Array.isArray(resultEvents)) {
      for (const event of resultEvents) {
        yield event;
      }
    } else {
      yield resultEvents;
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorEvents = buildToolResultEvent(toolCallEvent, null, errorMsg);
    if (Array.isArray(errorEvents)) {
      for (const event of errorEvents) {
        yield event;
      }
    } else {
      yield errorEvents;
    }
  }
}

/**
 * Check if an approval result indicates success (approved or cancelled)
 */
export function isApprovalSuccess(resultEvent: SessionEvent): boolean {
  const status = (resultEvent.data as { result?: { status?: string } })?.result?.status;
  return status === 'approved' || status === 'cancelled';
}
