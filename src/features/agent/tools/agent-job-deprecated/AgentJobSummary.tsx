'use client';

/**
 * AgentJobSummary - Compact Job Summary for Chat View
 * 
 * Features:
 * - Compact progress tracking for foreground mode
 * - Quick task/subtask overview
 * - Issue status indicators
 */

import React, { useMemo } from 'react';
import {
  CheckCircle2, Timer, Activity,
  ListTodo, Bug
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { JobActionBar } from './JobActionBar';

import type { JobData, AgentMetadata } from './types';
import { CopyButton, StatusPill, ProgressRing } from './shared';
import { TaskList } from './TaskList';
import { IssueList } from './IssueList';
import { useLiveTimers } from './hooks';

interface AgentJobSummaryProps {
  data: {
    job?: JobData;
    jobMetadata?: AgentMetadata;
  };
}

export function AgentJobSummary({ data }: AgentJobSummaryProps) {
  const job = data.job;

  const isActive = job?.status === 'in_progress' || job?.status === 'pending';
  const timers = useLiveTimers(data.jobMetadata, isActive);

  // Calculate subtask stats
  const subtaskStats = useMemo(() => {
    if (!job?.tasks) return { total: 0, completed: 0 };
    return job.tasks.reduce((acc, task) => {
      const subs = task.subtasks || [];
      return {
        total: acc.total + subs.length,
        completed: acc.completed + subs.filter(s => s.status === 'completed').length
      };
    }, { total: 0, completed: 0 });
  }, [job?.tasks]);

  if (!job) return null;
  
  const totalTasks = job.totalTasks || job.tasks?.length || 0;
  const completedTasks = job.completedTasks || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const openIssues = job.openIssues || job.issues?.filter(i => i.status === 'open').length || 0;
  const hasIssues = job.issues && job.issues.length > 0;

  return (
    <div className="session-component flex justify-start w-full">
      <div className="w-full max-w-[76%] rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-white to-emerald-50/30 dark:from-surface-1 dark:to-emerald-950/10 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-emerald-500/10 bg-gradient-to-br from-white to-emerald-50/30 dark:from-surface-1 dark:to-emerald-950/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isActive ? (
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Activity size={16} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse ring-2 ring-white dark:ring-surface-1" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm text-foreground">{job.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusPill status={job.status || 'pending'} />
                  {job.id && <CopyButton text={job.id} />}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Timer size={12} className={isActive ? "text-blue-500" : ""} />
                <span className="font-mono text-sm tabular-nums">{timers.jobDuration}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="px-4 py-3 space-y-3">
          {/* Progress Bar */}
          {totalTasks > 0 && (
            <div className="flex items-center gap-3">
              <ProgressRing progress={progressPercent} size={40} strokeWidth={3} />
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Task Progress</span>
                  <span className="font-medium">{completedTasks}/{totalTasks}</span>
                </div>
                <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-xs">
            {subtaskStats.total > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ListTodo size={12} />
                <span>{subtaskStats.completed}/{subtaskStats.total} subtasks</span>
              </div>
            )}
            {hasIssues && (
              <div className={cn(
                "flex items-center gap-1.5",
                openIssues > 0 ? "text-amber-500" : "text-emerald-500"
              )}>
                <Bug size={12} />
                <span>{openIssues > 0 ? `${openIssues} open` : 'All resolved'}</span>
              </div>
            )}
          </div>

          {/* Tasks */}
          {job.tasks && job.tasks.length > 0 && (
            <div className="rounded-xl border border-border/30 bg-card/30 overflow-hidden">
              <TaskList tasks={job.tasks} />
            </div>
          )}

          {/* Issues */}
          {hasIssues && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Bug size={12} />
                Issues ({job.issues!.length})
              </div>
              <IssueList issues={job.issues!} maxItems={3} />
            </div>
          )}

          {/* Action Bar */}
          <JobActionBar />
        </div>
      </div>
    </div>
  );
}

export default AgentJobSummary;
