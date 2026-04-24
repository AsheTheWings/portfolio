'use client';

import { CheckCircle2 } from 'lucide-react';
import type { Workflow } from '../types';
import { workflowDisplayName } from '../types';
import { MermaidDiagram } from './MermaidDiagram';

interface WorkflowCardProps {
  workflow: Workflow;
  isSelected: boolean;
  onClick: () => void;
}

export function WorkflowCard({ workflow, isSelected, onClick }: WorkflowCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex flex-col w-[400px] rounded-lg border transition-all duration-150 cursor-pointer text-left overflow-hidden
        ${isSelected
          ? 'border-violet-500/70 bg-violet-500/10 ring-1 ring-violet-500/40'
          : 'border-border bg-surface-1 hover:border-border-strong hover:bg-surface-2'
        }
      `}
    >
      {/* Mermaid diagram area — 2:3 aspect */}
      <div className="w-full aspect-[2/3] bg-surface-2 p-3 flex items-center justify-center">
        <MermaidDiagram source={workflow.mermaid} className="w-full h-full" />
      </div>

      {/* Label area */}
      <div className="px-3 py-2.5 flex flex-col gap-0.5 border-t border-border/50">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium leading-tight">
            {workflowDisplayName(workflow.id)}
          </span>
          {isSelected && (
            <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          )}
        </div>
        <p className="text-[0.7rem] text-muted-foreground leading-snug line-clamp-2">
          {workflow.description}
        </p>
      </div>
    </button>
  );
}
