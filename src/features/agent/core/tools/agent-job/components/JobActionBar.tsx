'use client';

/**
 * JobActionBar - Floating action buttons for background jobs
 * 
 * Renders View Actions and Terminate buttons on the last component
 * related to a job. Appears on MessageBubble, AgentJobCreation, etc.
 */

import { Eye, Ban } from 'lucide-react';
import { useControls } from '../../../../contexts/SessionComponentContext';
import { useJobActions } from './useJobActions';

export function JobActionBar() {
  const { componentId, data } = useControls();
  const { showViewActions, showTerminate, onViewActions, onTerminate } = useJobActions({
    componentId,
    jobId: data.jobId,
    isBackground: data.isBackground,
  });

  // Don't render if no buttons to show
  if (!showViewActions && !showTerminate) {
    return null;
  }

  return (
    <div className="flex items-center gap-6 mt-8">
      {showViewActions && (
        <button
          onClick={onViewActions}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="View Actions"
        >
          <Eye size={12} />
          <span>View Actions</span>
        </button>
      )}
      {showTerminate && (
        <button
          onClick={onTerminate}
          className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          title="Terminate"
        >
          <Ban size={12} />
          <span>Terminate</span>
        </button>
      )}
    </div>
  );
}
