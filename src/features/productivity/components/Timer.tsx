'use client';

/**
 * Timer Component - Displays elapsed time in HH:MM:SS format
 */

import { useState, useEffect } from 'react';

interface TimerProps {
  startTime: string;
  className?: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function Timer({ startTime, className = '' }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const calculateElapsed = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - start) / 1000);
      setElapsed(elapsedSeconds);
    };

    // Initial calculation
    calculateElapsed();

    // Update every second
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className={`font-mono ${className}`}>
      <div className="text-4xl md:text-6xl lg:text-8xl font-bold tracking-tight text-foreground">
        {formatDuration(elapsed)}
      </div>
    </div>
  );
}
