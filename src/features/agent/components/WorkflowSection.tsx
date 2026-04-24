'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/components/shadcn';
import { useAgentStore } from '../stores/useAgentStore';
import { saveSelectedWorkflowId } from '../utils/agent-storage';
import { workflowDisplayName } from '../types';
import { WorkflowCard } from './WorkflowCard';
import { useAgentSessionLifecycle } from '../hooks/useAgentSessionLifecycle';

export function WorkflowSection() {
  const workflowsPool = useAgentStore((s) => s.workflowsPool);
  const selectedWorkflowId = useAgentStore((s) => s.selectedWorkflowId);
  const setSelectedWorkflowId = useAgentStore((s) => s.setSelectedWorkflowId);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const { clearAgentSession } = useAgentSessionLifecycle();

  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!workflowsPool.length) return null;

  const handleClick = (id: string) => {
    if (id === selectedWorkflowId) return;
    if (currentSessionId) {
      setPendingId(id);
    } else {
      setSelectedWorkflowId(id);
      saveSelectedWorkflowId(id);
    }
  };

  const handleConfirm = () => {
    if (!pendingId) return;
    clearAgentSession();
    setSelectedWorkflowId(pendingId);
    saveSelectedWorkflowId(pendingId);
    setPendingId(null);
  };

  const pendingName = pendingId ? workflowDisplayName(pendingId) : '';

  return (
    <>
      <div className="px-6 py-4 border-b border-border-subtle">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Workflow
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          {workflowsPool.map((w) => (
            <WorkflowCard
              key={w.id}
              workflow={w}
              isSelected={w.id === selectedWorkflowId}
              onClick={() => handleClick(w.id)}
            />
          ))}
        </div>
      </div>

      <AlertDialog open={pendingId !== null} onOpenChange={(open) => { if (!open) setPendingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {pendingName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the workflow requires starting a new session. Your current session will end
              and a new one will begin with the <strong>{pendingName}</strong> workflow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Start new session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
