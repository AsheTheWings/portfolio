'use client';

/**
 * Session Card - Individual session display for concurrent tracking
 * Color-coded, compact timer for each active workload
 */

import { useState, useEffect } from 'react';
import type { Slot } from '../core/types';

// Compact timer component for grid layout
function CompactTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const calculateElapsed = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - start) / 1000);
      setElapsed(elapsedSeconds);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  return (
    <>
      {hours.toString().padStart(2, '0')}:
      {minutes.toString().padStart(2, '0')}:
      {seconds.toString().padStart(2, '0')}
    </>
  );
}

interface SessionCardProps {
  slot: Slot;
  index: number;
  totalSlots: number;
  isNewest?: boolean;
  isOldest?: boolean;
}

// Generate consistent color from workload name (simple hash)
function getWorkloadColor(workloadName: string): string {
  let hash = 0;
  for (let i = 0; i < workloadName.length; i++) {
    hash = workloadName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    'from-green-500/20 to-green-600/10 border-green-500/30',
    'from-orange-500/20 to-orange-600/10 border-orange-500/30',
    'from-pink-500/20 to-pink-600/10 border-pink-500/30',
    'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    'from-red-500/20 to-red-600/10 border-red-500/30',
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

export function SessionCard({ slot, index, totalSlots, isNewest, isOldest }: SessionCardProps) {
  const colorClass = getWorkloadColor(slot.workload_name);
  const formattedDate = new Date(slot.start_time).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div 
      className={`max-w-[320px] relative bg-gradient-to-br ${colorClass} border rounded-xl p-6 shadow-depth-lg hover:shadow-depth-xl transition-all duration-300 hover:-translate-y-1 opacity-0 animate-fade-slide-in`}
      style={{
        animationDelay: `${index * 100}ms`,
      }}
    >
      {/* Badge for newest/oldest */}
      {(isNewest || isOldest) && (
        <div className="absolute top-3 right-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            isNewest 
              ? 'bg-primary/20 text-primary border border-primary/30' 
              : 'bg-foreground-muted/20 text-foreground-muted border border-foreground-muted/30'
          }`}>
            {isNewest ? '✨ Latest' : '⏱️ Oldest'}
          </span>
        </div>
      )}

      {/* Workload Name */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-foreground truncate pr-20">
          {slot.workload_name}
        </h3>
        <p className="text-sm text-foreground-muted mt-1">
          Started at {formattedDate}
        </p>
      </div>

      {/* Compact Timer */}
      <div className="mb-4">
        <div className="font-mono text-center">
          <div className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            <CompactTimer startTime={slot.start_time} />
          </div>
        </div>
      </div>

      {/* Stop hint */}
      <div className="text-center">
        <code className="text-xs px-2 py-1 bg-surface-1/50 rounded text-foreground-muted">
          stop
        </code>
      </div>

    </div>
  );
}
