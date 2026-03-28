/**
 * useJobActions - Hook for job action buttons visibility and handlers
 * 
 * Determines whether to show View Actions and Terminate buttons
 * based on component's job context and current store state.
 */

import { useMemo } from 'react';
import { useAgent } from '../../contexts/AgentContext';

interface UseJobActionsParams {
  componentId: string;
  jobId?: string;
  isBackground?: boolean;  // Domain: was this created during background execution?
}

interface UseJobActionsResult {
  /** Show View Actions button (last component for a background job) */
  showViewActions: boolean;
  /** Show Terminate button (last component for an active job) */
  showTerminate: boolean;
  /** Handler for View Actions button */
  onViewActions: () => void;
  /** Handler for Terminate button */
  onTerminate: () => void;
}

export function useJobActions({
  componentId,
  jobId,
  isBackground,
}: UseJobActionsParams): UseJobActionsResult {
  const { activeJob, selectJob, stopAgent, getLastComponentByJob, sessionComponents } = useAgent();

  // Check if this component is the last one for its job
  // sessionComponents in deps ensures recalculation when components change
  const isLastForJob = useMemo(() => {
    if (!jobId) return false;
    const lastComponentByJob = getLastComponentByJob();
    return lastComponentByJob[jobId] === componentId;
  }, [jobId, componentId, getLastComponentByJob, sessionComponents]);

  // Check if this job is currently active
  const isActiveJob = activeJob?.jobId === jobId;

  return {
    // View Actions: show only if work was done in background mode
    // (no point showing for foreground work - it's already visible)
    showViewActions: isLastForJob && !!isBackground && !!jobId,
    
    // Terminate: show if job is active and this is the last component
    showTerminate: isLastForJob && isActiveJob,
    
    // Handlers
    onViewActions: () => {
      if (jobId) selectJob(jobId);
    },
    onTerminate: () => {
      if (jobId) {
        stopAgent();
      }
    },
  };
}
