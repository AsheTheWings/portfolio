'use client';

/**
 * FlatAgentResponse — Standalone agent message card for flat mode
 *
 * Matches AgentMessage's card styling (white bg, agent-colored border,
 * shadow, avatar) but renders a single message without carousel/ComponentShell.
 */

import { useAgentStore } from '../stores/useAgentStore';
import { MarkdownContent } from './MarkdownContent';
import { Avatar, AvatarImage, AvatarFallback } from '@portfolio/ui/components/shadcn';
import type { SessionComponent } from '../types';

export function FlatAgentResponse({ component }: { component: SessionComponent }) {
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
      <Avatar className="ring-2 ring-background mt-1 flex-shrink-0">
        {avatarImage && <AvatarImage src={avatarImage} alt={agentName} />}
        <AvatarFallback color={agentColor} className="text-xs font-bold">
          {agentName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

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
