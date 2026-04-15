'use client';

/**
 * FlatAgentResponse — Standalone agent message card for flat mode
 *
 * Matches AgentMessage's card styling (white bg, agent-colored border,
 * shadow, avatar) but renders a single message without carousel/ComponentShell.
 */

import { useAgentStore } from '../stores/useAgentStore';
import { MarkdownContent } from './MarkdownContent';
import { isLightColor } from '../utils/color';
import type { AgentSessionComponent } from '../types';

export function FlatAgentResponse({ component }: { component: AgentSessionComponent }) {
  const agentId = component.data.agentId as string | undefined;
  const acquiredAgent = useAgentStore((s) =>
    agentId && agentId !== 'none' ? s.acquiredAgents[agentId] : undefined
  );
  const agentName = agentId === 'none' || !agentId ? 'Assistant' : (acquiredAgent?.name ?? 'Agent');
  const agentColor = agentId === 'none' || !agentId ? '#E2E8F0' : (acquiredAgent?.color ?? '#E2E8F0');
  const avatarImage = acquiredAgent?.avatarImage ?? null;

  return (
    <div className="flex items-start gap-2.5">
      {/* Agent avatar */}
      <div
        className="w-8 h-8 rounded-full ring-2 ring-background overflow-hidden relative flex-shrink-0 mt-1"
        style={{ backgroundColor: agentColor }}
      >
        {avatarImage ? (
          <img src={avatarImage} alt={agentName} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-xs font-bold antialiased"
              style={{ color: isLightColor(agentColor) ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)' }}
            >
              {agentName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Card — matches AgentMessage styling */}
      <div
        className="p-4 rounded-2xl rounded-tl-md bg-white dark:bg-surface-1 text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex-1 min-w-0"
        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: agentColor }}
      >
        <MarkdownContent content={component.data.message ?? ''} />
      </div>
    </div>
  );
}
