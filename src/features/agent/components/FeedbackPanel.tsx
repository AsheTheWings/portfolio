'use client';

/**
 * FeedbackPanel Component
 * Displays feedback query and action buttons
 * Tool-agnostic, layout-flexible component for user feedback
 */

import type { FeedbackAction } from '../types';
import { FeedbackActionButton } from './FeedbackActionButton';
import { cn } from '@/lib/utils';
import { useEffect, useCallback } from 'react';

interface FeedbackPanelProps {
  prompt?: string;
  actions: FeedbackAction[];
  layout?: 'vertical' | 'horizontal' | 'grid';
  onAction: (actionId: string) => void;
  disabled?: boolean;
}

export function FeedbackPanel({
  prompt,
  actions,
  layout = 'vertical',
  onAction,
  disabled = false,
}: FeedbackPanelProps) {
  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    // Find action with matching shortcut
    const action = actions.find(a => {
      if (!a.shortcut) return false;
      
      const shortcut = a.shortcut.toLowerCase();
      const key = event.key.toLowerCase();
      
      // Handle special keys
      if (shortcut === 'enter' && key === 'enter') return true;
      if (shortcut === 'escape' && key === 'escape') return true;
      if (shortcut === 'esc' && key === 'escape') return true;
      
      // Handle letter keys (with meta/ctrl)
      if ((event.metaKey || event.ctrlKey) && shortcut.includes(key)) return true;
      
      return false;
    });

    if (action) {
      event.preventDefault();
      onAction(action.id);
    }
  }, [actions, onAction, disabled]);

  /**
   * Set up keyboard listeners
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col gap-2 w-fit">
      {/* Prompt text */}
      {prompt && (
        <div className="flex justify-center items-center text-sm font-medium text-foreground">
          {prompt}
        </div>
      )}
      
      {/* Action buttons */}
      <div
        className={cn(
          "flex gap-3",
          layout === 'vertical' && "flex-col",
          layout === 'horizontal' && "flex-row flex-wrap justify-center",
          layout === 'grid' && "grid grid-cols-2"
        )}
      >
        {actions.map((action) => (
          <FeedbackActionButton
            key={action.id}
            action={action}
            onClick={() => onAction(action.id)}
            disabled={disabled}
            fullWidth={layout === 'vertical' || layout === 'grid'}
          />
        ))}
      </div>
    </div>
  );
}
