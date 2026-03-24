/**
 * AgentJobsManager - Job State Manager (Domain Layer)
 * 
 * Manages job state derived from tool-result events.
 * This is the domain layer - tools depend on this, not vice versa.
 * 
 * Responsibilities:
 * - Initialize job state from tool-result events
 * - Store and retrieve jobs
 * - Query jobs by status
 * - Provide job snapshots for UI
 */

import type { AgentMetadata } from '../types';

// ============================================================
// Domain Types
// ============================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type IssueStatus = 'open' | 'resolved' | 'verified';

export interface Subtask {
  id: string;
  taskId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  subtasks: Subtask[];
  createdAt: string;
  completedAt?: string;
}

export interface Issue {
  id: string;
  jobId: string;
  taskId?: string;
  title: string;
  problem: string;
  solution?: string;
  context?: string;
  status: IssueStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface JobMetadata {
  stableMetadata: AgentMetadata;        // Aggregated metadata from all completed turns
  activeTurnId: string | null;  // Current turn being aggregated
  activeMetadata: AgentMetadata;        // Metadata snapshot for the active turn
}

export interface Job {
  id: string;
  turnId: string;             // Turn ID - relates job to its origin turn
  title: string;
  description: string;
  tasks: Task[];
  issues: Issue[];
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  jobMetadata?: JobMetadata;  // Job-scoped metadata (stable + active, excluded from snapshot)
}

export interface JobSnapshot extends Omit<Job, 'tasks' | 'issues' | 'jobMetadata'> {
  tasks: Array<{ id: string; description: string; status: TaskStatus; subtasks?: Array<{ id: string; description: string; status: 'pending' | 'in_progress' | 'completed' }> }>;
  issues: Array<{ id: string; title: string; status: IssueStatus; taskId?: string; problem?: string; solution?: string }>;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  openIssues: number;
  resolvedIssues: number;
}

// ============================================================
// Configuration
// ============================================================

const API_ENDPOINT = '/api/agent/events?type=tool-effects&server=agent-job';

/**
 * AgentJobsManager
 * Manages job state and lifecycle
 */
export class AgentJobsManager {
  private jobs: Map<string, Job> = new Map();
  private initPromise: Promise<void> | null = null;
  private initialized: boolean = false;

  /**
   * Initialize job state from tool-result events
   * Called lazily on first job operation
   */
  private async initialize(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    
    if (this.initialized) {
      return;
    }
    
    this.initPromise = this.fetchAndRehydrateJobs();
    await this.initPromise;
  }

