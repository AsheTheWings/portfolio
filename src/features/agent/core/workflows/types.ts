/**
 * Workflow Types
 * 
 * Workflows are specialized orchestrators that can manipulate the agent loop
 * and add new functionality without altering core implementation.
 */

import type { SessionEvent, AgentMetadata, AgentConfig } from '../../types';
import type { Session } from '../session';

/**
 * Workflow identifier
 */
export type WorkflowType = 'agentJob';

/**
 * Active workflow state stored in Session
 */
export interface ActiveWorkflow {
  type: WorkflowType;
  data: unknown;  // Workflow-specific data
}

/**
 * Context passed to workflow functions
 * Provides primitives for running agent loops and managing events
 */
export interface WorkflowContext {
  // Primitives
  runAgentLoop: (signal?: AbortSignal) => AsyncGenerator<SessionEvent>;
  finalizeTurn: () => AsyncGenerator<SessionEvent>;
  
  // Event handling
  enrichEvent: (event: SessionEvent, systemInstructions?: string) => SessionEvent;
  storeEvent: (event: SessionEvent) => void;
  
  // State access
  session: Session;
  config: AgentConfig;
  turnMetadata: AgentMetadata;
  turnId: string;
}

/**
 * Workflow function signature
 * Takes context and workflow-specific data, yields enriched events
 */
export type WorkflowFunction = (
  context: WorkflowContext,
  data: unknown
) => AsyncGenerator<SessionEvent>;
