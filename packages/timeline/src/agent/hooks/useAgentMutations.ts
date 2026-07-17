'use client';

/**
 * useAgentMutations — SWR-bound mutation hooks for the acquired-agents cache.
 *
 * Each hook uses the canonical Agentime client and shares one cache key so
 * acquisition changes are reflected consistently across the interface.
 */

import useSWRMutation from 'swr/mutation';
import { agentimeHttp } from '../lib/agentime-client';
import { agentSWRKeys } from '../lib/swr-keys';

type IdArg = { arg: string };

export function useAcquireAgent() {
  return useSWRMutation(
    agentSWRKeys.acquiredAgents,
    async (_key: string, { arg: agentId }: IdArg) => {
      await agentimeHttp.acquireAgent(agentId);
    },
  );
}

export function useReleaseAgent() {
  return useSWRMutation(
    agentSWRKeys.acquiredAgents,
    async (_key: string, { arg: agentId }: IdArg) => {
      await agentimeHttp.releaseAgent(agentId);
    },
  );
}

export function useDeleteAgent() {
  return useSWRMutation(
    agentSWRKeys.acquiredAgents,
    async (_key: string, { arg: agentId }: IdArg) => {
      await agentimeHttp.deleteAgent(agentId);
    },
  );
}
