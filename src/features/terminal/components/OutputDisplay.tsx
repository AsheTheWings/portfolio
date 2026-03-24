'use client';

/**
 * Display command output history
 */

import type { CommandHistory } from '../types';
import { CommandOutput } from './Console';

interface OutputDisplayProps {
  history: CommandHistory[];
}

/**
 * Format execution time with appropriate precision
 */
function formatExecutionTime(ms: number): string {
  if (ms < 1) {
    return `${ms.toFixed(2)}ms`;
  } else if (ms < 10) {
    return `${ms.toFixed(1)}ms`;
  } else if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

export function OutputDisplay({ history }: OutputDisplayProps) {
  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <div key={entry.id}>
          {/* Input command */}
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold text-sm mt-0.5">›</span>
            <span className="font-mono text-sm text-foreground">{entry.input}</span>
            {entry.isPending && (
              <span className="text-muted-foreground text-xs animate-pulse ml-2">...</span>
            )}
          </div>

          {/* Output - only show if not pending */}
          {!entry.isPending && (
            <>
              <div className="ml-5 mt-1">
                <CommandOutput
                  output={entry.result.output}
                  success={entry.result.success}
                />
              </div>

              {/* Timestamp + Execution Time */}
              <div className="ml-5 mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{entry.timestamp.toLocaleTimeString()}</span>
                {entry.executionTimeMs !== undefined && (
                  <>
                    <span>•</span>
                    <span className="text-primary font-medium">
                      {formatExecutionTime(entry.executionTimeMs)}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
