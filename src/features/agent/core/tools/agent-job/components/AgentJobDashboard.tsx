'use client';

/**
 * AgentJobDashboard - Modern Job Monitoring Dashboard
 * 
 * Features:
 * - Real-time progress tracking with animated indicators
 * - Collapsible task/subtask hierarchy
 * - Live metrics visualization (model calls, thinking time, etc.)
 * - Polished, modern UI with smooth transitions
 */

import React, { useMemo } from 'react';
import {
  CheckCircle2, Clock, Timer, Activity,
  ListTodo, Bug, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { JobActionBar } from '@/features/agent/core/tools/agent-job/components/JobActionBar';

import type { JobData, AgentMetadata, BarChartItem, ToolStats } from './types';
import { CopyButton, StatusPill, ProgressRing, MetricCard } from './shared';
import { StatsPanel } from './StatsPanel';
import { TaskList } from './TaskList';
import { IssueList } from './IssueList';
import { useLiveTimers } from './hooks';

// ============================================================
// Props
// ============================================================

interface AgentJobDashboardProps {
  data: {
    job?: JobData;
    isBackground?: boolean;
    isSummary?: boolean;
    jobMetadata?: AgentMetadata;
  };
}

// ============================================================
// Helper Components
// ============================================================

interface TasksSectionProps {
  job: JobData;
  completedTasks: number;
  totalTasks: number;
}

const TasksSection = ({ job, completedTasks, totalTasks }: TasksSectionProps) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ListTodo size={16} />
        Tasks
      </div>
      <span className="text-xs text-muted-foreground">
        {completedTasks}/{totalTasks} completed
      </span>
    </div>
    
    {job.tasks && job.tasks.length > 0 ? (
      <div className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden">
        <TaskList tasks={job.tasks} />
      </div>
    ) : (
      <div className="rounded-2xl border-2 border-dashed border-border/40 py-12 text-center text-muted-foreground/50">
        <ListTodo size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No tasks assigned yet</p>
      </div>
    )}
  </div>
);

interface IssuesSectionProps {
  issues: JobData['issues'];
  openIssues: number;
}

const IssuesSection = ({ issues, openIssues }: IssuesSectionProps) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Bug size={16} />
        Issues
      </div>
      <span className="text-xs text-muted-foreground">
        {openIssues} open
      </span>
    </div>
    
    {issues && issues.length > 0 ? (
      <IssueList issues={issues} />
    ) : (
      <div className="rounded-2xl border-2 border-dashed border-border/40 py-12 text-center text-muted-foreground/50">
        <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50 text-emerald-500/50" />
        <p className="text-sm">No issues reported</p>
      </div>
    )}
  </div>
);

// ============================================================
// Dashboard View (Full-screen, for background mode)
// ============================================================

