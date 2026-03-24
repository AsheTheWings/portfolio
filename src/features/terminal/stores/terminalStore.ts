/**
 * Terminal Store
 * Manages command history and execution state
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CommandOutput } from '../types';

export interface CommandHistory {
  id: string;
  input: string;
  result: {
    success: boolean;
    output: CommandOutput;
    data?: unknown;
  };
  timestamp: Date;
  executionTimeMs?: number;
  isPending?: boolean;
}

interface TerminalState {
  history: CommandHistory[];
  isProcessing: boolean;
  
  // Actions
  addCommand: (input: string) => string; // Returns command ID
  updateCommandResult: (id: string, result: CommandHistory['result'], executionTimeMs?: number) => void;
  clearHistory: () => void;
  setProcessing: (isProcessing: boolean) => void;
}

export const useTerminalStore = create<TerminalState>()(
  devtools(
    (set) => ({
      history: [],
      isProcessing: false,

      addCommand: (input) => {
        const id = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set(
          (state) => ({
            history: [
              ...state.history,
              {
                id,
                input,
                result: { success: false, output: { type: 'text', content: '' } },
                timestamp: new Date(),
                isPending: true,
              },
            ],
          }),
          false,
          'terminal/addCommand'
        );
        return id;
      },

      updateCommandResult: (id, result, executionTimeMs) =>
        set(
          (state) => ({
            history: state.history.map((cmd) =>
              cmd.id === id
                ? { ...cmd, result, executionTimeMs, isPending: false }
                : cmd
            ),
          }),
          false,
          'terminal/updateCommandResult'
        ),

      clearHistory: () =>
        set(
          { history: [] },
          false,
          'terminal/clearHistory'
        ),

      setProcessing: (isProcessing) =>
        set(
          { isProcessing },
          false,
          'terminal/setProcessing'
        ),
    }),
    { name: 'TerminalStore' }
  )
);
