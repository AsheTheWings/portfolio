'use client';

/**
 * AgentsHub — Full-screen overlay for browsing and selecting saved agents.
 *
 * Default view: shows acquired agents from the store (owned + subscribed).
 * Search mode: queries backend for matching agents (owned + public discovery).
 * Covers the entire playground area, z-40 (below ToolsBar z-50).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

import { ArrowLeft } from 'lucide-react';
import { Input } from '@portfolio/ui/components/shadcn';
import { ConfirmationDialog } from '@portfolio/ui/components/ConfirmationDialog';
import { useAuthStore } from '@portfolio/auth/stores/authStore';
import { useAgentStore } from '../stores/useAgentStore';
import type { SavedAgent } from '../types';
import { useAgentSearch } from '../hooks/useAgentSearch';
import { useAcquireAgent, useReleaseAgent, useDeleteAgent } from '../hooks/useAgentMutations';
import { useWorkflowSwitcher } from '../hooks/useWorkflowSwitcher';
import { WorkflowCard } from './WorkflowCard';
import { AgentCard } from './AgentCard';
import { workflowLockReason } from '../utils/workflow-eligibility';

interface AgentsHubProps {
  onClose: () => void;
}

export function AgentsHub({ onClose }: AgentsHubProps) {
  const [search, setSearch] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'delete' | 'release' | null;
    agentId: string | null;
    agentName: string | null;
  }>({ open: false, action: null, agentId: null, agentName: null });
  const userId = useAuthStore((s) => s.user?.id);
  const toggleAgent = useAgentStore((s) => s.toggleAgent);
  const setFrontAgent = useAgentStore((s) => s.setFrontAgent);
  const acquiredAgentsMap = useAgentStore((s) => s.acquiredAgents);
  const agents = useAgentStore((s) => s.agents);
  const workflowsPool = useAgentStore((s) => s.workflowsPool);
  const selectedWorkflowId = useAgentStore((s) => s.selectedWorkflowId);
  const { switchTo: switchWorkflow } = useWorkflowSwitcher();
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

  // Mutations (auto-revalidate the acquired-agents SWR cache)
  const { trigger: triggerAcquire } = useAcquireAgent();
  const { trigger: triggerRelease } = useReleaseAgent();
  const { trigger: triggerDelete } = useDeleteAgent();

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

  const handleSelect = useCallback(
    (agent: SavedAgent) => {
      const isPresent = selectedAgentIds.has(agent.id);
      toggleAgent(agent.id, agent.agentConfig);
      if (!isPresent) {
        setFrontAgent(agent.id);
      }
    },
    [toggleAgent, setFrontAgent, selectedAgentIds],
  );

  const handleDelete = useCallback(
    (agentId: string, agentName: string) => {
      setConfirmDialog({ open: true, action: 'delete', agentId, agentName });
    },
    [],
  );

  const handleAcquire = useCallback(
    async (agentId: string) => {
      try {
        await triggerAcquire(agentId);
      } catch (err) {
        console.error('[AgentsHub] Acquire failed:', err);
      }
    },
    [triggerAcquire],
  );

  const handleRelease = useCallback(
    (agentId: string, agentName: string) => {
      setConfirmDialog({ open: true, action: 'release', agentId, agentName });
    },
    [],
  );

  const handleConfirmDialog = useCallback(async () => {
    if (!confirmDialog.agentId || !confirmDialog.action) return;
    try {
      if (confirmDialog.action === 'delete') {
        await triggerDelete(confirmDialog.agentId);
      } else {
        await triggerRelease(confirmDialog.agentId);
      }
    } catch (err) {
      console.error(`[AgentsHub] ${confirmDialog.action} failed:`, err);
    } finally {
      setConfirmDialog({ open: false, action: null, agentId: null, agentName: null });
    }
  }, [confirmDialog, triggerDelete, triggerRelease]);

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
      className="fixed inset-0 z-40 bg-background flex flex-col"
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

      {/* Scrollable content: agents + workflows */}
      <div className="flex-1 overflow-auto pb-8 scrollbar-container px-14">
        {/* Agents */}
        <p className="px-6 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Agents</p>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm text-muted-foreground">Searching...</span>
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm text-muted-foreground">
              {isSearchMode ? 'No agents match your search' : 'No agents in your library'}
            </span>
          </div>
        ) : (
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
                    onDelete={() => handleDelete(agent.id, agent.name)}
                    onAcquire={() => handleAcquire(agent.id)}
                    onRelease={() => handleRelease(agent.id, agent.name)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Workflow selector — switching is non-destructive: server-side
            session metadata is updated via PATCH so the next turn dispatches
            against the new workflow (see useWorkflowSwitcher). */}
        {workflowsPool.length > 0 && (
          <div className="px-6 py-4 border-b border-border-subtle">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Workflow
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              {workflowsPool.map((w) => {
                const lockReason = workflowLockReason(w, agents);
                return (
                  <WorkflowCard
                    key={w.id}
                    workflow={w}
                    isSelected={w.id === selectedWorkflowId}
                    disabled={lockReason !== null}
                    disabledReason={lockReason ?? undefined}
                    onClick={() => { void switchWorkflow(w.id); }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, action: null, agentId: null, agentName: null })}
        onConfirm={handleConfirmDialog}
        title={confirmDialog.action === 'delete' ? 'Delete Agent' : 'Remove Agent'}
        contentText={
          confirmDialog.action === 'delete'
            ? `Are you sure you want to delete "${confirmDialog.agentName ?? ''}"?`
            : `Remove "${confirmDialog.agentName ?? ''}" from your library?`
        }
        confirmButtonText={confirmDialog.action === 'delete' ? 'Delete' : 'Remove'}
        variant={confirmDialog.action === 'delete' ? 'destructive' : 'default'}
      />
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


