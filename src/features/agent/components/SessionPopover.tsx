'use client';

/**
 * Session Popover - View and edit session metadata
 * Clickable session ID with editable session configuration
 */

import { useState, useEffect } from 'react';
import { Checkbox as MuiCheckbox } from '@mui/material';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Label,
  Input,
} from '@/features/shared/components/shadcn';
import { CopyButton } from '@/features/shared/components/shadcn/copy-button';
import { useAgent } from '../contexts/AgentContext';
import { useSessionMetadata } from '../hooks/useSessionMetadata';

interface SessionPopoverProps {
  sessionId?: string;
  persistSession?: boolean;
  ephemeral?: boolean;
}

export function SessionPopover({
  sessionId,
  persistSession: propPersistSession = true,
  ephemeral: propEphemeral = false,
}: SessionPopoverProps) {
  // Store setters
  const { setPersistSession, setEphemeral } = useAgent();

  // Fetch session metadata with debounced update functions
  const { metadata, updateTitle, updateAgentName, updateTitleLocked } = useSessionMetadata(sessionId);
  
  // Local editable state (for immediate UI feedback)
  const [localTitle, setLocalTitle] = useState('');
  const [localAgentName, setLocalAgentName] = useState('');
  const [localTitleLocked, setLocalTitleLocked] = useState(false);
  
  // Sync local state with fetched metadata
  useEffect(() => {
    if (metadata) {
      setLocalTitle(metadata.title || '');
      setLocalAgentName(metadata.agentName || 'assistant');
      setLocalTitleLocked(metadata.titleLocked || false);
    }
  }, [metadata]);

  // Truncate session ID for display
  const displaySessionId = sessionId 
    ? `${sessionId.slice(0, 8)}...${sessionId.slice(-4)}`
    : 'No session';

  // Handle title change (immediate UI + debounced save)
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value.slice(0, 40);
    setLocalTitle(newTitle);
    setLocalTitleLocked(true);  // Auto-lock when user edits
    updateTitle(newTitle);
  };

  // Handle agent name change (immediate UI + debounced save)
  const handleAgentNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAgentName = e.target.value;
    setLocalAgentName(newAgentName);
    updateAgentName(newAgentName);
  };

  if (!sessionId) {
    return (
      <div className="text-xs text-muted-foreground font-light w-[200px] flex justify-center">
        No active session
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 w-[200px]">
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-xs text-foreground font-light hover:text-primary transition-colors cursor-pointer flex-1 text-left">
            Session ID: {displaySessionId}
          </button>
        </PopoverTrigger>
      <PopoverContent 
        className="w-80" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">Session Configuration</h4>
            <p className="text-xs text-muted-foreground">
              View and edit session metadata
            </p>
          </div>

          {/* Session Information */}
          <div className="flex flex-col gap-3">
            {/* Session ID (Read-only) */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Session ID</Label>
              <code className="text-xs bg-muted px-2 py-1 rounded break-all font-mono">
                {sessionId}
              </code>
            </div>

            {/* Session Title (Editable) */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="sessionTitle" className="text-xs">Session Title</Label>
              <Input
                id="sessionTitle"
                value={localTitle}
                onChange={handleTitleChange}
                placeholder="My session"
                maxLength={40}
                className="h-8 text-xs"
              />
            </div>

            {/* Agent Name (Editable) */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="agentName" className="text-xs">Agent Name</Label>
              <Input
                id="agentName"
                value={localAgentName}
                onChange={handleAgentNameChange}
                placeholder="assistant"
                className="h-8 text-xs"
              />
            </div>

            {/* Counts (Read-only) */}
            <div className="flex gap-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Turns</Label>
                <span className="text-sm font-medium">{metadata?.turnCount ?? 0}</span>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Events</Label>
                <span className="text-sm font-medium">{metadata?.eventCount ?? 0}</span>
              </div>
            </div>

            {/* Session Flags */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Session Flags</Label>
              
              {/* Persistent */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <MuiCheckbox
                    id="persistSession"
                    checked={propPersistSession}
                    onChange={(e) => setPersistSession(e.target.checked)}
                    size="small"
                    disableRipple
                    sx={{
                      padding: '2px',
                      color: 'var(--color-border)',
                      '&.Mui-checked': { color: 'var(--color-primary)' },
                    }}
                  />
                  <Label htmlFor="persistSession" className="text-xs font-normal cursor-pointer">
                    Persistent
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  Save session history to database
                </p>
              </div>

              {/* Ephemeral */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <MuiCheckbox
                    id="ephemeral"
                    checked={propEphemeral}
                    onChange={(e) => setEphemeral(e.target.checked)}
                    size="small"
                    disableRipple
                    sx={{
                      padding: '2px',
                      color: 'var(--color-border)',
                      '&.Mui-checked': { color: 'var(--color-primary)' },
                    }}
                  />
                  <Label htmlFor="ephemeral" className="text-xs font-normal cursor-pointer">
                    Ephemeral
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  No context - each message starts fresh
                </p>
              </div>

              {/* Title Lock */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <MuiCheckbox
                    id="titleLocked"
                    checked={localTitleLocked}
                    onChange={(e) => {
                      setLocalTitleLocked(e.target.checked);
                      updateTitleLocked(e.target.checked);
                    }}
                    size="small"
                    disableRipple
                    sx={{
                      padding: '2px',
                      color: 'var(--color-border)',
                      '&.Mui-checked': { color: 'var(--color-primary)' },
                    }}
                  />
                  <Label htmlFor="titleLocked" className="text-xs font-normal cursor-pointer">
                    Lock Title
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  Prevent auto-generation of session title
                </p>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
      </Popover>
      
      {/* Copy Button */}
      {sessionId && (
        <CopyButton
          content={sessionId}
          variant="ghost"
          size="sm"
          className="h-6 flex-shrink-0"
        />
      )}
    </div>
  );
}
