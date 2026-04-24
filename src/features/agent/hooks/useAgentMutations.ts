'use client';

/**
 * useAgentMutations — SWR-bound mutation hooks for the acquired-agents cache.
 *
 * Each hook wraps a REST call in lib/agent-api and auto-revalidates the
 * `/api/agent/agents/acquired` SWR key on success. Components should never
 * call the REST client directly — use these hooks so cache invalidation is
 * centralised and consistent.
 */

import useSWRMutation from 'swr/mutation';
import { acquireAgent, releaseAgent, deleteAgent } from '../lib/agent-api';

const ACQUIRED_AGENTS_SWR_KEY = '/api/agent/agents/acquired';

type IdArg = { arg: string };

export function useAcquireAgent() {
  return useSWRMutation(
    ACQUIRED_AGENTS_SWR_KEY,
    async (_key: string, { arg: agentId }: IdArg) => {
      await acquireAgent(agentId);
    },
  );
}

export function useReleaseAgent() {
  return useSWRMutation(
    ACQUIRED_AGENTS_SWR_KEY,
    async (_key: string, { arg: agentId }: IdArg) => {
      await releaseAgent(agentId);
    },
  );
}

export function useDeleteAgent() {
  return useSWRMutation(
    ACQUIRED_AGENTS_SWR_KEY,
    async (_key: string, { arg: agentId }: IdArg) => {
      await deleteAgent(agentId);
    },
  );
}