const DashboardView = ({ job, jobMetadata }: { job: JobData; jobMetadata?: AgentMetadata }) => {
  const isActive = job.status === 'in_progress' || job.status === 'pending';
  const timers = useLiveTimers(jobMetadata, isActive);
  
  const totalTasks = job.totalTasks || job.tasks?.length || 0;
  const completedTasks = job.completedTasks || 0;
  const inProgressTasks = job.inProgressTasks || job.tasks?.filter(t => t.status === 'in_progress').length || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const openIssues = job.openIssues || 0;
  const resolvedIssues = job.resolvedIssues || 0;
  const hasIssues = job.issues && job.issues.length > 0;
  
  const metrics: AgentMetadata = jobMetadata || {};

  // Calculate subtask stats
  const subtaskStats = useMemo(() => {
    if (!job.tasks) return { total: 0, completed: 0, inProgress: 0 };
    return job.tasks.reduce((acc, task) => {
      const subs = task.subtasks || [];
      const completed = subs.filter(s => s.status === 'completed').length;
      return {
        total: acc.total + subs.length,
        completed: acc.completed + completed,
        inProgress: acc.inProgress + (subs.length - completed)
      };
    }, { total: 0, completed: 0, inProgress: 0 });
  }, [job.tasks]);

  // Compute derived tool stats (both native and MCP tools)
  const toolStats = useMemo((): ToolStats | null => {
    const mcpTools = metrics.mcpTools || [];
    const nativeTools = metrics.nativeTools || [];
    
    // Combine all tools into bar chart items
    const allTools: BarChartItem[] = [
      ...mcpTools.map(t => ({
        label: t.tool,
        value: t.callsCount,
        color: 'bg-blue-500',
      })),
      ...nativeTools.map(t => ({
        label: t.tool,
        value: t.callsCount,
        color: 'bg-violet-500',
      })),
    ];
    
    if (allTools.length === 0) return null;
    
    const totalExecutions = allTools.reduce((sum, t) => sum + t.value, 0);
    
    // Find slowest MCP tool (native tools may not have execution time)
    const mcpWithTime = mcpTools.filter(t => t.totalExecutionTime > 0);
    const sortedByTime = [...mcpWithTime].sort((a, b) => 
      (b.totalExecutionTime / b.callsCount) - (a.totalExecutionTime / a.callsCount)
    );
    
    return {
      totalExecutions,
      allTools,
      slowest: sortedByTime[0] ? {
        name: sortedByTime[0].tool,
        avgTime: sortedByTime[0].totalExecutionTime / sortedByTime[0].callsCount,
      } : null,
    };
  }, [metrics.mcpTools, metrics.nativeTools]);

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <header className="flex-shrink-0 px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-6">
            {/* Title Section */}
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  isActive 
                    ? "bg-gradient-to-br from-emerald-500 to-teal-500" 
                    : "bg-gradient-to-br from-emerald-600 to-teal-600"
                )}>
                  {isActive 
                    ? <Activity size={24} className="text-white" />
                    : <CheckCircle2 size={24} className="text-white" />
                  }
                </div>
                {isActive && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-pulse ring-4 ring-background" />
                )}
              </div>
              
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">{job.title}</h1>
                <div className="flex items-center gap-3">
                  <StatusPill status={job.status || 'pending'} />
                  {job.id && <CopyButton text={job.id} />}
                </div>
                {job.description && (
                  <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed mt-2">
                    {job.description}
                  </p>
                )}
              </div>
            </div>

            {/* Timer */}
            <div className={cn(
              "flex flex-row items-center gap-2 px-4 py-2 rounded-xl border whitespace-nowrap",
              isActive 
                ? "bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20"
                : "bg-muted/30 border-border/30"
            )}>
              <Timer size={16} className={cn(isActive && "text-cyan-500 animate-pulse")} />
              <div className="flex flex-col items-start">
                <span className="font-mono text-lg font-bold tabular-nums leading-none">{timers.jobDuration}</span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-wider">
                  {isActive ? 'Elapsed' : 'Duration'}
                </span>
              </div>
            </div>
          </div>

          {/* Main Progress Bar */}
          {totalTasks > 0 && (
            <div className="mt-6 flex items-center gap-4">
              <ProgressRing progress={progressPercent} size={56} strokeWidth={4} />
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-semibold">{completedTasks} of {totalTasks} tasks</span>
                </div>
                <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard 
              icon={<ListTodo size={16} />}
              label="Tasks"
              value={completedTasks}
              subValue={`of ${totalTasks} total`}
              variant="success"
            />
            <MetricCard 
              icon={<Sparkles size={16} />}
              label="Subtasks"
              value={subtaskStats.completed}
              subValue={`of ${subtaskStats.total} total`}
              variant="info"
            />
            <MetricCard 
              icon={<Clock size={16} />}
              label="In Progress"
              value={inProgressTasks}
              subValue={subtaskStats.inProgress > 0 ? `+${subtaskStats.inProgress} subtasks` : undefined}
              variant="default"
            />
            <MetricCard 
              icon={<Bug size={16} />}
              label="Issues"
              value={openIssues}
              subValue={resolvedIssues > 0 ? `${resolvedIssues} resolved` : 'open'}
              variant={openIssues > 0 ? "warning" : "success"}
            />
          </div>

          {/* Statistics Panel */}
          <StatsPanel metrics={metrics} toolStats={toolStats} liveTimers={timers} />

          {/* Tasks & Issues Layout */}
          {hasIssues ? (
            // If issues exist: Issues before Tasks, stacked vertically
            <div className="space-y-8">
              <IssuesSection issues={job.issues} openIssues={openIssues} />
              <TasksSection job={job} completedTasks={completedTasks} totalTasks={totalTasks} />
            </div>
          ) : (
            // If no issues: Tasks first, then Issues below
            <div className="space-y-8">
              <TasksSection job={job} completedTasks={completedTasks} totalTasks={totalTasks} />
              <IssuesSection issues={job.issues} openIssues={openIssues} />
            </div>
          )}

          {/* Action Bar */}
          <div className="pt-4">
            <JobActionBar />
          </div>
        </div>
      </main>
    </div>
  );
};

// ============================================================
// Main Export
// ============================================================

export function AgentJobDashboard({ data }: AgentJobDashboardProps) {
  const jobData = data.job || null;
  if (!jobData) return null;

  return <DashboardView job={jobData} jobMetadata={data.jobMetadata} />;
}

export default AgentJobDashboard;
