'use client';

/**
 * BranchListModal - Display and select branches for a component
 * Shows list of sessions branched from a specific componentId
 */

import React from 'react';
import { X, GitBranch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import IconBranch from '@portfolio/ui/icons/IconBranch';

interface Branch {
  branchSessionId: string;
  timestamp: Date;
}

interface BranchListModalProps {
  componentId: string;
  branches: Branch[];
  onSelectBranch: (sessionId: string) => void;
  onClose: () => void;
}

export function BranchListModal({
  branches,
  onSelectBranch,
  onClose,
}: BranchListModalProps) {
  if (branches.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-surface-1 rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-500" />
            <h3 className="text-sm font-semibold text-foreground">
              Branches ({branches.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Branch list */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-inner">
          {branches.map((branch) => (
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
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(branch.timestamp), { addSuffix: true })}
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-mono truncate">
                  {branch.branchSessionId.slice(0, 8)}...
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-border-subtle">
          <p className="text-xs text-muted-foreground text-center">
            Click a branch to switch to that session
          </p>
        </div>
      </div>
    </div>
  );
}
