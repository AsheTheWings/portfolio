/**
 * Terminal types - Commands, parsing, history, and views
 */

import type { ReactNode, ComponentType } from 'react';

// Command parsing
export interface ParsedCommand {
  command: string;
  subcommand?: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

// Output types for future extensibility
export type CommandOutput =
  | { type: 'text'; content: string }
  | { type: 'component'; component: ReactNode }
  | { type: 'table'; columns: string[]; rows: Record<string, unknown>[] }
  | { type: 'json'; data: unknown };

export interface CommandResult {
  success: boolean;
  output: CommandOutput;
  timestamp: Date;
  data?: unknown;
}

// Convenience helper for text output (most common case)
export function textOutput(content: string): CommandOutput {
  return { type: 'text', content };
}

// Command context interface - provides dynamic output updates
export interface CommandContext {
  updateOutput?: (output: CommandOutput) => void;  // Update command output dynamically
}

// Command executor interface that each feature must implement
export interface CommandExecutor {
  canHandle(command: string, entity?: string): boolean;
  execute(
    parsed: ParsedCommand, 
    timestamp: Date,
    context?: CommandContext
  ): Promise<CommandResult>;
}

// Command history
export interface CommandHistory {
  id: string;
  input: string;
  result: CommandResult;
  timestamp: Date;
  isPending?: boolean;
  executionTimeMs?: number;  // High precision execution time in milliseconds
}

// View system
export interface View {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
  canActivate?: () => boolean;
}

export interface ViewContextValue {
  activeView: string;
  setActiveView: (id: string) => void;
  views: View[];
  registerView: (view: View) => void;
  unregisterView: (id: string) => void;
  rotateView: () => void;
}
