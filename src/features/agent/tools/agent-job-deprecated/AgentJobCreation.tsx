'use client';

/**
 * AgentJobCreation Component
 * Displays job proposal and creation confirmation in the main chat.
 * - proposal: Initial job proposal awaiting user approval
 * - created: Static summary of created job
 */

import React, { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { JobActionBar } from './JobActionBar';
import type { JobData } from './types';
import { CopyButton } from './shared';

// ============================================================
// Task List (Simple, for proposals)
// ============================================================

const TaskList = ({ tasks }: { tasks: NonNullable<JobData['tasks']> }) => {
  return (
    <div className="space-y-3">
      {tasks.map((task, i) => {
        const t = typeof task === 'string' 
          ? { id: `t-${i}`, description: task as string, subtasks: [] } 
          : task;
          
        return (
          <div key={t.id || i} className="space-y-1">
            <div className="flex items-start gap-2 text-sm group">
              <div className="mt-2 w-1 h-1 rounded-full bg-foreground/40 flex-shrink-0" />
              <div className="flex-1 leading-snug text-foreground">
                {t.description}
                {t.id && (
                  <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground">
                    <CopyButton text={t.id} />
                  </span>
                )}
              </div>
            </div>
            {t.subtasks && t.subtasks.length > 0 && (
              <div className="pl-6 space-y-1">
                {t.subtasks.map((sub, si) => (
                  <div key={sub.id || si} className="flex items-start gap-2 text-xs group">
                    <div className="mt-1.5 w-0.5 h-0.5 rounded-full bg-foreground/30 flex-shrink-0" />
                    <div className="flex-1 leading-snug text-muted-foreground">
                      {sub.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// Proposal View
// ============================================================

const ProposalView = ({ job }: { job: JobData }) => (
  <div className="session-component flex justify-start w-full">
    <div className="w-full max-w-[85%] rounded-xl border border-cyan-500/30 bg-cyan-50/30 dark:bg-cyan-950/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
        <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
          Job Proposal
        </span>
      </div>
      
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-base text-foreground">{job.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
        </div>
        
        {job.tasks && job.tasks.length > 0 && (
          <div className="bg-cyan-500/5 rounded-lg p-3 border border-cyan-500/20">
            <div className="text-xs font-medium text-cyan-600/70 dark:text-cyan-400/70 mb-2 uppercase tracking-wider">
              Proposed Tasks ({job.tasks.length})
            </div>
            <TaskList tasks={job.tasks} />
          </div>
        )}
      </div>
    </div>
  </div>
);

// ============================================================
// Created View
// ============================================================

const CreatedView = ({ job }: { job: JobData }) => {
  const total = job.totalTasks || job.tasks?.length || 0;

  return (
    <div className="session-component flex justify-start w-full">
      <div className="w-full max-w-[76%] rounded-xl border border-green-500/30 bg-green-50/30 dark:bg-green-950/10 p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">
                Job Created
              </span>
              {job.id && (
                <span className="text-[10px] text-muted-foreground bg-background/50 px-1.5 rounded border">
                  <CopyButton text={job.id} />
                </span>
              )}
            </div>
            
            <h3 className="font-semibold text-sm text-foreground">{job.title}</h3>
            
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-muted-foreground font-medium">
                {total} tasks initialized
              </span>
            </div>
          </div>
        </div>

        {job.tasks && job.tasks.length > 0 && (
          <div className="bg-green-500/5 rounded-lg p-3 border border-green-500/20">
            <div className="text-xs font-medium text-green-600/70 dark:text-green-400/70 mb-2 uppercase tracking-wider">
              Initial Tasks ({job.tasks.length})
            </div>
            <TaskList tasks={job.tasks} />
          </div>
        )}
        
        <JobActionBar />
      </div>
    </div>
  );
};

// ============================================================
// Props & Main Component
// ============================================================

interface AgentJobCreationProps {
  data: {
    state?: 'proposal' | 'created';
    proposal?: JobData;
    job?: JobData;
  };
}

export function AgentJobCreation({ data }: AgentJobCreationProps) {
  const jobData: JobData | null = useMemo(() => {
    return data.job || data.proposal || null;
  }, [data]);

  if (!jobData) return null;

  const isApproved = data.state === 'created' || !!jobData.id;

  if (isApproved) {
    return <CreatedView job={jobData} />;
  }

  return <ProposalView job={jobData} />;
}

export default AgentJobCreation;
