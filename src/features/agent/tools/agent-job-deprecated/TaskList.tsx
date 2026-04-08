'use client';

/**
 * Task and Subtask list components
 */

import React, { useState } from 'react';
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight,
  Loader2, CheckCircle, CircleDot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskData, SubtaskData } from './types';
import { CopyButton } from './shared';

// ============================================================
// Subtask Item
// ============================================================

const SubtaskItem = ({ subtask }: { subtask: SubtaskData }) => {
  const isDone = subtask.status === 'completed';
  
  return (
    <div className="flex items-start gap-2 py-1 group">
      <div className="mt-0.5 flex-shrink-0">
        {isDone 
          ? <CheckCircle size={12} className="text-emerald-500" />
          : <Circle size={12} className="text-muted-foreground/30" />
        }
      </div>
      <span className={cn(
        "text-xs leading-relaxed flex-1",
        isDone ? "text-muted-foreground/60 line-through" : "text-muted-foreground"
      )}>
        {subtask.description}
      </span>
      {subtask.id && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity pr-2">
          <CopyButton text={subtask.id} size={10} />
        </span>
      )}
    </div>
  );
};

// ============================================================
// Task Item
// ============================================================

const TaskItem = ({ task, defaultExpanded = false }: { task: TaskData; defaultExpanded?: boolean }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const completedSubtasks = task.subtasks?.filter(s => s.status === 'completed').length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  
  const isDone = task.status === 'completed';
  const isInProgress = task.status === 'in_progress';

  return (
    <div className="group">
      <div 
        className={cn(
          "flex items-start gap-2 py-2 px-3 rounded-lg transition-colors",
          hasSubtasks && "cursor-pointer hover:bg-muted/30",
          isInProgress && "bg-blue-500/5"
        )}
        onClick={() => hasSubtasks && setExpanded(!expanded)}
      >
        {/* Expand/Collapse or Status Icon */}
        <div className="mt-0.5 flex-shrink-0 w-4">
          {hasSubtasks ? (
            expanded 
              ? <ChevronDown size={14} className="text-muted-foreground" />
              : <ChevronRight size={14} className="text-muted-foreground" />
          ) : isDone ? (
            <CheckCircle2 size={14} className="text-emerald-500" />
          ) : isInProgress ? (
            <Loader2 size={14} className="text-blue-500 animate-spin" />
          ) : (
            <Circle size={14} className="text-muted-foreground/30" />
          )}
        </div>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-sm leading-snug",
            isDone ? "text-muted-foreground/60 line-through" : "text-foreground"
          )}>
            {task.description}
          </div>
          
          {hasSubtasks && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-muted/50 rounded-full overflow-hidden max-w-[100px]">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {completedSubtasks}/{totalSubtasks}
              </span>
            </div>
          )}
        </div>

        {/* Task ID */}
        {task.id && (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <CopyButton text={task.id} />
          </span>
        )}

        {/* Status indicator for tasks with subtasks */}
        {hasSubtasks && (
          <div className="flex-shrink-0">
            {isDone ? (
              <CheckCircle2 size={14} className="text-emerald-500" />
            ) : isInProgress ? (
              <CircleDot size={14} className="text-blue-500" />
            ) : null}
          </div>
        )}
      </div>

      {/* Subtasks */}
      {hasSubtasks && expanded && (
        <div className="ml-6 pl-4 border-l-2 border-muted/30 space-y-0.5 pb-2">
          {task.subtasks!.map((subtask, idx) => (
            <SubtaskItem key={subtask.id || idx} subtask={subtask} />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Task List (Main Export)
// ============================================================

export const TaskList = ({ tasks }: { tasks: TaskData[] }) => {
  // Auto-expand in-progress tasks
  const inProgressIdx = tasks.findIndex(t => t.status === 'in_progress');
  
  return (
    <div className="divide-y divide-border/30">
      {tasks.map((task, idx) => (
        <TaskItem 
          key={task.id || idx} 
          task={task} 
          defaultExpanded={idx === inProgressIdx}
        />
      ))}
    </div>
  );
};

export default TaskList;
