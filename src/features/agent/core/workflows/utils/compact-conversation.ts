/**
 * Compact Conversation Utilities
 * Transforms session events into condensed text format for review/analysis
 */

import type { SessionEvent } from '../../../types';
import type { Job, Task, Subtask } from '../../agent-jobs-manager';

/**
 * Event types to skip when compacting (internal/streaming events)
 */
const SKIP_EVENT_TYPES = new Set([
  'model-thought-chunk',
  'model-thought-completed',
  'model-message-chunk',
  'tool-effects',
  'agent-turn-completed',
  'user-turn-completed',
  'branch',
]);

/**
 * Compact session events into a readable conversation format
 * 
 * Format:
 *   [user]: message content
 *   [agent]: message content
 *   [tool-call]: server:tool_name {"arg": "value"}
 *   [tool-result]: server:tool_name → result summary
 * 
 * Skips:
 *   - Thinking/streaming events (model-thought-*, model-message-chunk)
 *   - System events (turn completions, tool-effects)
 * 
 * @param events - Session events to compact
 * @param maxLength - Maximum total character length (default: 50000)
 * @returns Compacted conversation string
 */
export function compactConversation(
  events: SessionEvent[],
  maxLength: number = 50000
): string {
  const lines: string[] = [];
  
  for (const event of events) {
    // Skip internal events
    if (SKIP_EVENT_TYPES.has(event.type)) {
      continue;
    }
    
    const line = formatEvent(event);
    if (line) {
      lines.push(line);
    }
  }
  
  let result = lines.join('\n\n');
  
  // Truncate if needed (from start, keeping recent context)
  if (result.length > maxLength) {
    const truncated = result.slice(-maxLength);
    const firstNewline = truncated.indexOf('\n\n');
    if (firstNewline > 0) {
      result = '[...earlier conversation truncated...]\n\n' + truncated.slice(firstNewline + 2);
    } else {
      result = '[...earlier conversation truncated...]\n\n' + truncated;
    }
  }
  
  return result;
}

/**
 * Format a single event into a readable line
 */
function formatEvent(event: SessionEvent): string | null {
  const data = event.data;
  
  switch (event.type) {
    case 'model-message-completed':
      return `[agent]: ${(data as { message?: string }).message || '(no message)'}`;
      
    case 'tool-call':
      const tcArgs = (data as { arguments?: Record<string, unknown> }).arguments ? JSON.stringify((data as { arguments?: Record<string, unknown> }).arguments) : '{}';
      // Truncate long arguments
      const truncatedArgs = tcArgs.length > 5000 
        ? tcArgs.slice(0, 5000) + '...(truncated)'
        : tcArgs;
      return `[tool-call]: ${(data as { server?: string }).server}:${(data as { tool?: string }).tool} ${truncatedArgs}`;
      
    case 'tool-result':
      const result = (data as { result?: { status?: string; message?: string } | string | unknown }).result;
      let resultSummary: string;
      
      if (result && typeof result === 'object' && (result as { status?: string }).status === 'error') {
        resultSummary = `error: ${(result as { message?: string }).message || 'unknown error'}`;
      } else if (typeof result === 'string') {
        resultSummary = result.length > 3000 ? result.slice(0, 3000) + '...' : result;
      } else if (result && typeof result === 'object') {
        const json = JSON.stringify(result);
        resultSummary = json.length > 3000 ? json.slice(0, 3000) + '...' : json;
      } else {
        resultSummary = String(result);
      }
      
      return `[tool-result]: ${(data as { server?: string }).server}:${(data as { tool?: string }).tool} → ${resultSummary}`;
      
    case 'user-feedback-result':
      return `[user-feedback]: ${JSON.stringify((data as { result?: unknown }).result)}`;
      
    default:
      // Handle user message (from user-turn-completed data if message present)
      if (event.role === 'user' && (data as { message?: string }).message) {
        return `[user]: ${(data as { message?: string }).message}`;
      }
      return null;
  }
}

/**
 * Get a summary of job progress for context
 */
export function summarizeJobProgress(job: Job): string {
  if (!job) return '';
  
  const totalTasks = job.tasks?.length || 0;
  const completedTasks = job.tasks?.filter((t: Task) => t.status === 'completed').length || 0;
  const inProgressTasks = job.tasks?.filter((t: Task) => t.status === 'in_progress').length || 0;
  
  const lines = [
    `Job: "${job.title}" (${job.status})`,
    `Progress: ${completedTasks}/${totalTasks} tasks complete, ${inProgressTasks} in progress`,
  ];
  
  // Add task summaries
  if (job.tasks) {
    lines.push('\nTasks:');
    for (const task of job.tasks) {
      const subtaskInfo = task.subtasks?.length > 0
        ? ` (${task.subtasks.filter((s: Subtask) => s.status === 'completed').length}/${task.subtasks.length} subtasks)`
        : '';
      lines.push(`  [${task.status}] ${task.description}${subtaskInfo}`);
    }
  }
  
  return lines.join('\n');
}
