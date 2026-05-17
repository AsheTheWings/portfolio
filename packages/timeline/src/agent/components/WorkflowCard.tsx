'use client';

import { CheckCircle2, Lock } from 'lucide-react';
import type { Workflow } from '../types';
import { workflowDisplayName } from '../types';
import { MermaidDiagram } from './MermaidDiagram';

interface WorkflowCardProps {
  workflow: Workflow;
  isSelected: boolean;
  onClick: () => void;
  /** When true, the card is rendered as locked: muted styling + ignored clicks. */
  disabled?: boolean;
  /** Inline hint shown below the description when `disabled` is true. */
  disabledReason?: string;
}

export function WorkflowCard({
  workflow,
  isSelected,
  onClick,
  disabled = false,
  disabledReason,
}: WorkflowCardProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      title={disabled ? disabledReason : undefined}
      className={`
        relative flex flex-col w-[300px] rounded-lg border transition-all duration-150 text-left overflow-hidden
        ${disabled
          ? 'cursor-not-allowed opacity-50 border-border bg-surface-1'
          : 'cursor-pointer'}
        ${!disabled && isSelected
          ? 'border-violet-500/70 bg-violet-500/10 ring-1 ring-violet-500/40'
          : ''}
        ${!disabled && !isSelected
          ? 'border-border bg-surface-1 hover:border-border-strong hover:bg-surface-2'
          : ''}
      `}
    >
      {/* Mermaid diagram area — 2:3 aspect, locked so a tall SVG can't push the card */}
      <div className="w-full aspect-[2/3] min-h-0 overflow-hidden bg-surface-2 p-3 flex items-center justify-center">
        <MermaidDiagram source={workflow.mermaid} className="w-full h-full" />
      </div>

      {/* Label area */}
      <div className="px-3 py-2.5 flex flex-col gap-0.5 border-t border-border/50">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium leading-tight">
            {workflowDisplayName(workflow.id)}
          </span>
          {disabled ? (
            <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : isSelected ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          ) : null}
        </div>
        <p className="text-[0.7rem] text-muted-foreground leading-snug line-clamp-3">
          {workflow.description}
        </p>
        {disabled && disabledReason && (
          <p className="mt-1 text-[0.7rem] font-medium text-amber-400/90 leading-snug">
            {disabledReason}
          </p>
        )}
      </div>
    </button>
  );
}
