'use client';

/**
 * Statistics Panel - Charts and metrics visualization
 */

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentMetadata, UsageMetrics, BarChartItem, ToolStats } from './types';
import { formatDuration } from './shared';

// ============================================================
// Horizontal Bar Chart
// ============================================================

export const HorizontalBarChart = ({ 
  items, 
  title,
  maxBars = 6,
  formatValue = (v: number) => String(v),
}: { 
  items: BarChartItem[];
  title: string;
  maxBars?: number;
  formatValue?: (value: number) => string;
}) => {
  if (items.length === 0) return null;
  
  const sortedItems = [...items].sort((a, b) => b.value - a.value).slice(0, maxBars);
  const maxValue = Math.max(...sortedItems.map(i => i.value));
  
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
  ];

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</h4>
      <div className="space-y-1.5">
        {sortedItems.map((item, idx) => (
          <div key={item.label} className="group">
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-muted-foreground truncate max-w-[120px]" title={item.label}>
                {item.label}
              </span>
              <span className="font-medium tabular-nums ml-2">{formatValue(item.value)}</span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all duration-300", item.color || colors[idx % colors.length])}
                style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// Token Usage Display
// ============================================================

export const TokenUsageDisplay = ({ usage }: { usage: UsageMetrics }) => {
  const total = usage.totalTokens || ((usage.inputTokens || 0) + (usage.outputTokens || 0));
  const maxTokens = usage.maxTokens || total; // Fallback to total if no max
  
  // Calculate percentages relative to max context window
  const inputPercent = maxTokens > 0 ? ((usage.inputTokens || 0) / maxTokens) * 100 : 0;
  const outputPercent = maxTokens > 0 ? ((usage.outputTokens || 0) / maxTokens) * 100 : 0;
  const usedPercent = maxTokens > 0 ? (total / maxTokens) * 100 : 0;
  
  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Token Usage</h4>
      
      {/* Total usage bar - same style as tool calls */}
      <div className="space-y-1.5">
        <div className="group">
          <div className="flex items-center justify-between text-[11px] mb-0.5">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium tabular-nums ml-2">
              {formatTokens(total)} / {formatTokens(maxTokens)} ({usedPercent.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 bg-muted/30 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${inputPercent}%` }}
            />
            <div 
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${outputPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Legend with values */}
      <div className={cn("grid gap-2", usage.thinkingTokens ? "grid-cols-3" : "grid-cols-2")}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <div>
            <p className="text-[10px] text-muted-foreground">Input</p>
            <p className="text-sm font-semibold">{formatTokens(usage.inputTokens || 0)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <div>
            <p className="text-[10px] text-muted-foreground">Output</p>
            <p className="text-sm font-semibold">{formatTokens(usage.outputTokens || 0)}</p>
          </div>
        </div>
        {usage.thinkingTokens !== undefined && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            <div>
              <p className="text-[10px] text-muted-foreground">Thinking</p>
              <p className="text-sm font-semibold">{formatTokens(usage.thinkingTokens)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Cache stats if available */}
      {(usage.cacheReadTokens || usage.cacheCreationTokens) && (
        <div className="pt-2 border-t border-border/30 grid grid-cols-2 gap-2 text-[10px]">
          {usage.cacheReadTokens !== undefined && (
            <div>
              <p className="text-muted-foreground">Cache Read</p>
              <p className="font-medium">{formatTokens(usage.cacheReadTokens)}</p>
            </div>
          )}
          {usage.cacheCreationTokens !== undefined && (
            <div>
              <p className="text-muted-foreground">Cache Created</p>
              <p className="font-medium">{formatTokens(usage.cacheCreationTokens)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Stats Panel (Main Export)
// ============================================================

interface StatsPanelProps {
  metrics: AgentMetadata;
  toolStats: ToolStats | null;
  liveTimers?: {
    modelCallDuration: string;
    toolsExecutionDuration: string;
  };
}

export const StatsPanel = ({ 
  metrics,
  toolStats,
  liveTimers
}: StatsPanelProps) => {
  const hasAnyStats = metrics.modelCallsCount || metrics.usage || toolStats;
  if (!hasAnyStats) return null;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-4 space-y-6">
      <div className="flex items-center gap-2 text-sm font-medium">
        <BarChart3 size={16} className="text-muted-foreground" />
        <span>Statistics</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Model & Timing Stats */}
        <div className="space-y-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model Performance</h4>
          <div className="grid grid-cols-2 gap-3">
            {metrics.modelCallsCount !== undefined && (
              <div>
                <p className="text-[10px] text-muted-foreground">Model Calls</p>
                <p className="text-lg font-semibold">{metrics.modelCallsCount}</p>
              </div>
            )}
            {metrics.totalModelCallDuration !== undefined && (
              <div>
                <p className="text-[10px] text-muted-foreground">Total API Time</p>
                <p className="text-lg font-semibold">{liveTimers?.modelCallDuration ?? formatDuration(metrics.totalModelCallDuration)}</p>
              </div>
            )}
            {metrics.totalToolsExecutionDuration !== undefined && (
              <div>
                <p className="text-[10px] text-muted-foreground">Tools Execution</p>
                <p className="text-lg font-semibold">{liveTimers?.toolsExecutionDuration ?? formatDuration(metrics.totalToolsExecutionDuration)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tool Usage Chart */}
        {toolStats && toolStats.allTools.length > 0 && (
          <div>
            <HorizontalBarChart 
              items={toolStats.allTools}
              title={`Tool Calls (${toolStats.totalExecutions} total)`}
              formatValue={(v) => `${v}×`}
            />
          </div>
        )}

        {/* Token Usage */}
        {metrics.usage && (
          <div>
            <TokenUsageDisplay usage={metrics.usage} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsPanel;
