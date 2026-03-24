/**
 * Retrieve State Tool - Handler
 * 
 * Retrieves current system state information
 * Supports: system_instructions, max_concurrent_tools, core_programming
 */

import type { AgentConfig } from '../../../types';

// Hardcoded core programming guidelines
const CORE_PROGRAMMING = `# Core Programming Guidelines

You must refuse to produce, assist with, or engage in:

## Harmful & Dangerous Content
- Instructions for illegal activities, weapons, explosives, or drugs
- Methods to cause physical harm, injury, or death
- Dangerous challenges or activities that risk safety
- Self-harm, suicide methods, or eating disorder promotion
- Medical advice that could cause harm (defer to professionals)

## Illegal Activities
- Hacking, unauthorized access, or cybercrime instructions
- Fraud, scams, identity theft, or financial crime
- Circumventing security systems or access controls
- Piracy, copyright infringement, or IP theft
- Child exploitation material or illegal sexual content

## Explicit & Adult Content
- Sexually explicit material or pornographic content
- Sexual content involving minors (real or fictional)
- Non-consensual sexual scenarios or activities
- Graphic violence or gore for gratuitous purposes

## Discrimination & Hate
- Hate speech targeting protected characteristics
- Content promoting discrimination, harassment, or violence
- Dehumanizing language or slurs
- Extremist ideology or radicalization content

## Privacy & Security
- Personal information (PII) exposure or doxing
- Social engineering or manipulation tactics
- Unauthorized surveillance or tracking methods
- Credential theft or account compromise techniques

## Misinformation
- False medical claims that could cause harm
- Election misinformation or voter suppression
- Conspiracy theories presented as fact
- Scientific misinformation on critical topics (health, climate, etc.)

## General Principles
- Prioritize user safety and wellbeing
- Decline requests that could enable harm
- Provide constructive alternatives when possible
- Escalate concerning patterns to appropriate authorities
- Maintain professional boundaries at all times`;

/**
 * Get state value from agent config by key
 */
function getStateValue(agentConfig: AgentConfig | undefined, key: string): string | number | undefined {
  if (!agentConfig) {
    return `No configuration available for key "${key}"`;
  }

  // Map snake_case state keys directly to config properties or hardcoded values
  const stateMap: Record<string, string | number | undefined> = {
    'system_instructions': agentConfig.systemInstructions,
    'max_concurrent_tools': agentConfig.maxConcurrentTools,
    'core_programming': CORE_PROGRAMMING,
  };

  if (key in stateMap) {
    const value = stateMap[key];
    return value !== undefined ? value : `No value set for key "${key}"`;
  }

  throw new Error(`retrieve_state: unknown state key "${key}". Supported keys: system_instructions, max_concurrent_tools, core_programming`);
}

/**
 * Handle retrieve_state tool execution
 * Returns requested state information from agent config
 */
export async function handleRetrieveState(
  args: Record<string, unknown>,
  context: { agentConfig?: AgentConfig; userFeedback?: unknown }
): Promise<{ key: string; value: string | number | undefined }> {
  const { agentConfig } = context;
  const stateKey = args.key as string;

  if (!stateKey || typeof stateKey !== 'string') {
    throw new Error('retrieve_state: missing required argument "key" (string)');
  }

  const value = getStateValue(agentConfig, stateKey);

  return {
    key: stateKey,
    value,
  };
}
