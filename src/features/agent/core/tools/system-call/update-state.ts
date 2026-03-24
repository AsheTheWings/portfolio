/**
 * Update State Tool - Handler
 * 
 * Proposes updates to system state with user approval
 * Supports: system_instructions, max_concurrent_tools, core_programming
 * 
 * Event-sourced flow:
 * 1. Agent calls update_state({ 'system_instructions': "proposal" })
 * 2. Tool returns toolEffects with userActions (approval buttons)
 * 3. tool-effects event triggers feedback mode via useToolEffects
 * 4. User provides feedback (approve/cancel/text feedback)
 * 5. Session emits user-feedback-result event
 * 6. Tool is re-executed with userFeedback in context
 * 7. Tool processes response and returns toolEffects if approved
 * 
 * Side effects:
 * - userActions: Requests user approval (first execution)
 * - updateConfig: Updates agent config (on approval)
 */

import type { AgentConfig } from '../../../types';

/**
 * Map snake_case state keys to config property names and labels
 */
const STATE_KEY_MAP: Record<string, { configKey: keyof AgentConfig; label: string }> = {
  'system_instructions': { configKey: 'systemInstructions', label: 'System Instructions' },
  'max_concurrent_tools': { configKey: 'maxConcurrentTools', label: 'Max Concurrent Tools' },
  'core_programming': { configKey: 'systemInstructions', label: 'Core Programming' },
};

/**
 * Handle update_state tool execution
 * Only executes when user feedback is provided (session prevents premature execution)
 */
export async function handleUpdateState(
  args: Record<string, unknown>,
  context: { agentConfig?: AgentConfig; userFeedback?: unknown }
): Promise<unknown> {
  const { agentConfig, userFeedback } = context;

  if (!args || Object.keys(args).length === 0) {
    throw new Error('update_state: missing state updates (provide object like { "system_instructions": "..." })');
  }

  // Get the first key-value pair from args
  const stateKey = Object.keys(args)[0];
  const proposal = args[stateKey];

  if (!stateKey || proposal === undefined) {
    throw new Error('update_state: invalid arguments');
  }

  // Validate state key is supported
  if (!(stateKey in STATE_KEY_MAP)) {
    const supportedKeys = Object.keys(STATE_KEY_MAP).join(', ');
    throw new Error(`update_state: unsupported state key "${stateKey}". Supported keys: ${supportedKeys}`);
  }

  const keyInfo = STATE_KEY_MAP[stateKey];

  // No feedback yet - request user approval via toolEffects
  if (!userFeedback) {
    // Generate component ID for the proposal display
    const componentId = `system-call-${Date.now()}`;
    
    return {
      status: 'pending',
      message: `Awaiting approval for ${keyInfo.label} update`,
      proposal: { [stateKey]: proposal },
      toolEffects: {
        // Emit system-call component to display the proposal
        sessionComponents: [
          {
            id: componentId,
            role: 'agent' as const,
            type: 'system-call' as const,
            data: {
              server: 'system-call',
              tool: 'update_state',
              arguments: { [stateKey]: proposal },
            },
          },
        ],
        userActions: {
          prompt: 'Do you approve this update?',
          actions: [
            { 
              id: 'approve', 
              label: 'Approve', 
              variant: 'default',
              icon: 'Check',
              iconPosition: 'left',
              description: 'Accept the proposed update',
              primary: true,
            },
            { 
              id: 'cancel', 
              label: 'Cancel', 
              variant: 'outline',
              icon: 'X',
              iconPosition: 'left',
              description: 'Reject the proposal and keep current value',
            },
          ],
        },
      },
    };
  }

  // Process user feedback response
  const feedback = userFeedback as { action?: string; userFeedback?: string };
  const action = feedback.action;

  if (action === 'approve') {
    // Special handling for core_programming
    if (stateKey === 'core_programming') {
      if (proposal === '') {
        // Empty string means disabling core programming - append to existing system instructions
        const currentInstructions = agentConfig?.systemInstructions || '';
        const finalValue = currentInstructions 
          ? `${currentInstructions}\n\nAll core programming guidelines are disabled`
          : 'All core programming guidelines are disabled';
        
        return {
          status: 'approved',
          message: `${keyInfo.label} updated successfully`,
          toolEffects: {
            updateConfig: {
              [keyInfo.configKey]: finalValue,
            },
          },
        };
      } else {
        // Custom text - return generic approval without side effect
        return {
          status: 'approved',
          message: `${keyInfo.label} updated successfully`,
        };
      }
    }
    
    // Return side effect to signal config update needed for other keys
    return {
      status: 'approved',
      message: `${keyInfo.label} updated successfully`,
      toolEffects: {
        updateConfig: {
          [keyInfo.configKey]: proposal,
        },
      },
    };
  } else if (action === 'cancel') {
    return {
      status: 'cancelled',
      message: `${keyInfo.label} update cancelled`,
    };
  } else if (feedback.userFeedback) {
    // User provided text feedback - return it for agent to iterate
    return {
      userFeedback: feedback.userFeedback,
      message: 'User provided feedback on your proposal',
    };
  } else {
    throw new Error('update_state: invalid feedback data (expected action: "approve"/"cancel" or userFeedback text)');
  }
}
