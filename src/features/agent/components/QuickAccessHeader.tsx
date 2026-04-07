'use client';

/**
 * Quick Access Header - Agent playground header with session info and controls
 * Shows selected agent name + avatar when an agent is active, otherwise session info.
 * Self-contained: gets uiMode from store
 */

import { Switch } from '@/features/shared/components/shadcn/switch';
import { Toggle } from '@/features/shared/components/shadcn/toggle';
import { AgentSessionPopover } from './AgentSessionPopover';
import { useAgent } from '../hooks/useAgent';
import { useAgentsQuery } from '../hooks/useAgentsQuery';

export function QuickAccessHeader() {
  const {
    currentSessionId,
    persistAgentSession,
    ephemeral,
    setPersistAgentSession,
    setEphemeral,
    agentConfig,
    setAgentConfig,
    uiMode,
    setUiMode,
  } = useAgent();

  const { agents } = useAgentsQuery();
  const selectedAgent = agentConfig?.agentIdentity?.id
    ? agents.find((a) => a.id === agentConfig.agentIdentity!.id) ?? null
    : null;
  
  return (
    <div className="h-[42px] z-10 flex items-center justify-start gap-8 px-6">
      {/* Agent identity or session info — fixed width slot */}
      <div className="w-[140px] flex-shrink-0">
        <AgentSessionPopover
          sessionId={currentSessionId || undefined}
          persistAgentSession={persistAgentSession}
          ephemeral={ephemeral}
          selectedAgent={selectedAgent}
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
                setAgentConfig({ ...agentConfig, stream: checked });
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
                setAgentConfig({ ...agentConfig, includeThoughtsInResponse: checked });
              }
            }}
            aria-label="Toggle thoughts display"
          />
        </div>
      </div>

      {/* Interface Section */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground font-light">Interface</span>
        <div className="flex gap-1">
          {/* Chat Layout Icon - Thin Rectangle */}
          <Toggle
            pressed={uiMode === 'chat'}
            onPressedChange={() => setUiMode('chat')}
            size="sm"
            aria-label="Chat layout"
            className="h-6 px-1 min-w-6 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="18" height="12" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </Toggle>

          {/* Side-by-Side Layout Icon - Rectangle with Divider */}
          <Toggle
            pressed={uiMode === 'side-by-side'}
            onPressedChange={() => setUiMode('side-by-side')}
            size="sm"
            aria-label="Side-by-side layout"
            className="h-6 px-1 min-w-6 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="18" height="12" stroke="currentColor" strokeWidth="1" fill="none" />
              <line x1="10" y1="1" x2="10" y2="13" stroke="currentColor" strokeWidth="1" />
            </svg>
          </Toggle>
        </div>
      </div>
    </div>
  );
}
