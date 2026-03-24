/**
 * Agent Job Tools - Definitions
 * Tool schemas and descriptions for agent-job server
 */

import type { Tool } from '../../../types';
import { handleCreateJob } from './create';
import { handleManageJob } from './manage';

export const agentJobTools: Record<string, Tool> = {
  'create_job': {
    server: 'agent-job',
    tool: 'create',
    handler: handleCreateJob,
    description: `Propose job creation for complex tasks or multi-step workflows.

## When to Use

Use this tool when the user wants to assign a complex task or multi-step workflow. The agent can invoke this when:
- User explicitly mentions "job" or asks to create/start a job
- User describes a complex task requiring multiple steps
- User wants to track a task's progress over time
- A task needs structured planning and execution

## Job Specification

A job proposal must include:
- **title**: Short, descriptive job title (e.g., "Research and summarize React 19 features")
- **description**: Detailed description of what needs to be accomplished. Be thorough and include any important context here.
- **tasks**: Array of specific task descriptions (at least 3 required - use jobs for multi-step workflows)

## How It Works

1. Agent analyzes conversation and proposes a job specification
2. User reviews and can approve, reject, or provide feedback
3. If approved, job is created and can be tracked
4. If feedback is provided, agent refines the proposal and tries again`,
    inputSchema: {
      type: 'object',
      required: ['title', 'description', 'tasks'],
      properties: {
        title: {
          type: 'string',
          description: 'Short, descriptive title for the job',
        },
        description: {
          type: 'string',
          description: 'Detailed description of what the job aims to accomplish',
        },
        tasks: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          description: 'Array of specific task descriptions (at least 3 required for multi-step workflows)',
        },
      },
    },
    source: 'builtIn',
  },

  'manage_job': {
    server: 'agent-job',
    tool: 'manage',
    handler: handleManageJob,
    description: `Manage job tasks, issues, and properties.

## When to Use

Use this tool to manage existing jobs after creation. Supports task management and issue tracking for blockers and learnings.

## Core Principles

**Tasks** represent user-approved work items. You can mark them complete but cannot modify their descriptions.
**Subtasks** are your execution steps for completing a task. You have full control: add, remove, start, and complete subtasks.
**Issues** are for tracking blockers and solutions. Log problems when stuck, document solutions when resolved.

## Required Workflow

**You must use subtasks to perform work.** Before working on any task:
1. Add subtasks to break down the work into concrete steps
2. Start a subtask (set to in_progress) before beginning work on it
3. Complete the subtask when the work is done
4. Repeat for each subtask until the task is complete

## Subtask Decomposition Patterns

**Iteration Pattern** - For tasks involving multiple items:
- Create a subtask for each item to process (e.g., "Analyze feature A", "Analyze feature B")
- Work through each subtask systematically: start → work → complete
- Example task: "Review all API endpoints" → Subtasks: "Review /users endpoint", "Review /auth endpoint", etc.

**Sequential Pattern** - For dependent steps:
- Create subtasks in execution order (e.g., "Research options" → "Evaluate options" → "Implement choice")
- Complete each before starting the next
- Example task: "Implement new feature" → Subtasks: "Design approach", "Write implementation", "Add tests"

**Parallel Pattern** - For independent work:
- Create all subtasks upfront
- Start multiple subtasks that can be worked on concurrently
- Example task: "Update documentation" → Subtasks: "Update README", "Update API docs", "Update changelog"

**Discovery Pattern** - When scope is unclear:
- Start with an exploration subtask (e.g., "Investigate codebase structure")
- Add more subtasks as you discover what's needed
- Example task: "Fix bug X" → Initial subtask: "Reproduce and locate bug", then add fix subtasks based on findings

## Supported Actions

**Important**: The tool auto-generates IDs. You provide descriptions (strings), not objects.

### add_tasks
Add one or more tasks to a job. Task IDs are generated automatically.
- **job_id** (string, required): Job ID (e.g., "J-ABC123")
- **tasks** (array of strings, required): Array of task descriptions

Example:
\`\`\`json
{
  "action": "add_tasks",
  "job_id": "J-ABC123",
  "tasks": ["Review documentation", "Write tests", "Deploy to staging"]
}
\`\`\`

Returns: Full job snapshot with all tasks

### remove_tasks
Remove tasks from a job by ID.
- **job_id** (string, required): Job ID
- **task_ids** (array of strings, required): Array of task IDs to remove

### complete_tasks
Mark tasks as complete. Job status auto-updates when all tasks are done.
- **job_id** (string, required): Job ID
- **task_ids** (array of strings, required): Array of task IDs to mark complete

### add_subtasks
Add execution steps to break down a task. Subtasks help track granular progress.
- **job_id** (string, required): Job ID
- **task_id** (string, required): Parent task ID
- **subtasks** (array of strings, required): Array of subtask descriptions

**Note**: Adding subtasks auto-updates task status to 'in_progress'

### start_subtasks
Mark subtasks as in_progress before working on them. **Required before doing any work.**
- **job_id** (string, required): Job ID
- **task_id** (string, required): Parent task ID
- **subtask_ids** (array of strings, required): Array of subtask IDs to start

### remove_subtasks
Remove subtasks that are no longer needed.
- **job_id** (string, required): Job ID
- **task_id** (string, required): Parent task ID
- **subtask_ids** (array of strings, required): Array of subtask IDs to remove

### complete_subtasks
Mark subtasks as complete. Task auto-completes when all subtasks are done.
- **job_id** (string, required): Job ID
- **task_id** (string, required): Parent task ID
- **subtask_ids** (array of strings, required): Array of subtask IDs to complete

### get_job
Get full job details including all tasks and issues.
- **job_id** (string, required): Job ID

### add_issue
Log a blocker or learning. Use when you encounter problems worth documenting.
- **job_id** (string, required): Job ID
- **title** (string, required): Short issue title
- **problem** (string, required): What went wrong or what you discovered
- **context** (string, optional): When/where it occurred
- **task_id** (string, optional): Link to specific task if relevant

### update_issue
Update issue with solution or change status.
- **job_id** (string, required): Job ID
- **issue_id** (string, required): Issue ID
- **solution** (string, optional): How the problem was solved
- **status** (string, optional): New status ('open', 'resolved', 'verified')

### list_issues
Query issues for the job.
- **job_id** (string, required): Job ID
- **status** (string, optional): Filter by status
- **task_id** (string, optional): Filter by task

### cancel_job
Cancel a job that cannot be completed or is no longer needed.
- **job_id** (string, required): Job ID
- **reason** (string, optional): Reason for cancellation

## Job Status (Auto-Managed)

- **pending**: No tasks or all pending
- **in_progress**: Has tasks, some incomplete
- **completed**: All tasks completed`,
    inputSchema: {
      type: 'object',
      required: ['action', 'job_id'],
      properties: {
        action: {
          type: 'string',
          enum: ['add_tasks', 'remove_tasks', 'complete_tasks', 'get_job', 'add_subtasks', 'remove_subtasks', 'start_subtasks', 'complete_subtasks', 'add_issue', 'update_issue', 'list_issues', 'cancel_job'],
          description: 'The management action to perform',
        },
        job_id: {
          type: 'string',
          description: 'The job ID (format: J-ABC123)',
        },
        tasks: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of task descriptions (for add_tasks)',
        },
        task_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of task IDs (for remove_tasks, complete_tasks)',
        },
        title: {
          type: 'string',
          description: 'Issue title (for add_issue)',
        },
        problem: {
          type: 'string',
          description: 'Problem description (for add_issue)',
        },
        context: {
          type: 'string',
          description: 'Context about when/where issue occurred (for add_issue)',
        },
        task_id: {
          type: 'string',
          description: 'Task ID (for subtask operations, optional for issues)',
        },
        subtasks: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of subtask descriptions (for add_subtasks)',
        },
        subtask_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of subtask IDs (for remove_subtasks, complete_subtasks)',
        },
        issue_id: {
          type: 'string',
          description: 'Issue ID (for update_issue)',
        },
        solution: {
          type: 'string',
          description: 'Solution description (for update_issue)',
        },
        status: {
          type: 'string',
          enum: ['open', 'resolved', 'verified'],
          description: 'Issue status (for update_issue, list_issues)',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation (for cancel_job)',
        },
      },
    },
    source: 'builtIn',
  },
};
