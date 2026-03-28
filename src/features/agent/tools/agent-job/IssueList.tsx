'use client';

/**
 * Issue list component
 */

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IssueData } from './types';
import { CopyButton } from './shared';

// ============================================================
// Issue Item
// ============================================================

export const IssueItem = ({ issue }: { issue: IssueData }) => {
  const [expanded, setExpanded] = useState(issue.status === 'open');
  const isOpen = issue.status === 'open';
  const isResolved = issue.status === 'resolved' || issue.status === 'verified';

  return (
    <div className={cn(
      "rounded-lg border transition-colors",
      isOpen 
        ? "border-amber-500/30 bg-amber-500/5" 
        : "border-emerald-500/20 bg-emerald-500/5"
    )}>
      <div 
        className="flex items-start gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="mt-0.5 flex-shrink-0">
          {isOpen 
            ? <AlertCircle size={16} className="text-amber-500" />
            : <CheckCircle size={16} className="text-emerald-500" />
          }
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium text-sm",
              isOpen ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
            )}>
              {issue.title}
            </span>
            {issue.id && (
              <span className="text-[10px] text-muted-foreground/50">
                <CopyButton text={issue.id} />
              </span>
            )}
          </div>
          
          {!expanded && issue.problem && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{issue.problem}</p>
          )}
        </div>

        <ChevronDown size={14} className={cn(
          "text-muted-foreground transition-transform flex-shrink-0",
          expanded && "rotate-180"
        )} />
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/20 pt-2 ml-7">
          {issue.problem && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Problem</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{issue.problem}</p>
            </div>
          )}
          {issue.solution && (
            <div className="bg-emerald-500/10 rounded-md p-2">
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Solution</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">{issue.solution}</p>
            </div>
          )}
          {issue.context && (
            <p className="text-[10px] text-muted-foreground/70 italic">{issue.context}</p>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Issue List (Main Export)
// ============================================================

export const IssueList = ({ issues, maxItems }: { issues: IssueData[]; maxItems?: number }) => {
  const displayedIssues = maxItems ? issues.slice(0, maxItems) : issues;
  const hasMore = maxItems && issues.length > maxItems;

  return (
    <div className="space-y-2">
      {displayedIssues.map((issue, idx) => (
        <IssueItem key={issue.id || idx} issue={issue} />
      ))}
      {hasMore && (
        <p className="text-xs text-muted-foreground text-center py-1">
          +{issues.length - maxItems} more issues
        </p>
      )}
    </div>
  );
};

export default IssueList;
