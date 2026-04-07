'use client';

/**
 * AgentsHub — Full-screen overlay for browsing and selecting saved agents.
 * Covers the entire playground area, z-40 (below ToolsBar z-50).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

import { ArrowLeft } from 'lucide-react';
import { Input, Badge, ScrollArea } from '@/features/shared/components/shadcn';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { useAgentStore } from '../stores/useAgentStore';
import { deleteAgent } from '../lib/agent-api';
import type { SavedAgent } from '../lib/agent-api';
import type { AgentConfig } from '../types';
import { useAgentsQuery } from '../hooks/useAgentsQuery';

interface AgentsHubProps {
  onClose: () => void;
}

export function AgentsHub({ onClose }: AgentsHubProps) {
  const { agents, isLoading: loading, mutate } = useAgentsQuery();
  const [search, setSearch] = useState('');
  const userId = useAuthStore((s) => s.user?.id);
  const setAgentConfig = useAgentStore((s) => s.setAgentConfig);
  const currentAgentId = useAgentStore((s) => s.agentConfig?.agentIdentity?.id);

  // Merge owned + public agents, owned first
  const filtered = useMemo(() => {
    let list = [...agents];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description?.toLowerCase().includes(q) ?? false),
      );
    }

    // Sort: owned first, then alphabetical within each group
    list.sort((a, b) => {
      const aOwned = a.userId === userId ? 0 : 1;
      const bOwned = b.userId === userId ? 0 : 1;
      if (aOwned !== bOwned) return aOwned - bOwned;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [agents, search, userId]);

  const handleSelect = useCallback(
    (agent: SavedAgent) => {
      const isOwner = agent.userId === userId;
      const isAlreadySelected = currentAgentId === agent.id;

      if (isAlreadySelected) {
        // Deselect: strip agent reference, keep rest of config
        setAgentConfig((prev) => {
          if (!prev) return prev;
          const { agentIdentity: _, ...rest } = prev;
          return rest as AgentConfig;
        });
      } else {
        // Select: apply agent config snapshot with identity fields
        setAgentConfig({
          ...agent.agentConfig,
          agentIdentity: {
            id: agent.id,
            isOwner: isOwner,
            isConfigurable: agent.isConfigurable,
          },
        });
      }
    },
    [userId, currentAgentId, setAgentConfig],
  );

  const handleDelete = useCallback(
    async (agentId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Delete this agent?')) return;
      try {
        await deleteAgent(agentId);
        // Optimistic update + revalidate
        mutate(
          (prev) => prev?.filter((a) => a.id !== agentId),
          { revalidate: true },
        );
      } catch (err) {
        console.error('[AgentsHub] Delete failed:', err);
      }
    },
    [mutate],
  );

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Top bar */}
      <div className="relative flex items-center justify-center px-6 py-4">
        {/* Back button */}
        <button
          onClick={onClose}
          className="absolute left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Back (Esc)"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <div className="relative w-full max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9 text-sm"
            autoFocus
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-12">
              Loading agents...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12">
              {search ? 'No agents match your search' : 'No agents available'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filtered.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isOwner={agent.userId === userId}
                  isSelected={currentAgentId === agent.id}
                  onSelect={() => handleSelect(agent)}
                  onDelete={(e) => handleDelete(agent.id, e)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================
// Agent Card
// ============================================================

interface AgentCardProps {
  agent: SavedAgent;
  isOwner: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function AgentCard({ agent, isOwner, isSelected, onSelect, onDelete }: AgentCardProps) {
  const color = agent.color ?? '#E2E8F0';

  // Compute luminance to pick contrasting text color against agent color
  const isLightColor = useMemo(() => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  }, [color]);

  const textClass = isSelected ? (isLightColor ? 'text-gray-900' : 'text-white') : '';
  const avatarTextClass = isLightColor ? 'text-gray-900/80' : 'text-white/80';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={`group text-left rounded-lg border border-border-subtle hover:border-border transition-all duration-150 overflow-hidden cursor-pointer ${
        isSelected ? '' : 'bg-surface-1 hover:bg-surface-2'
      }`}
      style={isSelected ? { backgroundColor: color } : undefined}
    >
      <div className="p-4 flex flex-col gap-3 min-w-0">
        {/* Avatar + Name row */}
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 relative"
            style={{ backgroundColor: color }}
          >
            {agent.avatarImage ? (
              <img
                src={agent.avatarImage}
                alt={agent.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-semibold ${avatarTextClass}`}>
                  {agent.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className={`text-sm font-medium truncate ${isSelected ? textClass : 'text-foreground'}`}>
              {agent.name}
            </div>
            <div className={`text-xs truncate ${isSelected ? `${textClass} opacity-70` : 'text-muted-foreground'}`}>
              {agent.agentConfig.model}
            </div>
          </div>
        </div>

        {/* Description */}
        {agent.description && (
          <p className={`text-xs line-clamp-3 ${isSelected ? `${textClass} opacity-70` : 'text-muted-foreground'}`}>
            {agent.description}
          </p>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
          {agent.isPublic && (
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${isSelected ? `bg-black/10 ${textClass} border-current/30` : ''}`}>
              Public
            </Badge>
          )}
          {agent.isConfigurable && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isSelected ? `border-current/30 ${textClass} opacity-80` : ''}`}>
              Configurable
            </Badge>
          )}
          {isOwner && (
            <Badge variant="outline" className={`text-xs px-1.5 py-0 ${isSelected ? `border-current/30 ${textClass} opacity-80` : 'border-primary/30 text-primary'}`}>
              Owner
            </Badge>
          )}
        </div>

        {/* Delete button (owner only) */}
        {isOwner && (
          <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onDelete}
              className={`text-[10px] transition-colors px-2 py-0.5 rounded ${
                isSelected
                  ? `${textClass} opacity-70 hover:opacity-100 hover:bg-black/10`
                  : 'text-destructive hover:text-destructive/80 hover:bg-destructive/10'
              }`}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
