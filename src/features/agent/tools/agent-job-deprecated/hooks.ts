/**
 * Hooks for Agent Job components
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAgentStore } from '@/features/agent/stores/useAgentStore';
import { formatDuration } from './shared';
import type { AgentMetadata } from '@/features/agent/types';
import { hasAgentStatus, hasActiveAgent } from '@/features/agent/utils/agent-status';

interface LiveTimers {
  jobDuration: string;
  modelCallDuration: string;
  toolsExecutionDuration: string;
}

/**
 * Live timers for job dashboard
 * Optimistically updates timers based on conversation status:
 * - jobDuration: ticks during any working state
 * - modelCallDuration: ticks during thinking/responding
 * - toolsExecutionDuration: ticks during toolCalling
 * 
 * Timers get corrected when metadata updates arrive.
 */
export function useLiveTimers(
  metadata: AgentMetadata | undefined,
  isJobActive: boolean
): LiveTimers {
  const agentStatuses = useAgentStore((state) => state.agentStatuses);
  const [liveOffset, setLiveOffset] = useState(0);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  
  // Extract base values from metadata
  const baseJobDuration = metadata?.agentTurnDuration || 0;
  const baseModelDuration = metadata?.totalModelCallDuration || 0;
  const baseToolsDuration = metadata?.totalToolsExecutionDuration || 0;
  
  // Create stable key for metadata changes
  const metadataKey = `${baseJobDuration}-${baseModelDuration}-${baseToolsDuration}`;
  
  // Reset offset when metadata changes
  useEffect(() => {
    lastUpdateTimeRef.current = Date.now();
    setLiveOffset(0);
  }, [metadataKey]);
  
  // Determine active states aggregated across all agents
  const isThinkingOrResponding = hasAgentStatus(agentStatuses, 'thinking', 'responding');
  const isToolCalling = hasAgentStatus(agentStatuses, 'toolCalling');
  const isAnyWorking = hasActiveAgent(agentStatuses);
  
  // Live tick when agent is working and job is active
  useEffect(() => {
    if (!isJobActive || !isAnyWorking) {
      setLiveOffset(0);
      return;
    }
    
    const interval = setInterval(() => {
      setLiveOffset(Date.now() - lastUpdateTimeRef.current);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isJobActive, isAnyWorking]);
  
  // Compute live timer values
  return useMemo(() => ({
    jobDuration: formatDuration(baseJobDuration + (isAnyWorking ? liveOffset : 0)),
    modelCallDuration: formatDuration(baseModelDuration + (isThinkingOrResponding ? liveOffset : 0)),
    toolsExecutionDuration: formatDuration(baseToolsDuration + (isToolCalling ? liveOffset : 0)),
  }), [baseJobDuration, baseModelDuration, baseToolsDuration, liveOffset, isAnyWorking, isThinkingOrResponding, isToolCalling]);
}
