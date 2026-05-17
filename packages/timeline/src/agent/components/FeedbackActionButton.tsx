'use client';

/**
 * FeedbackActionButton Component
 * Renders a single action button with dynamic icon, tooltip, and keyboard hint
 */

import { Button } from '@portfolio/ui/components/shadcn/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@portfolio/ui/components/shadcn/tooltip';
import * as Icons from 'lucide-react';
import type { FeedbackAction } from '../types';
import { cn } from '@portfolio/ui/lib/utils';

interface FeedbackActionButtonProps {
  action: FeedbackAction;
  onClick: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function FeedbackActionButton({ action, onClick, disabled, fullWidth = true }: FeedbackActionButtonProps) {
  // Dynamic icon lookup
  const IconComponent = action.icon 
    ? (Icons[action.icon as keyof typeof Icons] as React.ComponentType<Record<string, unknown>>)
    : null;

  const button = (
    <Button
      onClick={onClick}
      variant={action.primary ? 'default' : action.dangerous ? 'destructive' : action.variant || 'outline'}
      size="sm"
      disabled={disabled}
      className={cn(
        "rounded-xl",
        fullWidth ? "w-full px-2 justify-start" : "justify-start"
      )}
    >
      {IconComponent && action.iconPosition !== 'right' && (
        <IconComponent className="w-4 h-4 flex-shrink-0" />
      )}
      <span className={cn("text-left", action.shortcut && "flex-1")}>{action.label}</span>
      {action.shortcut && (
        <kbd className={cn(
          "ml-2 py-0.5 text-xs font-mono rounded border",
          action.primary 
            ? "bg-primary-foreground/20 border-primary-foreground/40 text-primary-foreground"
            : "bg-muted border-border text-muted-foreground"
        )}>
          {action.shortcut}
        </kbd>
      )}
      {IconComponent && action.iconPosition === 'right' && (
        <IconComponent className="w-4 h-4 flex-shrink-0" />
      )}
    </Button>
  );

  // Wrap with tooltip if description exists
  if (action.description) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <p>{action.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