  /**
   * Fetch tool-effects events and rebuild job state
   */
  private async fetchAndRehydrateJobs(): Promise<void> {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const response = await fetch(new URL(API_ENDPOINT, baseUrl).toString());
      
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`);
      }
      
      const { events } = await response.json();
      
      // Rebuild job state from tool-effects sessionComponents
      this.rehydrateJobsFromToolEffects(events);
      
      this.initialized = true;
    } catch (error) {
      console.error('[AgentJobsManager] Failed to initialize jobs:', error);
      throw error;
    }
  }

  /**
   * Rebuild job state from tool-effects events (raw SessionEvent[])
   * Extracts job + jobMetadata from sessionComponents (agent-job-dashboard)
   * Events are DESC ordered, so first occurrence per job is the latest state
   */
  private rehydrateJobsFromToolEffects(events: Array<{ data?: { toolEffects?: { sessionComponents?: Array<{ type?: string; data?: { job?: Job; jobMetadata?: unknown; jobId?: string } }> } } }>): void {
    // Track which jobs we've already processed (first = latest due to DESC order)
    const processedJobs = new Set<string>();

    for (const event of events) {
      // Raw SessionEvent format: data.toolEffects.sessionComponents
      const toolEffects = event.data?.toolEffects;
      const sessionComponents = toolEffects?.sessionComponents;
      if (!Array.isArray(sessionComponents)) continue;

      // Find dashboard components (contain job + jobMetadata)
      for (const component of sessionComponents) {
        if (component.type !== 'agent-job-dashboard') continue;
        
        const { job, jobMetadata, jobId } = component.data || {};
        if (!job || !jobId) continue;

        // Skip if already processed (we want the latest = first occurrence)
        if (processedJobs.has(jobId)) continue;
        processedJobs.add(jobId);

        // Restore job state
        this.jobs.set(jobId, job);

        // Restore pre-computed jobMetadata directly (no re-aggregation needed)
        if (jobMetadata) {
          const storedJob = this.jobs.get(jobId);
          if (storedJob) {
            storedJob.jobMetadata = {
              stableMetadata: jobMetadata as AgentMetadata,
              activeTurnId: null,
              activeMetadata: {} as AgentMetadata,
            };
          }
        }
      }
    }
  }

  /**
   * Ensure jobs are loaded before access
   * Triggers lazy initialization on first call
   */
  async ensureInitialized(): Promise<void> {
    if (!this.initialized && !this.initPromise) {
      await this.initialize();
    } else if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Get job by ID
   * Waits for initialization if needed
   */
  async getJob(jobId: string): Promise<Job | undefined> {
    await this.ensureInitialized();
    return this.jobs.get(jobId);
  }

  /**
   * Store/update job in memory
   * Called by tool handlers after operations
   */
  setJob(job: Job): void {
    this.jobs.set(job.id, job);
  }

  /**
   * Delete job from memory
   */
  deleteJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Check if job exists
   * Waits for initialization to prevent race conditions
   */
  async hasJob(jobId: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.jobs.has(jobId);
  }

  /**
   * Get all jobs
   * Waits for initialization if needed
   */
  async getAllJobs(): Promise<Job[]> {
    await this.ensureInitialized();
    return Array.from(this.jobs.values());
  }

  /**
   * Query jobs with filters
   */
  async findJobs(filter?: { status?: JobStatus }): Promise<Job[]> {
    const allJobs = await this.getAllJobs();
    
    if (!filter?.status) return allJobs;
    
    return allJobs.filter(job => job.status === filter.status);
  }

  /**
   * Get jobs grouped by status (single-pass)
   */
  async getJobsByStatus(): Promise<Record<JobStatus, Job[]>> {
    const allJobs = await this.getAllJobs();
    
    const grouped: Record<JobStatus, Job[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      cancelled: [],
    };
    
    for (const job of allJobs) {
      grouped[job.status].push(job);
    }
    
    return grouped;
  }

  /**
   * Aggregate turn metadata into job metadata using stable/active pattern
   * Prevents double-counting within a turn and maintains cumulative totals
   * 
   * @param jobId - Job ID
   * @param turnId - Turn ID (for deduplication)
   * @param turnMetadata - Turn-scoped metadata snapshot
   * @returns Computed metadata for components (merge of stable + active)
   */
  aggregateMetadata(jobId: string, turnId: string, turnMetadata: AgentMetadata): AgentMetadata | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    // Initialize jobMetadata if not present
    if (!job.jobMetadata) {
      job.jobMetadata = {
        stableMetadata: {},
        activeTurnId: null,
        activeMetadata: {},
      };
    }

    const jm = job.jobMetadata;

    // If this is a new turn (different from active turn)
    if (turnId !== jm.activeTurnId) {
      // Commit previous active turn into stable (if any)
      if (jm.activeTurnId) {
        jm.stableMetadata = this.mergeMetadata(jm.stableMetadata, jm.activeMetadata);
      }
      
      // Set new active turn
      jm.activeTurnId = turnId;
      jm.activeMetadata = turnMetadata;
    } else {
      // Same turn: just update activeMetadata with latest snapshot
      jm.activeMetadata = turnMetadata;
    }

    // Return computed metadata for components (stable + active merged)
    return this.mergeMetadata(jm.stableMetadata, jm.activeMetadata);
  }

  /**
   * Merge two metadata objects
   * Used for combining stable and active metadata
   */
  private mergeMetadata(target: AgentMetadata, source: AgentMetadata): AgentMetadata {
    if (!source) return target;
    if (!target) return source;

    const result = { ...target };

    // Aggregate usage (overwrite with latest)
    if (source.usage) {
      result.usage = source.usage;
    }

    // Aggregate turn-scoped totals (sum per-turn values)
    if (source.modelCallsCount !== undefined) {
      result.modelCallsCount = (result.modelCallsCount || 0) + source.modelCallsCount;
    }
    if (source.totalModelCallDuration !== undefined) {
      result.totalModelCallDuration = (result.totalModelCallDuration || 0) + source.totalModelCallDuration;
    }
    if (source.totalToolsExecutionDuration !== undefined) {
      result.totalToolsExecutionDuration = (result.totalToolsExecutionDuration || 0) + source.totalToolsExecutionDuration;
    }
    if (source.agentTurnDuration !== undefined) {
      result.agentTurnDuration = (result.agentTurnDuration || 0) + source.agentTurnDuration;
    }

    // Aggregate native tools metadata
    if (source.nativeTools) {
      if (!result.nativeTools) result.nativeTools = [];
      
      for (const sourceTool of source.nativeTools) {
        const existingTool = result.nativeTools.find((t: { tool?: string }) => t.tool === sourceTool.tool);
        
        if (existingTool) {
          existingTool.callsCount += sourceTool.callsCount;
          
          // Deep merge tool-specific data
          const sourceData = sourceTool as Record<string, unknown>;
          const existingData = existingTool as Record<string, unknown>;
          
          for (const key of Object.keys(sourceData)) {
            if (key === 'tool' || key === 'callsCount') continue;
            
            if (Array.isArray(sourceData[key])) {
              if (!existingData[key]) existingData[key] = [];
              (existingData[key] as unknown[]).push(...sourceData[key] as unknown[]);
            } else if (typeof sourceData[key] === 'object' && sourceData[key] !== null) {
              if (!existingData[key]) existingData[key] = {};
              Object.assign(existingData[key] as Record<string, unknown>, sourceData[key] as Record<string, unknown>);
            } else {
              existingData[key] = sourceData[key];
            }
          }
        } else {
          result.nativeTools.push({ ...sourceTool });
        }
      }
    }

    // Aggregate MCP tools metadata
    if (source.mcpTools) {
      if (!result.mcpTools) result.mcpTools = [];
      
      for (const sourceTool of source.mcpTools) {
        const existingTool = result.mcpTools.find((t: { server?: string; tool?: string }) => t.server === sourceTool.server && t.tool === sourceTool.tool);
        
        if (existingTool) {
          existingTool.callsCount += sourceTool.callsCount;
          existingTool.totalExecutionTime = (existingTool.totalExecutionTime || 0) + sourceTool.totalExecutionTime;
        } else {
          result.mcpTools.push({ ...sourceTool });
        }
      }
    }

    return result;
  }

  /**
   * Finalize job metadata when job completes
   * Commits active metadata into stable, clearing active state
   */
  finalizeJobMetadata(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job?.jobMetadata) return;

    const jm = job.jobMetadata;
    
    // Commit active turn into stable
    if (jm.activeTurnId) {
      jm.stableMetadata = this.mergeMetadata(jm.stableMetadata, jm.activeMetadata);
      jm.activeTurnId = null;
      jm.activeMetadata = {} as AgentMetadata;
    }
  }

  /**
   * Get job snapshot for UI/agent
   * Includes computed stats and simplified structure (single-pass)
   * Note: jobMetadata is excluded from snapshot
   */
  getJobSnapshot(job: Job): JobSnapshot {
    const issues = job.issues || [];
    
    // Single-pass task stats with subtasks
    const taskCounts = { pending: 0, in_progress: 0, completed: 0 };
    const taskSnapshots: JobSnapshot['tasks'] = [];
    
    for (const t of job.tasks) {
      taskCounts[t.status]++;
      taskSnapshots.push({
        id: t.id,
        description: t.description,
        status: t.status,
        subtasks: t.subtasks?.map(s => ({
          id: s.id,
          description: s.description,
          status: s.status,
        })),
      });
    }
    
    // Single-pass issue stats with details
    let openIssues = 0;
    let resolvedIssues = 0;
    const issueSnapshots: JobSnapshot['issues'] = [];
    
    for (const i of issues) {
      if (i.status === 'open') openIssues++;
      else resolvedIssues++;
      issueSnapshots.push({
        id: i.id,
        title: i.title,
        status: i.status,
        taskId: i.taskId,
        problem: i.problem,
        solution: i.solution,
      });
    }
    
    return {
      id: job.id,
      turnId: job.turnId,
      title: job.title,
      description: job.description,
      status: job.status,
      tasks: taskSnapshots,
      totalTasks: job.tasks.length,
      completedTasks: taskCounts.completed,
      pendingTasks: taskCounts.pending,
      inProgressTasks: taskCounts.in_progress,
      issues: issueSnapshots,
      openIssues,
      resolvedIssues,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  /**
   * Check if a job can be completed
   * Returns result with status and details for workflow decision-making
   */
  async checkJobCompletable(jobId: string): Promise<{
    canComplete: boolean;
    reason: 'not_found' | 'already_terminal' | 'tasks_incomplete' | 'all_complete';
    incompleteTasks?: Array<{ id: string; description: string; status: TaskStatus }>;
    job?: JobSnapshot;
  }> {
    const job = await this.getJob(jobId);
    
    if (!job) {
      return { canComplete: true, reason: 'not_found' };
    }
    
    // Already terminal
    if (job.status === 'completed' || job.status === 'cancelled') {
      return { 
        canComplete: true, 
        reason: 'already_terminal',
        job: this.getJobSnapshot(job),
      };
    }
    
    // Check for incomplete tasks
    const incompleteTasks = job.tasks.filter(t => t.status !== 'completed');
    
    if (incompleteTasks.length === 0) {
      // All tasks complete - mark job as complete
      job.status = 'completed';
      job.updatedAt = new Date().toISOString();
      this.setJob(job);
      return { 
        canComplete: true, 
        reason: 'all_complete',
        job: this.getJobSnapshot(job),
      };
    }
    
    // Has incomplete tasks
    return {
      canComplete: false,
      reason: 'tasks_incomplete',
      incompleteTasks: incompleteTasks.map(t => ({
        id: t.id,
        description: t.description,
        status: t.status,
      })),
      job: this.getJobSnapshot(job),
    };
  }

  /**
   * Get initialization status
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get job count
   */
  getJobCount(): number {
    return this.jobs.size;
  }

  /**
   * Revert a task's status from completed back to pending
   * Used when peer review rejects a task completion
   * 
   * @param jobId - Job ID
   * @param taskId - Task ID to revert
   * @returns true if reverted, false if task not found or not completed
   */
  async revertTaskStatus(jobId: string, taskId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) return false;

    const task = job.tasks.find(t => t.id === taskId);
    if (!task || task.status !== 'completed') return false;

    // Revert task to pending
    task.status = 'pending';
    task.completedAt = undefined;

    // If job was completed, revert to in_progress
    if (job.status === 'completed') {
      job.status = 'in_progress';
    }

    job.updatedAt = new Date().toISOString();
    this.setJob(job);

    console.log(`[AgentJobsManager] Reverted task ${taskId} to pending`);
    return true;
  }
}
