'use client';

/**
 * AgentCard — Single agent card for the AgentsHub grid.
 */

import { Badge, Avatar, AvatarImage, AvatarFallback } from '@portfolio/ui/components/shadcn';
import type { SavedAgent } from '../types';
import { isLightColor } from '../utils/color';

export interface AgentCardProps {
  agent: SavedAgent;
  isOwner: boolean;
  isAcquired: boolean;
  isSelected: boolean;
  isSearchMode: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onAcquire: () => void;
  onRelease: () => void;
}

export function AgentCard({ agent, isOwner, isAcquired, isSelected, isSearchMode, onSelect, onDelete, onAcquire, onRelease }: AgentCardProps) {
  const color = agent.color ?? '#E2E8F0';
  const lightColor = isLightColor(color);

  const textClass = isSelected ? (lightColor ? 'text-gray-900' : 'text-white') : '';

  const handleSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
      return;
    }
    onSelect();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleSelect}
      className={`group text-left rounded-lg border border-border-subtle hover:border-border transition-all duration-150 overflow-hidden cursor-pointer ${
        isSelected ? '' : 'bg-surface-1 hover:bg-surface-2'
      }`}
      style={isSelected ? { backgroundColor: color } : undefined}
    >
      <div className="p-4 flex flex-col gap-3 min-w-0">
        {/* Avatar + Name row */}
        <div className="flex items-center gap-3">
          <Avatar className="size-14">
            {agent.avatarImage && <AvatarImage src={agent.avatarImage} alt={agent.name} />}
            <AvatarFallback color={color} className="text-xl">
              {agent.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className={`text-sm font-medium truncate ${isSelected ? textClass : 'text-foreground'}`}>
              {agent.name}
            </div>
            <div className={`text-xs truncate ${isSelected ? `${textClass} opacity-70` : 'text-muted-foreground'}`}>
              {agent.agentConfig.modelId}
            </div>
          </div>
        </div>

        {/* Description */}
        {agent.description && (
          <p className={`text-xs line-clamp-3 ${isSelected ? `${textClass} opacity-70` : 'text-muted-foreground'}`}>
            {agent.description}
          </p>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
          {isOwner && (
            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${isSelected ? `bg-black/10 ${textClass} border-current/30` : ''}`}>
              Owner
            </Badge>
          )}
          {agent.isPublic && (
            <Badge variant="outline" className={`text-xs px-1.5 py-0 flex items-center gap-0.5 ${isSelected ? `border-current/30 ${textClass} opacity-80` : 'text-muted-foreground'}`}>
              Public
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Acquire/Release for non-owned agents in search mode */}
          {!isOwner && isSearchMode && (
            <button
              onClick={(e) => { e.stopPropagation(); if (isAcquired) onRelease(); else onAcquire(); }}
              className={`text-[10px] transition-colors px-2 py-0.5 rounded ${
                isSelected
                  ? `${textClass} opacity-70 hover:opacity-100 hover:bg-black/10`
                  : isAcquired
                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    : 'text-primary hover:text-primary/80 hover:bg-primary/10'
              }`}
            >
              {isAcquired ? 'Remove' : 'Add to Library'}
            </button>
          )}
          {/* Delete button (owner only) */}
          {isOwner && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className={`text-[10px] transition-colors px-2 py-0.5 rounded ml-auto ${
                isSelected
                  ? `${textClass} opacity-70 hover:opacity-100 hover:bg-black/10`
                  : 'text-destructive hover:text-destructive/80 hover:bg-destructive/10'
              }`}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
