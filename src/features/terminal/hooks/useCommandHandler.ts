'use client';

/**
 * Command handler hook for terminal
 * Manages command history and execution
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import type { CommandHistory, CommandContext, CommandOutput } from '../types';
import { commandParser } from '../utils/command-parser';
import { commandRouter } from '../utils/command-router';

export function useCommandHandler() {
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Subscribe to auth changes to clear history on logout
  useEffect(() => {
    let previousUser = useAuthStore.getState().user;
    
    const unsubscribe = useAuthStore.subscribe((state) => {
      const currentUser = state.user;
      // User logged out - clear history
      if (previousUser && !currentUser) {
        setHistory([]);
      }
      previousUser = currentUser;
    });

    return unsubscribe;
  }, []);

  const executeCommand = useCallback(async (input: string) => {
    if (!input.trim()) return;

    const entryId = `${Date.now()}-${Math.random()}`;
    const startTime = performance.now(); // High precision start time
    
    // Add command to history immediately with pending state
    const pendingEntry: CommandHistory = {
      id: entryId,
      input,
      result: {
        success: true,
        output: { type: 'text', content: '' },
        timestamp: new Date(),
      },
      timestamp: new Date(),
      isPending: true,
    };
    setHistory(prev => [...prev, pendingEntry]);
    setIsProcessing(true);

    try {
      const parsed = commandParser.parse(input);
      
      // Create closure-based updateOutput callback (pre-bound to entryId)
      const updateOutputForThisEntry = (output: CommandOutput) => {
        setHistory(prev =>
          prev.map(entry =>
            entry.id === entryId
              ? { ...entry, result: { ...entry.result, output } }
              : entry
          )
        );
      };

      // Create command context
      const context: CommandContext = {
        updateOutput: updateOutputForThisEntry,
      };

      // Execute command
      const result = await commandRouter.execute(parsed, context);
      
      const endTime = performance.now(); // High precision end time
      const executionTimeMs = endTime - startTime;
      
      // Handle clear command
      if (result.output.type === 'text' && result.output.content === '__CLEAR__') {
        setHistory([]);
      } else {
        // Update the pending entry with actual result and execution time
        setHistory(prev => 
          prev.map(entry => 
            entry.id === entryId 
              ? { 
                  ...entry, 
                  result, 
                  timestamp: result.timestamp, 
                  isPending: false,
                  executionTimeMs 
                }
              : entry
          )
        );
      }
    } catch (error: unknown) {
      const endTime = performance.now();
      const executionTimeMs = endTime - startTime;
      
      // Update the pending entry with error
      setHistory(prev => 
        prev.map(entry => 
          entry.id === entryId 
            ? {
                ...entry,
                result: {
                  success: false,
                  output: { type: 'text', content: `Error: ${error instanceof Error ? error.message : String(error)}` },
                  timestamp: new Date(),
                },
                timestamp: new Date(),
                isPending: false,
                executionTimeMs,
              }
            : entry
        )
      );
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    history,
    isProcessing,
    executeCommand,
  };
}
