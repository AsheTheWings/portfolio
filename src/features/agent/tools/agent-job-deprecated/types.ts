/**
 * Type definitions for Agent Job UI components
 */

import type { AgentMetadata, UsageMetrics } from '@/features/agent/types';

// Re-export for component use
export type { AgentMetadata, UsageMetrics };

export interface SubtaskData {
  id?: string;
  description: string;
  status?: 'pending' | 'completed';
}

export interface TaskData {
  id?: string;
  description: string;
  status?: 'pending' | 'in_progress' | 'completed';
  subtasks?: SubtaskData[];
}

export interface IssueData {
  id?: string;
  title: string;
  problem?: string;
  solution?: string;
  context?: string;
  status: 'open' | 'resolved' | 'verified';
  taskId?: string;
}

export interface JobData {
  id?: string;
  title: string;
  description: string;
  tasks?: TaskData[];
  issues?: IssueData[];
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
  totalTasks?: number;
  completedTasks?: number;
  pendingTasks?: number;
  inProgressTasks?: number;
  openIssues?: number;
  resolvedIssues?: number;
  metrics?: AgentMetadata;
}

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

export interface ToolStats {
  totalExecutions: number;
  allTools: BarChartItem[];
  slowest: { name: string; avgTime: number } | null;
}
