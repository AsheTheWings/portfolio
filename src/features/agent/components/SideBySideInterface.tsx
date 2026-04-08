'use client';

/**
 * Side-by-Side Interface — DEPRECATED
 * 
 * Pure visual shell. No state, no streaming, no hooks.
 * Kept wired into AgentPlayground's mode toggle for continuity.
 */

export function SideBySideInterface() {
  return (
    <div className="h-full overflow-hidden flex items-center justify-center bg-background">
      <div className="h-full w-[90vw] flex flex-col border border-primary border-t-0">
        {/* Main split pane */}
        <div className="flex-1 flex overflow-hidden">
          {/* Agent Container (Left Side) */}
          <div className="h-full w-1/2 border-r border-primary flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic">
              Side-by-side interface is deprecated
            </p>
          </div>

          {/* User Container (Right Side) */}
          <div className="h-full w-1/2 flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic">
              Use the chat interface instead
            </p>
          </div>
        </div>

        {/* Footer bar */}
        <div className="w-full h-16 flex">
          <div className="w-1/2 flex items-center border-t border-r border-primary bg-surface-3 px-4">
            <span className="text-sm font-medium text-foreground w-full text-center">Agent</span>
          </div>
          <div className="w-1/2 flex items-center justify-center px-4 border-t border-primary bg-surface-3">
            <span className="text-sm font-medium text-foreground">User</span>
          </div>
        </div>
      </div>
    </div>
  );
}
