'use client';

import { useState } from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import type {
  AgentimeProblem,
  AgentimeRecoveryAction,
} from '@agentime/protocol';
import { resolveProblemPresentation } from '../problems/presentation';
import type { ProblemLocation } from '../problems/types';

interface ProblemNoticeProps {
  problem: AgentimeProblem;
  location: ProblemLocation;
  onRecoveryAction?: (action: AgentimeRecoveryAction) => void;
  availableRecoveryActions?: readonly AgentimeRecoveryAction[];
  className?: string;
}

export function ProblemNotice({
  problem,
  location,
  onRecoveryAction,
  availableRecoveryActions,
  className = '',
}: ProblemNoticeProps) {
  const presentation = resolveProblemPresentation(problem, location);
  const actions = availableRecoveryActions
    ? presentation.actions.filter((action) => availableRecoveryActions.includes(action.capability))
    : presentation.actions;
  const [copied, setCopied] = useState(false);

  const copyReference = async () => {
    await navigator.clipboard.writeText(presentation.diagnosticReference);
    setCopied(true);
  };

  return (
    <section
      role="alert"
      aria-labelledby={`problem-title-${problem.diagnosticId}`}
      aria-describedby={`problem-message-${problem.diagnosticId}`}
      className={`rounded-md border border-red-500/40 bg-red-500/5 p-3 ${className}`}
      data-diagnostic-id={problem.diagnosticId}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <h3
            id={`problem-title-${problem.diagnosticId}`}
            className="text-sm font-medium text-red-600 dark:text-red-400"
          >
            {presentation.title}
          </h3>
          <p
            id={`problem-message-${problem.diagnosticId}`}
            className="mt-1 text-sm text-foreground"
          >
            {presentation.message}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              Reference: {presentation.diagnosticReference}
            </span>
            <button
              type="button"
              onClick={() => void copyReference()}
              aria-label={`Copy diagnostic reference ${presentation.diagnosticReference}`}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? <Check aria-hidden="true" className="size-3" /> : <Copy aria-hidden="true" className="size-3" />}
              {copied ? 'Copied' : 'Copy reference'}
            </button>
          </div>
          {onRecoveryAction && actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Recovery actions">
              {actions.map((action) => (
                <button
                  key={action.capability}
                  type="button"
                  onClick={() => onRecoveryAction(action.capability)}
                  className="rounded border border-current px-2 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={action.label}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
