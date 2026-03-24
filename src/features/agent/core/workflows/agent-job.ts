/**
 * Agent Job Workflow
 * 
 * Orchestrates agent behavior when working on jobs.
 * Controls turn completion based on job state.
 * Auto-deactivates when the job terminates (completed/cancelled).
 * 
 * Features:
 * - Peer review at task completion checkpoints with approval/rejection
 * - Structured output for reviewer decisions
 * - Task reversion on rejection with retry limits
 * - Continuous execution until job completes
 * 
 * Flow:
 * 1. Run agent loop normally, enriching and storing events
 * 2. On task completion, trigger peer review with structured output
 * 3. If approved: inject feedback into tool result
 * 4. If rejected: revert task status, alter tool result, agent retries
 * 5. When loop completes, check job status via jobs manager
 * 6. If job incomplete, continue agent loop
 * 7. If job complete/cancelled/not found, finalize turn
 */

import type { SessionEvent, AgentConfig } from '../../types';
import type { WorkflowContext } from './types';
import type { Job } from '../agent-jobs-manager';
import { getJobsManager } from '../sessions-manager';
import { getPendingToolCalls, getTurnEvents } from '../tools';
import { compactConversation, summarizeJobProgress } from './utils/compact-conversation';

interface AgentJobData {
  jobId?: string;
  /** Track review attempts per task to prevent infinite loops */
  taskReviewAttempts?: Map<string, number>;
}

// ============================================================
// Peer Review Types
// ============================================================

/**
 * Structured response from peer reviewer
 */
interface PeerReviewResult {
  approved: boolean;
  confidence: number;  // 0-1 scale
  feedback: string;
  issues?: string[];
}

/**
 * Max review attempts per task before force-approving
 */
const MAX_REVIEW_ATTEMPTS_PER_TASK = 10;

// ============================================================
// Task Completion Detection
// ============================================================

/**
 * Detect task completion from agent-job tool result
 * Returns task info if a task was completed, null otherwise
 * 
 * Detection logic:
 * - Server must be 'agent-job'
 * - Result must have 'completed' array with task IDs (T-xxx format)
 * - Result must have 'job' with task details
 */
function detectTaskCompletion(
  event: SessionEvent
): { taskId: string; taskTitle: string; jobId: string } | null {
  const data = event.data as { server?: string; result?: { completed?: string[]; job?: { id?: string; tasks?: { id: string; description: string }[] } } };
  const { server, result } = data;

  // Only agent-job manage tool
  if (server !== 'agent-job') return null;

  // Must have completed array with items
  if (!result?.completed || !Array.isArray(result.completed) || result.completed.length === 0) {
    return null;
  }

  // Check if any completed item is a task (T-xxx) not a subtask (S-xxx)
  const completedTaskId = result.completed.find((id: string) => id.startsWith('T-'));
  if (!completedTaskId) return null;

  // Must have job data
  if (!result.job?.id || !result.job?.tasks) return null;

  // Find the completed task to get its title
  const completedTask = result.job.tasks.find((t: { id: string; description: string }) => t.id === completedTaskId);
  if (!completedTask) return null;

  return {
    taskId: completedTaskId,
    taskTitle: completedTask.description,
    jobId: result.job.id,
  };
}

// ============================================================
// Peer Review System
// ============================================================

/**
 * JSON Schema for structured peer review response (Gemini format)
 */
const PEER_REVIEW_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    approved: {
      type: 'BOOLEAN',
      description: 'Whether the task completion should be approved. True if the work meets quality standards, false if it needs revision.',
    },
    confidence: {
      type: 'NUMBER',
      description: 'Confidence level in the decision, from 0.0 (no confidence) to 1.0 (fully confident).',
    },
    feedback: {
      type: 'STRING',
      description: 'Constructive feedback for the agent. If approved, suggestions for remaining tasks. If rejected, specific issues to address.',
    },
    issues: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'List of specific issues found (only if rejected). Each issue should be actionable.',
    },
  },
  required: ['approved', 'confidence', 'feedback'],
  propertyOrdering: ['approved', 'confidence', 'feedback', 'issues'],
};

/**
 * System instructions for the peer reviewer persona
 */
