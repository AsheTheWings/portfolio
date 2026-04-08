'use client';

/**
 * AgentsHub — Full-screen overlay for browsing and selecting saved agents.
 *
 * Default view: shows acquired agents from the store (owned + subscribed).
 * Search mode: queries backend for matching agents (owned + public discovery).
 * Covers the entire playground area, z-40 (below ToolsBar z-50).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

import { ArrowLeft, Lock } from 'lucide-react';
import { Input, Badge, ScrollArea } from '@/features/shared/components/shadcn';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { useAgentStore } from '../stores/useAgentStore';
import { deleteAgent, acquireAgent, releaseAgent } from '../lib/agent-api';
import type { SavedAgent } from '../types';
import { useAgentSearch } from '../hooks/useAgentSearch';
import { revalidateAcquiredAgents } from '../hooks/useAcquiredAgentsQuery';
import { isLightColor } from '../utils/color';

interface AgentsHubProps {
  onClose: () => void;
}

export function AgentsHub({ onClose }: AgentsHubProps) {
  const [search, setSearch] = useState('');
  const userId = useAuthStore((s) => s.user?.id);
  const toggleAgent = useAgentStore((s) => s.toggleAgent);
  const acquiredAgentsMap = useAgentStore((s) => s.acquiredAgents);
  const agents = useAgentStore((s) => s.agents);
  const selectedAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of agents) {
      if (a.agentId !== 'none') ids.add(a.agentId);
    }
    return ids;
  }, [agents]);

  // Search: only fetches when search has content (lazy)
  const debouncedSearch = useDebounced(search, 300);
  const isSearchMode = debouncedSearch.trim().length > 0;
  const { results: searchResults, isSearching } = useAgentSearch(isSearchMode ? debouncedSearch : null);

  // Acquired agents as sorted array (default view)
  const acquiredList = useMemo(() => {
    const list = Object.values(acquiredAgentsMap);
    list.sort((a, b) => {
      const aOwned = a.userId === userId ? 0 : 1;
      const bOwned = b.userId === userId ? 0 : 1;
      if (aOwned !== bOwned) return aOwned - bOwned;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [acquiredAgentsMap, userId]);

  // Display list: search results in search mode, acquired list otherwise
  const displayList = isSearchMode ? searchResults : acquiredList;
  const isLoading = isSearchMode && isSearching;

  const revalidateAcquired = revalidateAcquiredAgents;

  const handleSelect = useCallback(
    (agent: SavedAgent) => toggleAgent(agent.id, agent.agentConfig),
    [toggleAgent],
  );

  const handleDelete = useCallback(
    async (agentId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Delete this agent?')) return;
      try {
        await deleteAgent(agentId);
        revalidateAcquired();
      } catch (err) {
        console.error('[AgentsHub] Delete failed:', err);
      }
    },
    [revalidateAcquired],
  );

  const handleAcquire = useCallback(
    async (agentId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await acquireAgent(agentId);
        revalidateAcquired();
      } catch (err) {
        console.error('[AgentsHub] Acquire failed:', err);
      }
    },
    [revalidateAcquired],
  );

  const handleRelease = useCallback(
    async (agentId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Remove this agent from your library?')) return;
      try {
        await releaseAgent(agentId);
        revalidateAcquired();
      } catch (err) {
        console.error('[AgentsHub] Release failed:', err);
      }
    },
    [revalidateAcquired],
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
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Searching...</span>
        </div>
      ) : displayList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">
            {isSearchMode ? 'No agents match your search' : 'No agents in your library'}
          </span>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayList.map((agent) => {
                const isOwner = agent.userId === userId;
                const isAcquired = agent.id in acquiredAgentsMap;
                return (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isOwner={isOwner}
                    isAcquired={isAcquired}
                    isSelected={selectedAgentIds.has(agent.id)}
                    isSearchMode={isSearchMode}
                    onSelect={() => handleSelect(agent)}
                    onDelete={(e) => handleDelete(agent.id, e)}
                    onAcquire={(e) => handleAcquire(agent.id, e)}
                    onRelease={(e) => handleRelease(agent.id, e)}
                  />
                );
              })}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ============================================================
// Debounce Hook
// ============================================================

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ============================================================
// Agent Card
// ============================================================

interface AgentCardProps {
  agent: SavedAgent;
  isOwner: boolean;
  isAcquired: boolean;
  isSelected: boolean;
  isSearchMode: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onAcquire: (e: React.MouseEvent) => void;
  onRelease: (e: React.MouseEvent) => void;
}

function AgentCard({ agent, isOwner, isAcquired, isSelected, isSearchMode, onSelect, onDelete, onAcquire, onRelease }: AgentCardProps) {
  const color = agent.color ?? '#E2E8F0';
  const lightColor = isLightColor(color);

  const textClass = isSelected ? (lightColor ? 'text-gray-900' : 'text-white') : '';
  const avatarTextClass = lightColor ? 'text-gray-900/80' : 'text-white/80';

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
          {isOwner && (
            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${isSelected ? `bg-black/10 ${textClass} border-current/30` : ''}`}>
              Owner
            </Badge>
          )}
          {agent.isPublic && (
            <Badge variant="outline" className={`text-xs px-1.5 py-0 flex items-center gap-0.5 ${isSelected ? `border-current/30 ${textClass} opacity-80` : 'text-muted-foreground'}`}>
              Public
            </Badge>
          )}
          {!agent.isConfigurable && (
            <Badge variant="outline" className={`text-xs px-1.5 py-0 flex items-center gap-0.5 ${isSelected ? `border-current/30 ${textClass} opacity-80` : 'text-muted-foreground'}`}>
              <Lock className="w-2.5 h-2.5" />
              Locked
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Acquire/Release for non-owned agents in search mode */}
          {!isOwner && isSearchMode && (
            <button
              onClick={isAcquired ? onRelease : onAcquire}
              className={`text-[10px] transition-colors px-2 py-0.5 rounded ${
                isSelected
                  ? `${textClass} opacity-70 hover:opacity-100 hover:bg-black/10`
                  : isAcquired
                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    : 'text-primary hover:text-primary/80 hover:bg-primary/10'
              }`}
            >
              {isAcquired ? 'Remove' : 'Add to Library'}
            </button>
          )}
          {/* Delete button (owner only) */}
          {isOwner && (
            <button
              onClick={onDelete}
              className={`text-[10px] transition-colors px-2 py-0.5 rounded ml-auto ${
                isSelected
                  ? `${textClass} opacity-70 hover:opacity-100 hover:bg-black/10`
                  : 'text-destructive hover:text-destructive/80 hover:bg-destructive/10'
              }`}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
