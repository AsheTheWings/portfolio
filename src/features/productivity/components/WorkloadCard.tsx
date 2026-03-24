'use client';

/**
 * Workload Card - Displays current workload information
 */

interface WorkloadCardProps {
  workloadName: string;
  startTime: string;
}

export function WorkloadCard({ workloadName, startTime }: WorkloadCardProps) {
  const formattedDate = new Date(startTime).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-surface-1 border border-border-subtle rounded-lg p-6 shadow-depth-md">
      <div className="space-y-3">
        <div>
          <p className="text-sm text-foreground-muted mb-1">Current Workload</p>
          <h2 className="text-2xl font-semibold text-foreground">{workloadName}</h2>
        </div>
        
        <div className="pt-3 border-t border-border-subtle">
          <p className="text-sm text-foreground-muted mb-1">Started At</p>
          <p className="text-base text-foreground">{formattedDate}</p>
        </div>
      </div>
    </div>
  );
}
