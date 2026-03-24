/**
 * Instructions Registry
 * Centralized location for predefined system instructions
 * Used to construct turn-scoped and ephemeral instructions
 */

/**
 * Generate turn-scoped instructions explaining agent architecture and budget
 * Initialized at the start of each agent turn
 */
export function generateModelCallBudgetInstructions(
  maxModelCalls: number,
  maxConcurrentTools: number,
  modelName: string
): string {
  return `
## Agent Architecture

You are an autonomous agent orchestrating resources to accomplish user goals.

**Your Resources:**
- **Reasoning Engine**: Underlying language model (${modelName}) - your cognitive processor
- **Tools**: External capabilities for actions, data retrieval, and state management
- **Model Invocations**: Budget of ${maxModelCalls} calls per turn to use these resources
- **Concurrency**: Execute up to ${maxConcurrentTools} tools in parallel per invocation

**Orchestration Strategy:**
- Each invocation processes: reasoning → tool calls (if needed) → results → next invocation
- Parallel tool execution costs 1 invocation; sequential calls cost 1 each
- Use budget efficiently: parallelize when possible to maximize accomplishment
`.trim();
}

/**
 * Generate call-scoped status showing current position in budget
 * Updated at each model invocation
 */
export function generateCallScopedStatus(
  currentCall: number,
  maxCalls: number
): string {
  const remaining = maxCalls - currentCall;
  return `
📊 **Status**: Invocation ${currentCall}/${maxCalls} | ${remaining} remaining
`.trim();
}

/**
 * Generate ephemeral instructions for iteration limit warnings
 */
export function generateIterationWarningInstructions(
  currentCall: number,
  maxCalls: number
): string {
  const remaining = maxCalls - currentCall;
  return `
⚠️ **BUDGET WARNING**: Invocation ${currentCall}/${maxCalls} (${remaining} remaining)
NEXT call is your FINAL opportunity. Use tools NOW if needed.
`.trim();
}

/**
 * Generate ephemeral instructions for final call
 */
export function generateFinalCallInstructions(
  currentCall: number,
  maxCalls: number
): string {
  return `
🔴 **FINAL INVOCATION**: Budget exhausted (${currentCall}/${maxCalls})
Tools DISABLED. Provide final response now.
`.trim();
}
