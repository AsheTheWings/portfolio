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
    <div className="flex w-full h-[200px] justify-center items-center">
      <div className="session-component">
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
