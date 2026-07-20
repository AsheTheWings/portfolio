'use client';

import useSWR from 'swr';
import type { SessionSummary } from '@agentime/protocol';
import { agentimeHttp } from '../lib/agentime-client';
import { agentSWRKeys } from '../lib/swr-keys';
import { withHttpProblem } from '../problems/http';

export type SessionRow = SessionSummary;

export function useSessionHistory(limit = 100) {
  const { data = [], error, isLoading, mutate } = useSWR<SessionSummary[]>(
    agentSWRKeys.sessionHistory(limit),
    () => withHttpProblem(
      () => agentimeHttp.listSessions({ limit }),
      'session',
      `session-history:${limit}`,
    ),
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      dedupingInterval: 5_000,
      keepPreviousData: true,
    },
  );

  return {
    sessions: data,
    isLoading,
    isError: Boolean(error),
    error,
    mutate,
  };
}
