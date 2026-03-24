'use client';

/**
 * Console component - renders terminal history and welcome message
 */

import type { CommandHistory } from '../types';
import { OutputDisplay } from './OutputDisplay';

interface ConsoleProps {
  history: CommandHistory[];
  isProcessing: boolean;
  isAuthenticated: boolean;
}

export function Console({ history, isAuthenticated }: ConsoleProps) {
  const asciiLogo = `
████████╗██╗███╗   ███╗███████╗██╗     ██╗███╗   ██╗███████╗
╚══██╔══╝██║████╗ ████║██╔════╝██║     ██║████╗  ██║██╔════╝
   ██║   ██║██╔████╔██║█████╗  ██║     ██║██╔██╗ ██║█████╗  
   ██║   ██║██║╚██╔╝██║██╔══╝  ██║     ██║██║╚██╗██║██╔══╝  
   ██║   ██║██║ ╚═╝ ██║███████╗███████╗██║██║ ╚████║███████╗
   ╚═╝   ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝
`;

  return (
    <main className={`px-6 pt-8 pb-6 max-w-7xl w-full mx-auto ${history.length === 0 ? 'h-full flex items-center justify-center' : ''}`}>
      {/* ASCII Banner + Welcome message */}
      {history.length === 0 && (
        <div className="flex flex-col items-center">
          {/* ASCII Art Banner - Always shown when no history */}
          <pre className="text-cyan-400 text-sm sm:text-base md:text-lg mb-8 text-center">
            {asciiLogo}
          </pre>
          
          {/* Welcome text - Only shown when NOT authenticated */}
          {!isAuthenticated && (
            <div className="space-y-2 text-sm text-muted-foreground text-center max-w-xl">
              <p>
                Start by logging in:{' '}
                <code className="bg-muted text-foreground px-2 py-0.5 rounded font-mono text-xs">
                  login &lt;username&gt; &lt;password&gt;
                </code>
              </p>
              <p>
                Or create an account:{' '}
                <code className="bg-muted text-foreground px-2 py-0.5 rounded font-mono text-xs">
                  signup &lt;username&gt; &lt;password&gt;
                </code>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Command history */}
      {history.length > 0 && <OutputDisplay history={history} />}
    </main>
  );
}

/**
 * Smart command output renderer
 * Supports text, components, tables, etc.
 */

import type { CommandOutput as CommandOutputType } from '../types';

interface CommandOutputProps {
  output: CommandOutputType;
  success: boolean;
}

export function CommandOutput({ output, success }: CommandOutputProps) {
  const baseClass = success ? 'text-foreground' : 'text-error';

  switch (output.type) {
    case 'text':
      return (
        <pre className={`whitespace-pre-wrap font-mono text-sm ${baseClass}`}>
          {output.content}
        </pre>
      );

    case 'component':
      return <div className={baseClass}>{output.component}</div>;

    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm bg-surface-1 rounded-lg shadow-depth-sm overflow-hidden">
            <thead>
              <tr className="bg-surface-2">
                {output.columns.map((col, i) => (
                  <th
                    key={i}
                    className="border-b border-border-subtle px-3 py-2 text-left font-semibold text-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {output.rows.map((row, i) => (
                <tr key={i} className="hover:bg-surface-2 transition-colors border-b border-border-subtle last:border-0">
                  {output.columns.map((col, j) => (
                    <td key={j} className="px-3 py-2 text-foreground">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'json':
      return (
        <pre className={`whitespace-pre-wrap font-mono text-sm bg-surface-1 p-3 rounded-lg border border-border-subtle shadow-depth-sm ${baseClass}`}>
          {JSON.stringify(output.data, null, 2)}
        </pre>
      );

    default:
      return (
        <pre className="text-error text-sm">
          Unknown output type: {(output as { type: string }).type}
        </pre>
      );
  }
}
