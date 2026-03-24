'use client';

/**
 * Main Terminal Screen - Console with inline components
 * 
 * Note: Auth hydration is handled by TerminalClient wrapper (app/TerminalClient.tsx)
 * This component receives already-hydrated user state via props.
 * 
 * Inline Component Architecture:
 * - All features (agent, config, performance) render inline in console history
 * - No view switching - everything visible in command output
 * - Commands return React components that render directly
 * - Cleaner UX, better discoverability, simpler architecture
 */

import { useCommandHandler } from '../hooks/useCommandHandler';
import { CommandInput } from './CommandInput';
import { Console } from './Console';
import { useAuthPlugin, type UserPublic } from '@/features/authentication';
import { AgentProvider } from '@/features/agent';

interface TerminalContentProps {
  initialUser: UserPublic | null;
  initialIsAuthenticated: boolean;
}

function TerminalContent({ initialUser, initialIsAuthenticated }: TerminalContentProps) {
  const { history, isProcessing, executeCommand } = useCommandHandler();
  
  // Register domain plugins
  useAuthPlugin();

  return (
    <div className="bg-background text-foreground">
      {/* Console - Single view with inline components */}
      <div className="w-full h-[calc(100vh-88px)] overflow-auto">
        <Console 
          history={history} 
          isProcessing={isProcessing}
          isAuthenticated={initialIsAuthenticated}
        />
      </div>

      {/* Input - Fixed at bottom */}
      <footer className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-surface-2 border-t border-border-subtle shadow-depth-lg z-20">
        <div className="max-w-7xl mx-auto">
          <CommandInput
            onCommand={executeCommand}
            isProcessing={isProcessing}
            history={history.map(h => h.input)}
          />
        </div>
      </footer>
    </div>
  );
}

interface TerminalProps {
  initialUser: UserPublic | null;
  initialIsAuthenticated: boolean;
}

export function Terminal({ initialUser, initialIsAuthenticated }: TerminalProps) {
  return (
    <AgentProvider>
      <TerminalContent 
        initialUser={initialUser}
        initialIsAuthenticated={initialIsAuthenticated}
      />
    </AgentProvider>
  );
}