const PEER_REVIEWER_SYSTEM_INSTRUCTIONS = `You are a peer reviewer evaluating an AI agent's task completion.

## Your Role
Decide whether to APPROVE or REJECT the task completion based on quality standards.

## Approval Criteria
APPROVE if:
- The task objective was achieved
- The implementation is reasonable (doesn't need to be perfect)
- No critical bugs or security issues
- The approach is sound even if not optimal

REJECT if:
- The task objective was NOT achieved
- There are critical bugs or errors
- The implementation is fundamentally flawed
- Important requirements were missed

## Guidelines
- Be pragmatic, not perfectionist. Minor improvements can be noted in feedback without rejection.
- Focus on whether the task was COMPLETED, not whether it was done perfectly.
- If rejecting, provide specific, actionable issues the agent must fix.
- Confidence should reflect how certain you are (0.5 = uncertain, 1.0 = certain).

## Response Format
You MUST respond with valid JSON matching the schema. Do not include any text outside the JSON.`;

/**
 * Run peer review on the current conversation with structured output
 * Returns approval decision and feedback
 */
async function runPeerReview(
  sessionEvents: SessionEvent[],
  config: AgentConfig,
  taskInfo: { taskId: string; taskTitle: string; jobId: string },
  attemptCount: number
): Promise<PeerReviewResult> {
  console.log('[PeerReview] Starting review for task:', taskInfo.taskTitle, 'taskId:', taskInfo.taskId, 'attempt:', attemptCount);

  // Default result for failures (approve to avoid blocking)
  const defaultResult: PeerReviewResult = {
    approved: true,
    confidence: 0,
    feedback: '(Peer review unavailable - auto-approved)',
  };

  try {
    // Get job progress for context
    const jobsManager = getJobsManager();
    const job = jobsManager ? await jobsManager.getJob(taskInfo.jobId) : null;
    const jobProgress = summarizeJobProgress(job ?? undefined as unknown as Job);
    // Handle null job case gracefully
    if (!jobProgress) {
      console.log('[PeerReview] No job found for task:', taskInfo.jobId);
    }

    // Compact the conversation
    const compactedConversation = compactConversation(sessionEvents);
    console.log('[PeerReview] Compacted conversation length:', compactedConversation.length, 'chars');

    // Build the review request
    const userMessage = `## Task Completion Review

**Task:** "${taskInfo.taskTitle}"
**Review Attempt:** ${attemptCount} of ${MAX_REVIEW_ATTEMPTS_PER_TASK}

## Current Job Progress
${jobProgress}

## Conversation History
${compactedConversation}

---

Review the task completion and respond with your decision in JSON format.`;

    // Call model with reviewer persona and structured output
    console.log('[PeerReview] Calling model with structured output...');
    const response = await fetch('/api/agent/call-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionEvents: [{
          type: 'user-turn-completed',
          eventId: crypto.randomUUID(),
          componentId: crypto.randomUUID(),
          turnId: crypto.randomUUID(),
          role: 'user',
          sequence: 0,
          timestamp: new Date(),
          data: { message: userMessage, metadata: {} },
        }],
        agentConfig: {
          ...config,
          systemInstructions: PEER_REVIEWER_SYSTEM_INSTRUCTIONS,
          enableTools: false,
          availableTools: [],
          model: 'gemini-2.5-flash',
          stream: false,
          enableThinking: true,
          includeThoughtsInResponse: false,
          // Structured output config
          responseSchema: PEER_REVIEW_RESPONSE_SCHEMA,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      console.error('[PeerReview] API call failed:', await response.text());
      return defaultResult;
    }

    // Parse streaming response to extract message
    const reader = response.body?.getReader();
    if (!reader) return defaultResult;

    const decoder = new TextDecoder();
    let buffer = '';
    let reviewMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.data?.message) {
              reviewMessage = payload.data.message;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    // Log raw output from reviewer model
    console.log('[PeerReview] Raw model output:', reviewMessage);

    if (!reviewMessage) {
      console.error('[PeerReview] No response message');
      return defaultResult;
    }

    // Parse structured JSON response
    try {
      const result = JSON.parse(reviewMessage) as PeerReviewResult;

      // Validate required fields
      if (typeof result.approved !== 'boolean') {
        console.error('[PeerReview] Invalid response: missing approved field');
        return defaultResult;
      }

      // Normalize confidence to 0-1 range
      result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));
      result.feedback = result.feedback || '(No feedback provided)';

      console.log('[PeerReview] Review complete:', {
        approved: result.approved,
        confidence: result.confidence,
        issueCount: result.issues?.length || 0,
      });

      return result;
    } catch (parseError) {
      console.error('[PeerReview] Failed to parse JSON response:', parseError, 'Raw:', reviewMessage);
      return defaultResult;
    }
  } catch (error) {
    console.error('[PeerReview] Error:', error);
    return defaultResult;
  }
}

