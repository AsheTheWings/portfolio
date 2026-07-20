'use client';

import { WifiOff } from 'lucide-react';
import { useAgentStore } from '../stores/useAgentStore';
import { ProblemNotice } from './ProblemNotice';

export function ConnectionStatus() {
  const connection = useAgentStore((state) => state.connectionProblem);
  const occurrence = useAgentStore((state) => (
    connection.problemDiagnosticId
      ? state.problemOccurrences[connection.problemDiagnosticId]
      : undefined
  ));

  if (connection.status === 'connected') return null;

  if (occurrence && occurrence.location.kind === 'connection') {
    return (
      <div className="absolute inset-x-0 top-10 z-30 mx-auto w-[min(44rem,calc(100%-2rem))]">
        <ProblemNotice problem={occurrence.problem} location={occurrence.location} />
      </div>
    );
  }

  const message = connection.diagnostic?.message
    ?? (connection.status === 'connecting'
      ? 'Connecting to Agentime…'
      : 'The Agentime connection is unavailable. Reconnection will continue automatically.');

  return (
    <div
      role={connection.status === 'error' ? 'alert' : 'status'}
      aria-live={connection.status === 'error' ? 'assertive' : 'polite'}
      className="absolute inset-x-0 top-10 z-30 mx-auto flex w-[min(44rem,calc(100%-2rem))] items-center gap-2 rounded-md border border-amber-500/40 bg-background/95 px-3 py-2 text-sm shadow-sm"
    >
      <WifiOff aria-hidden="true" className="size-4 text-amber-500" />
      <span>{message}</span>
      {connection.diagnostic && (
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {connection.diagnostic.code}
        </span>
      )}
    </div>
  );
}
