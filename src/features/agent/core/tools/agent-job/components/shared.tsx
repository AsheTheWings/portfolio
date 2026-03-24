'use client';

/**
 * Shared UI components for Agent Job Dashboard
 */

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Utilities
// ============================================================

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ============================================================
// Copy Button
// ============================================================

export const CopyButton = ({ text, size = 12 }: { text: string; size?: number }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      title="Copy ID"
    >
      <span className="font-mono text-[10px]">{text}</span>
      {copied ? <Check size={size} className="text-green-500" /> : <Copy size={size} />}
    </button>
  );
};

// ============================================================
// Status Pill
// ============================================================

export const StatusPill = ({ status }: { status: string }) => {
  const config = {
    pending: { bg: 'bg-slate-500/10', text: 'text-slate-500', dot: 'bg-slate-400' },
    in_progress: { bg: 'bg-blue-500/10', text: 'text-blue-500', dot: 'bg-blue-400 animate-pulse' },
    completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-400' },
    cancelled: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  }[status] || { bg: 'bg-slate-500/10', text: 'text-slate-500', dot: 'bg-slate-400' };

  const label = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }[status] || status;

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium", config.bg, config.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {label}
    </span>
  );
};

// ============================================================
// Progress Ring
// ============================================================

export const ProgressRing = ({ 
  progress, 
  size = 48, 
  strokeWidth = 4,
  className 
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  className?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-muted/30"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-emerald-500 transition-all duration-500 ease-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold tabular-nums">{progress}%</span>
      </div>
    </div>
  );
};

// ============================================================
// Metric Card
// ============================================================

export const MetricCard = ({
  icon,
  label,
  value,
  subValue,
  variant = 'default'
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'info' | 'purple';
}) => {
  const variants = {
    default: 'from-slate-500/5 to-slate-500/0 border-slate-500/10',
    success: 'from-emerald-500/10 to-emerald-500/0 border-emerald-500/20',
    warning: 'from-amber-500/10 to-amber-500/0 border-amber-500/20',
    info: 'from-blue-500/10 to-blue-500/0 border-blue-500/20',
    purple: 'from-violet-500/10 to-violet-500/0 border-violet-500/20',
  };

  const iconColors = {
    default: 'text-slate-500',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
    purple: 'text-violet-500',
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4",
      variants[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
        </div>
        <div className={cn("p-2 rounded-lg bg-background/50", iconColors[variant])}>
          {icon}
        </div>
      </div>
    </div>
  );
};
