'use client';

/**
 * Quick Access Header - Agent playground header with session info and controls
 * Shows selected agent name + avatar when an agent is active, otherwise session info.
 * Self-contained: gets uiInterface from store
 */

import { Switch } from '@/features/shared/components/shadcn/switch';
import { Toggle } from '@/features/shared/components/shadcn/toggle';
import { AgentSessionPopover } from './AgentSessionPopover';
import { useAgent } from '../hooks/useAgent';
import { useAgentStore } from '../stores/useAgentStore';
import { useWorkflowSwitcher } from '../hooks/useWorkflowSwitcher';
import { workflowDisplayName } from '../types';

export function QuickAccessHeader() {
  const {
    currentSessionId,
    persistAgentSession,
    ephemeral,
    setPersistAgentSession,
    setEphemeral,
    agentConfig,
    updateFrontAgentConfig,
    uiInterface,
    setUiInterface,
    workflowsPool,
    selectedWorkflowId,
  } = useAgent();

  // Timeline-only viewMode toggle (developer/client roles)
  const viewMode = useAgentStore((s) => s.viewMode);
  const setViewMode = useAgentStore((s) => s.setViewMode);
  const isTimeline = selectedWorkflowId === 'timeline';

  // Workflow cycling (next id, wrap-around). Disabled when only one option.
  const { cycle: cycleWorkflow } = useWorkflowSwitcher();
  const canCycleWorkflow = workflowsPool.length > 1;
  
  return (
    <div className="h-[42px] flex items-center justify-start gap-8 px-6">
      {/* Agent identity or session info — fixed width slot */}
      <div className="w-[240px]">
        <AgentSessionPopover
          sessionId={currentSessionId || undefined}
          persistAgentSession={persistAgentSession}
          ephemeral={ephemeral}
        />
      </div>

      {/* Flags Section */}
      <div className="flex items-center gap-4">
        {/* Persistent Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground font-light">Persistent</span>
          <Switch
            checked={persistAgentSession}
            onCheckedChange={setPersistAgentSession}
            aria-label="Toggle persistent mode"
          />
        </div>

        {/* Ephemeral Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground font-light">Ephemeral</span>
          <Switch
            checked={ephemeral}
            onCheckedChange={setEphemeral}
            aria-label="Toggle ephemeral mode"
          />
        </div>

        {/* Stream Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground font-light">Stream</span>
          <Switch
            checked={agentConfig?.stream ?? true}
            onCheckedChange={(checked) => {
              if (agentConfig) {
                updateFrontAgentConfig({ ...agentConfig, stream: checked });
              }
            }}
            aria-label="Toggle streaming mode"
          />
        </div>

        {/* Show Thoughts Switch - Controls whether to display thoughts in responses */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground font-light">
            Show Thoughts
          </span>
          <Switch
            checked={agentConfig?.includeThoughtsInResponse ?? true}
            onCheckedChange={(checked) => {
              if (agentConfig) {
                updateFrontAgentConfig({ ...agentConfig, includeThoughtsInResponse: checked });
              }
            }}
            aria-label="Toggle thoughts display"
          />
        </div>

        {/* Developer Switch (timeline workflow only) — composes against
            the developer role; clearing of any staged developer text on
            switch-off is enforced by the store action itself. */}
        {isTimeline && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground font-light">Developer</span>
            <Switch
              checked={viewMode === 'developer'}
              onCheckedChange={(checked) => setViewMode(checked ? 'developer' : 'client')}
              aria-label="Toggle developer composition mode"
            />
          </div>
        )}
      </div>

      {/* Interface Section */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground font-light">Interface</span>
        <div className="flex gap-1">
          {/* Chat Layout Icon - Thin Rectangle */}
          <Toggle
            pressed={uiInterface === 'chat'}
            onPressedChange={() => setUiInterface('chat')}
            size="sm"
            aria-label="Chat layout"
            className="h-6 px-1 min-w-6 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="18" height="12" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </Toggle>

          {/* Flat Layout Icon - Rectangle with Divider */}
          <Toggle
            pressed={uiInterface === 'flat'}
            onPressedChange={() => setUiInterface('flat')}
            size="sm"
            aria-label="Flat layout"
            className="h-6 px-1 min-w-6 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="18" height="12" stroke="currentColor" strokeWidth="1" fill="none" />
              <line x1="10" y1="1" x2="10" y2="13" stroke="currentColor" strokeWidth="1" />
            </svg>
          </Toggle>
        </div>
      </div>

      {/* Workflow toggle button — pinned to the right edge.
          Click cycles to the next workflow in the pool (wraps around).
          When a session is active, the switcher hook also PATCHes the
          session metadata so the next turn dispatches against the new
          workflow. */}
      {selectedWorkflowId && (
        <button
          type="button"
          onClick={() => { void cycleWorkflow(); }}
          disabled={!canCycleWorkflow}
          className="ml-auto inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15 hover:border-primary/50 transition-colors disabled:opacity-60 disabled:cursor-default disabled:hover:bg-primary/10 disabled:hover:border-primary/30"
          aria-label={canCycleWorkflow ? 'Cycle workflow' : 'Active workflow'}
          title={canCycleWorkflow ? 'Click to cycle workflow' : undefined}
        >
          {workflowDisplayName(selectedWorkflowId)}
        </button>
      )}
    </div>
  );
}
