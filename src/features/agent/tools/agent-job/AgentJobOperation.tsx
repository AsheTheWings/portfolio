'use client';

/**
 * AgentJobOperation Component
 * Inline display of job management operations.
 * Shows add/remove/complete tasks, issues, etc.
 */

import React from 'react';
import { 
  CheckCircle2, Circle, Clock, Plus, Trash2, 
  LayoutDashboard, AlertCircle, AlertTriangle, CheckCircle 
} from 'lucide-react';
import { CopyButton } from './shared';

// ============================================================
// Types
// ============================================================

export interface OperationData {
  id?: string;
  title?: string;
  operation?: 'add_tasks' | 'remove_tasks' | 'complete_tasks' | 'update_job' | 'get_job' | 'add_subtasks' | 'remove_subtasks' | 'complete_subtasks' | 'add_issue' | 'update_issue' | 'list_issues';
  message?: string;
  added?: Array<{ id: string; description: string }>;
  removed?: string[];
  completed?: string[];
  updated?: string[];
  issue?: {
    id?: string;
    title: string;
    problem?: string;
    solution?: string;
    status?: string;
  };
  task?: {
    id?: string;
    description: string;
    subtasks?: Array<{
      id?: string;
      description: string;
      status?: 'pending' | 'completed';
    }>;
  };
}

// ============================================================
// Operation View
// ============================================================

const OperationView = ({ job }: { job: OperationData }) => {
  const opColors: Record<string, string> = {
    add_tasks: 'text-blue-600 dark:text-blue-400',
    remove_tasks: 'text-red-600 dark:text-red-400',
    complete_tasks: 'text-green-600 dark:text-green-400',
    update_job: 'text-purple-600 dark:text-purple-400',
    get_job: 'text-gray-600 dark:text-gray-400',
    add_subtasks: 'text-blue-500 dark:text-blue-300',
    remove_subtasks: 'text-red-500 dark:text-red-300',
    complete_subtasks: 'text-green-500 dark:text-green-300',
    add_issue: 'text-amber-600 dark:text-amber-400',
    update_issue: 'text-green-600 dark:text-green-400',
    list_issues: 'text-gray-600 dark:text-gray-400',
  };

  const OpIcon = {
    add_tasks: Plus,
    remove_tasks: Trash2,
    complete_tasks: CheckCircle2,
    update_job: Clock,
    get_job: LayoutDashboard,
    add_subtasks: Plus,
    remove_subtasks: Trash2,
    complete_subtasks: CheckCircle,
    add_issue: AlertCircle,
    update_issue: CheckCircle,
    list_issues: AlertTriangle,
  }[job.operation || 'get_job'] || Circle;

  return (
    <div className="session-component flex justify-start w-full">
      <div className="w-full max-w-[85%] rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <OpIcon size={14} className={opColors[job.operation || 'get_job']} />
          <span className="font-medium uppercase text-[10px] tracking-wider opacity-70">
            {job.operation?.replace('_', ' ')}
          </span>
          {job.id && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">
              <CopyButton text={job.id} />
            </span>
          )}
        </div>
        
        {job.message && <div className="text-foreground mb-2">{job.message}</div>}
        
        {job.added && (
          <div className="space-y-1 pl-2 border-l-2 border-blue-500/20">
            {job.added.map(t => (
              <div key={t.id} className="text-xs text-muted-foreground flex gap-2">
                <Plus size={12} className="mt-0.5" /> {t.description}
              </div>
            ))}
          </div>
        )}
        
        {job.completed && (
          <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 size={12} /> {job.completed.length} tasks completed
          </div>
        )}
        
        {job.issue && (
          <div className="mt-2 p-2 rounded border border-amber-500/20 bg-amber-50/20 dark:bg-amber-950/10">
            <div className="text-xs font-medium text-foreground mb-1">{job.issue.title}</div>
            {job.issue.problem && (
              <div className="text-xs text-muted-foreground">{job.issue.problem}</div>
            )}
            {job.issue.solution && (
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ {job.issue.solution}
              </div>
            )}
          </div>
        )}
        
        {job.task && (
          <div className="mt-2 p-2 rounded border border-blue-500/20 bg-blue-50/20 dark:bg-blue-950/10">
            <div className="text-xs font-medium text-foreground mb-1">Task: {job.task.description}</div>
            {job.task.subtasks && job.task.subtasks.length > 0 && (
              <div className="mt-1 space-y-0.5 pl-3 border-l-2 border-blue-500/20">
                {job.task.subtasks.map((sub, i) => (
                  <div key={sub.id || i} className="text-xs text-muted-foreground flex items-center gap-1">
                    {sub.status === 'completed' ? <CheckCircle size={10} className="text-green-500" /> : <Circle size={10} className="opacity-40" />}
                    {sub.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Props & Main Component
// ============================================================

interface AgentJobOperationProps {
  data: {
    job?: OperationData;
  };
}

export function AgentJobOperation({ data }: AgentJobOperationProps) {
  const jobData = data.job || null;
  if (!jobData) return null;
  return <OperationView job={jobData} />;
}

export default AgentJobOperation;
