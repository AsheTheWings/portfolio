/**
 * Built-in Tools Registry
 * Aggregates tool definitions from server-specific modules
 */

import type { Tool } from '../../types';
import { systemCallTools } from './system-call';
import { agentJobTools } from './agent-job';
import { libraryBrowseTools } from './library';
import { nanoBananaTools } from './nano-banana';

export const BUILT_IN_TOOLS_REGISTRY: Record<string, Tool> = {
  ...systemCallTools,
  ...agentJobTools,
  ...libraryBrowseTools,
  ...nanoBananaTools,
};
