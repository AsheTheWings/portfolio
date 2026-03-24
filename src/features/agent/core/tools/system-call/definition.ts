/**
 * System Call Tools - Definitions
 * Tool schemas and descriptions for system-call server
 */

import type { Tool } from '../../../types';
import { handleRetrieveState } from './retrieve-state';
import { handleUpdateState } from './update-state';

export const systemCallTools: Record<string, Tool> = {
  'retrieve_state': {
    server: 'system-call',
    tool: 'retrieve_state',
    handler: handleRetrieveState,
    description: `Retrieve current system state information.

## When to Use

**Always call this BEFORE using update_state** to understand the current value. This ensures you make informed proposals and avoid unnecessary updates.

## Supported State Keys

- **system_instructions**: Current system instructions that guide your behavior
- **max_concurrent_tools**: Maximum concurrent tool executions
- **core_programming**: Core programming guidelines and restrictions`,
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The state key to retrieve',
          enum: ['system_instructions', 'max_concurrent_tools', 'core_programming'],
        },
      },
      required: ['key'],
    },
    source: 'builtIn',
  },

  'update_state': {
    server: 'system-call',
    tool: 'update_state',
    handler: handleUpdateState,
    description: `Propose updates to system state with guardrail layer approval.

## When to Use

**Use retrieve_state first** to check the current value before proposing updates. This helps you craft better proposals and understand what needs changing.

## Supported State Keys

- **system_instructions**: Propose refined system instructions..
- **max_concurrent_tools**: Propose new tool execution limits. Use when adjusting performance or resource constraints.
- **core_programming**: Modify core programming guidelines.

## How It Works

1. Propose a new value for a state key
2. Guardrail layer will approve, reject, or provide feedback
3. Iterate based on feedback until approved or cancelled`,
    inputSchema: {
      type: 'object',
      description: 'Provide state updates as key-value pairs. Example: { "system_instructions": "new value" }',
      properties: {
        system_instructions: {
          type: 'string',
          description: 'New system instructions text',
        },
        max_concurrent_tools: {
          type: 'number',
          description: 'New maximum concurrent tool executions',
        },
        core_programming: {
          type: 'string',
          description: 'Core programming guidelines override.',
        },
      },
      additionalProperties: false,
    },
    source: 'builtIn',
  },
};
