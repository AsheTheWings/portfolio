'use client';

/**
 * BranchTreeView - Panel component that displays branches for a component
 * Used inside ControlsProvider as a toggleable panel
 */

import React from 'react';
import { ArrowLeft, GitBranch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import IconBranch from '@portfolio/ui/icons/IconBranch';

interface Branch {
  branchSessionId: string;
  timestamp?: Date;
}

interface BranchTreeViewProps {
  branches: Branch[];
  onSelectBranch: (sessionId: string) => void;
  onClose: () => void;
}

export function BranchTreeView({
  branches,
  onSelectBranch,
  onClose,
}: BranchTreeViewProps) {
  return (
    <div className="rounded-lg border border-slate-300 dark:border-border-subtle bg-white dark:bg-surface-1">
      {/* Header */}
      <div className="border-b border-foreground px-4 py-2 flex items-center">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-foreground hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        
        <div className="flex-1 text-center flex items-center justify-center gap-2">
          <GitBranch className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-foreground">
            Branches ({branches.length})
          </span>
        </div>
        
        <div className="w-[72px]"></div>
      </div>

      {/* Branch list */}
      <div className="max-h-[400px] overflow-y-auto scrollbar-inner">
        {branches.length === 0 ? (
          <div className="px-8 py-8 text-center text-sm text-muted-foreground">
            No branches yet
          </div>
        ) : (
          branches.map((branch) => (
            <button
              key={branch.branchSessionId}
              onClick={() => {
                onSelectBranch(branch.branchSessionId);
                onClose();
              }}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-border-subtle last:border-b-0"
            >
              {/* Branch icon */}
              <div className="mt-0.5 p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rotate-180">
                <IconBranch size="14" />
              </div>

              {/* Branch info */}
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground">
                  Branch
                </div>
                {branch.timestamp && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(branch.timestamp), { addSuffix: true })}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1 font-mono truncate">
                  {branch.branchSessionId.slice(0, 8)}...
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-border-subtle">
        <p className="text-xs text-muted-foreground text-center">
          {branches.length > 0 ? 'Click a branch to switch to that session' : 'Create a branch by editing or reverting'}
        </p>
      </div>
    </div>
  );
}