/**
 * Run agent job workflow
 * 
 * Continues running until job is complete or terminated,
 * then finalizes the turn.
 */
export async function* runAgentJobWorkflow(
  context: WorkflowContext,
  data: AgentJobData
): AsyncGenerator<SessionEvent> {
  const { session } = context;

  // Track review attempts per task (persisted across workflow iterations)
  const taskReviewAttempts = data.taskReviewAttempts || new Map<string, number>();

  // Run the agent loop, enriching and storing events
  for await (const rawEvent of context.runAgentLoop()) {
    let eventToProcess = rawEvent;

    // Handle tool effects
    if (rawEvent.type === 'tool-effects') {
      const effects = (rawEvent.data as { toolEffects?: { setBackgroundMode?: { active: boolean }; setActiveJob?: { job: { jobId: string; title: string } | null }; userActions?: unknown } }).toolEffects;

      // Update session state
      if (effects?.setBackgroundMode) {
        session.setIsBackgroundMode(effects.setBackgroundMode.active);
      }
      if (effects?.setActiveJob) {
        session.setActiveJob(effects.setActiveJob.job);
      }

      // If userActions present, store, yield, and stop
      if (effects?.userActions) {
        const enrichedEvent = context.enrichEvent(eventToProcess);
        context.storeEvent(enrichedEvent);
        yield enrichedEvent;
        return;
      }

      // Check if job terminated - auto-deactivate workflow
      if (effects?.setActiveJob?.job === null) {
        const enrichedEvent = context.enrichEvent(eventToProcess);
        context.storeEvent(enrichedEvent);
        yield enrichedEvent;
        session.setActiveWorkflow(null);
        yield* context.finalizeTurn();
        return;
      }
    }

    // Handle tool-result - detect task completion from agent-job manage tool
    if (rawEvent.type === 'tool-result') {
      const taskInfo = detectTaskCompletion(rawEvent);

      if (taskInfo) {
        // Get/increment review attempt count for this task
        const attemptCount = (taskReviewAttempts.get(taskInfo.taskId) || 0) + 1;
        taskReviewAttempts.set(taskInfo.taskId, attemptCount);

        console.log('[AgentJobWorkflow] Running peer review for task:', taskInfo.taskTitle, 'attempt:', attemptCount);

        // Run peer review with structured output
        const reviewResult = await runPeerReview(
          session.getSessionEvents(),
          context.config,
          taskInfo,
          attemptCount
        );

        // Check if we should force-approve (max attempts reached)
        const forceApprove = attemptCount >= MAX_REVIEW_ATTEMPTS_PER_TASK && !reviewResult.approved;

        if (forceApprove) {
          console.log('[AgentJobWorkflow] Max review attempts reached, force-approving task:', taskInfo.taskId);
          reviewResult.approved = true;
          reviewResult.feedback = `[Force-approved after ${attemptCount} attempts] ${reviewResult.feedback}`;
        }

        if (reviewResult.approved) {
          // APPROVED: Inject feedback into result so model sees it
          console.log('[AgentJobWorkflow] Task approved, confidence:', reviewResult.confidence);
          const approvedFeedback = formatApprovedFeedback(reviewResult);
          eventToProcess = {
            ...rawEvent,
            data: {
              ...rawEvent.data,
              result: {
                ...((rawEvent.data as { result?: Record<string, unknown> }).result || {}),
                peer_review: approvedFeedback,
              },
              peer_agent_feedback: approvedFeedback,
            },
          } as SessionEvent;
        } else {
          // REJECTED: Revert task status and alter tool result
          console.log('[AgentJobWorkflow] Task rejected, reverting status. Issues:', reviewResult.issues?.length || 0);

          // Revert task status in jobs manager
          const jobsManager = getJobsManager();
          let revertedJob = null;
          if (jobsManager) {
            revertedJob = await jobsManager.revertTaskStatus(taskInfo.jobId, taskInfo.taskId);
          }

          // Alter tool result to indicate rejection - include feedback in result
          const rejectedFeedback = formatRejectedFeedback(reviewResult);
          eventToProcess = {
            ...rawEvent,
            data: {
              ...rawEvent.data,
              result: {
                status: 'rejected',
                message: 'Task completion rejected by peer review. Please address the issues and try again.',
                peer_review: rejectedFeedback,
                originalResult: (rawEvent.data as { result?: unknown }).result,
              },
              peer_agent_feedback: rejectedFeedback,
            },
          } as SessionEvent;

          // Emit tool-effects event to update dashboard with reverted job state
          if (revertedJob) {
            const toolEffectsEvent = {
              type: 'tool-effects',
              eventId: crypto.randomUUID(),
              componentId: rawEvent.componentId,
              role: 'agent',
              data: {
                server: 'agent-job',
                tool: 'manage_job',
                toolEffects: {
                  sessionComponents: [{
                    id: `${taskInfo.jobId}-dashboard`,
                    role: 'agent' as const,
                    type: 'agent-job-dashboard' as const,
                    hideComponent: true,
                    data: {
                      job: revertedJob,
                      jobId: taskInfo.jobId,
                      isBackground: true,
                    },
                  }],
                },
              },
            } as unknown as SessionEvent;

            const enrichedEffectsEvent = context.enrichEvent(toolEffectsEvent);
            context.storeEvent(enrichedEffectsEvent);
            yield enrichedEffectsEvent;
          }
        }
      }
    }

    // Normal path: enrich, store, yield
    const enrichedEvent = context.enrichEvent(eventToProcess);
    context.storeEvent(enrichedEvent);
    yield enrichedEvent;
  }

  // Agent loop completed - check job status via jobs manager
  const activeJob = session.getActiveJob();
  if (!activeJob?.jobId) {
    // No active job - finalize turn
    session.setActiveWorkflow(null);
    yield* context.finalizeTurn();
    return;
  }

  // Check for pending tool calls (wait for them to complete first)
  const turnEvents = getTurnEvents(session.getSessionEvents());
  const pendingToolCalls = getPendingToolCalls(turnEvents);
  if (pendingToolCalls.length > 0) {
    // Tools still pending - finalize this turn, workflow continues next turn
    yield* context.finalizeTurn();
    return;
  }

  // Check job completion status via jobs manager
  const jobsManager = getJobsManager();
  if (!jobsManager) {
    // Jobs manager not available - finalize turn
    session.setActiveWorkflow(null);
    yield* context.finalizeTurn();
    return;
  }

  const completionResult = await jobsManager.checkJobCompletable(activeJob.jobId);

  if (completionResult.canComplete) {
    // Job complete or terminated - deactivate workflow and finalize
    session.setActiveWorkflow(null);
    yield* context.finalizeTurn();
    return;
  }

  // Job has incomplete tasks - continue workflow
  // Pass review attempts to next iteration to maintain retry counts
  yield* runAgentJobWorkflow(context, { ...data, taskReviewAttempts });
}

// ============================================================
// Feedback Formatting Helpers
// ============================================================

/**
 * Format approved review result for injection into tool result
 */
function formatApprovedFeedback(result: PeerReviewResult): string {
  const lines = [
    `✅ **Task Approved** (confidence: ${(result.confidence * 100).toFixed(0)}%)`,
    '',
    result.feedback,
  ];
  return lines.join('\n');
}

/**
 * Format rejected review result for injection into tool result
 */
function formatRejectedFeedback(result: PeerReviewResult): string {
  const lines = [
    `❌ **Task Rejected** (confidence: ${(result.confidence * 100).toFixed(0)}%)`,
    '',
    result.feedback,
  ];

  if (result.issues && result.issues.length > 0) {
    lines.push('', '**Issues to address:**');
    for (const issue of result.issues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines.join('\n');
}
