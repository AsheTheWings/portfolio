'use client';

/**
 * ResumeWorkflow — system-level recovery affordance for aborted workflow runs.
 *
 * Workflow continuation is session-scoped, not owned by any agent message.
 */

import { FeedbackPanel } from './FeedbackPanel';
import { useWorkflow } from '../hooks/useWorkflow';
import type { FeedbackAction } from '../types';

const RESUME_WORKFLOW_ACTIONS: FeedbackAction[] = [
  { id: 'resume', label: 'Resume workflow', primary: true, icon: 'Play' },
];

export function ResumeWorkflow() {
  const { resumeWorkflow } = useWorkflow();

  return (
    <div className="flex w-full justify-center">
      <div className="session-component rounded-2xl bg-white dark:bg-surface-1 text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <FeedbackPanel
          prompt="Workflow was aborted"
          actions={RESUME_WORKFLOW_ACTIONS}
          layout="horizontal"
          stackPrompt
          onAction={resumeWorkflow}
        />
      </div>
    </div>
  );
}
