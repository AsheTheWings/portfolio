'use client';

/**
 * BackgroundJobInterface - Split-view interface for background job mode
 * 
 * Peer-level interface to ChatInterface and SideBySideInterface
 * Two-panel layout:
 * - Dashboard (left): Job component in backgroundJob mode
 * - Actions (right): All non-message components routed through ComponentResolver
 * 
 * Component routing is managed through resolveComponent with backgroundJob mode
 * Background job state is derived from components with isBackgroundJob flag
 */

import React, { useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/features/shared/components/shadcn/button';
import { useAgent } from '../hooks/useAgent';
import { resolveComponent } from './ComponentResolver';
import { useStickyScroll } from '../hooks/useStickyScroll';

interface BackgroundJobInterfaceProps {
  jobId: string;
  onBack?: () => void;
}

export function BackgroundJobInterface({ jobId, onBack }: BackgroundJobInterfaceProps) {
  const { sessionComponents } = useAgent();
  
  // Filter components for this specific job
  const jobComponents = useMemo(() => 
    sessionComponents.filter(c => c.data.jobId === jobId),
  [sessionComponents, jobId]);
  
  // Find job title from agent-job-dashboard component
  const jobTitle = useMemo(() => {
    const jobComponent = jobComponents.find(c => c.type === 'agent-job-dashboard');
    const job = jobComponent?.data?.job as Record<string, unknown>;
    if (job?.title) {
      return job.title;
    }
    return 'Background Job';
  }, [jobComponents]);

  // Auto-scroll for actions panel
  const { scrollRef: actionsScrollRef } = useStickyScroll(jobComponents.length);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-4">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ChevronLeft size={16} />
            Back
          </Button>
        )}
        <div className="flex-1 text-center">
          <h2 className="text-lg font-semibold">{jobTitle}</h2>
        </div>
        {/* Spacer for centering when back button is shown */}
        {onBack && <div className="w-20" />}
      </div>

      {/* Split Content */}
      <div className="flex-1 grid grid-cols-2 divide-x overflow-hidden">
        {/* Dashboard - Left */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-4 scrollbar-inner">
            {jobComponents.length > 0 ? (
              jobComponents.map(component => {
                const rendered = resolveComponent(component, { mode: 'backgroundJob-dashboard' });
                return rendered ? (
                  <div key={component.id} className="w-full">
                    {rendered}
                  </div>
                ) : null;
              })
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No job data available
              </div>
            )}
          </div>
        </div>

        {/* Actions - Right */}
        <div className="flex flex-col overflow-hidden">
          <div ref={actionsScrollRef} className="flex-1 overflow-y-auto p-2 py-6 space-y-4 scrollbar-inner">
            {jobComponents.length > 0 ? (
              jobComponents.map(component => {
                const rendered = resolveComponent(component, { mode: 'backgroundJob-actions' });
                return rendered ? (
                  <div key={component.id} className="w-full">
                    {rendered}
                  </div>
                ) : null;
              })
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No actions yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
