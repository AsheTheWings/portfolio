'use client';

/**
 * Session Popover - View and edit session metadata
 * Clickable session ID with editable session configuration
 * "Export as Agent" replaces popover content with the agent form.
 */

import { useState, useEffect } from 'react';
import { Checkbox as MuiCheckbox } from '@mui/material';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Label,
  Input,
  Separator,
  AvatarGroup,
} from '@portfolio/ui/components/shadcn';

import { AgentAvatar } from './AgentAvatar';

import { CopyButton } from '@portfolio/ui/components/shadcn/copy-button';
import { useAgent } from '../hooks/useAgent';
import { useSessionMetadata } from '../hooks/useSessionMetadata';
import { useAgentStore } from '../stores/useAgentStore';
import type { SavedAgent as _SavedAgent } from '../types';
import { FeatureProblemNotice } from './FeatureProblemNotice';

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
  const { setPersistSession, setEphemeral, agents } = useAgent();
  const acquiredAgentsMap = useAgentStore((s) => s.acquiredAgents);
  const { metadata, updateTitle, updateTitleLocked } = useSessionMetadata(sessionId);
  
  const [localTitle, setLocalTitle] = useState('');
  const [localAgentName, setLocalAgentName] = useState('');
  const [localTitleLocked, setLocalTitleLocked] = useState(false);
  
  useEffect(() => {
    if (metadata) {
      setLocalTitle(metadata.title || '');
      setLocalAgentName(metadata.agentName || 'assistant');
      setLocalTitleLocked(metadata.titleLocked || false);
    } else {
      setLocalTitle('');
      setLocalAgentName('');
      setLocalTitleLocked(false);
    }
  }, [metadata]);

  const _displaySessionId = sessionId 
    ? `${sessionId.slice(0, 8)}...${sessionId.slice(-4)}`
    : 'No session';

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value.slice(0, 40);
    setLocalTitle(newTitle);
    setLocalTitleLocked(true);
    updateTitle(newTitle);
  };

  if (!sessionId) {
    return (
      <div className="text-xs text-muted-foreground font-light w-[200px] flex justify-center">
        No active session
      </div>
    );
  }

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2.5 w-full text-left hover:opacity-80 transition-opacity cursor-pointer">
          {(() => {
            // Resolve agent display info
            const rawAgentInfos = agents.map(a => {
              if (a.agentId === 'none') {
                return { name: 'Assistant', color: '#E2E8F0', avatarImage: null as string | null, agentId: a.agentId };
              }
              const saved = acquiredAgentsMap[a.agentId];
              return {
                name: saved?.name,
                color: saved?.color ?? '#E2E8F0',
                avatarImage: saved?.portraitRef ?? null,
                agentId: a.agentId,
              };
            });

            // Filter out agents without resolved names, then filter out 'none' agent when it's not the only one
            const withNames = rawAgentInfos.filter(a => a.name);
            const agentInfos = withNames.length > 1
              ? withNames.filter(a => a.agentId !== 'none')
              : withNames;

            const firstName = agentInfos[0]?.name;
            const othersCount = agentInfos.length - 1;
            
            // Build display name: "John", "John and Jane", or "John and 2 others"
            let displayName: string;
            if (!firstName) {
              displayName = '';
            } else if (othersCount === 0) {
              displayName = firstName;
            } else if (othersCount === 1) {
              const secondName = agentInfos[1]?.name ?? '';
              displayName = `${firstName} and ${secondName}`;
            } else {
              displayName = `${firstName} and ${othersCount} others`;
            }

            // Stacked avatars (up to 3)
            const stackedAgents = agentInfos.slice(0, 3);

            return (
              <>
                <AgentAvatarStack agents={stackedAgents} />
                <span className="text-xs font-medium text-foreground break-words leading-tight min-w-0">
                  {displayName}
                </span>
              </>
            );
          })()}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-4">
          <FeatureProblemNotice
            feature="session"
            controlId={`session-metadata:${sessionId}`}
          />
          {/* Header */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">Session Configuration</h4>
            <p className="text-xs text-muted-foreground">
              View and edit session metadata
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Session ID with copy */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Session ID</Label>
              <div className="flex items-center gap-1">
                <code className="text-xs bg-muted px-2 py-1 rounded break-all font-mono flex-1">
                  {sessionId}
                </code>
                <CopyButton
                  content={sessionId}
                  variant="ghost"
                  size="sm"
                  className="h-6 flex-shrink-0"
                />
              </div>
            </div>

            {/* Session Title */}
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

            {/* Agent identity is workflow-derived and is not mutable session metadata. */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Agent Name</Label>
              <span className="h-8 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground">
                {localAgentName || 'assistant'}
              </span>
            </div>

            {/* Counts */}
            {propPersistSession && (
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
            )}

            {/* Session Flags */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Session Flags</Label>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <MuiCheckbox
                    id="persistSession"
                    checked={propPersistSession}
                    onChange={(e) => setPersistSession(e.target.checked)}
                    size="small"
                    disableRipple
                    sx={{ padding: '2px', color: 'var(--color-border)', '&.Mui-checked': { color: 'var(--color-primary)' } }}
                  />
                  <Label htmlFor="persistSession" className="text-xs font-normal cursor-pointer">Persistent</Label>
                </div>
                <p className="text-xs text-muted-foreground pl-7">Save session history to database</p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <MuiCheckbox
                    id="ephemeral"
                    checked={propEphemeral}
                    onChange={(e) => setEphemeral(e.target.checked)}
                    size="small"
                    disableRipple
                    sx={{ padding: '2px', color: 'var(--color-border)', '&.Mui-checked': { color: 'var(--color-primary)' } }}
                  />
                  <Label htmlFor="ephemeral" className="text-xs font-normal cursor-pointer">Ephemeral</Label>
                </div>
                <p className="text-xs text-muted-foreground pl-7">No context - each message starts fresh</p>
              </div>

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
                    sx={{ padding: '2px', color: 'var(--color-border)', '&.Mui-checked': { color: 'var(--color-primary)' } }}
                  />
                  <Label htmlFor="titleLocked" className="text-xs font-normal cursor-pointer">Lock Title</Label>
                </div>
                <p className="text-xs text-muted-foreground pl-7">Prevent auto-generation of session title</p>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Agent avatar stack — renders 1..3 overlapping avatars with the
// per-agent color as the fallback background. Built on shadcn's
// AvatarGroup so spacing/ring styling stays consistent with the rest
// of the app.
// ============================================================

interface AgentAvatarInfo {
  name: string;
  color: string;
  avatarImage: string | null;
}

function AgentAvatarStack({ agents }: { agents: AgentAvatarInfo[] }) {
  return (
    <AvatarGroup className="flex-shrink-0">
      {agents.map((info, i) => (
        <AgentAvatar
          key={i}
          avatarImage={info.avatarImage}
          agentName={info.name}
          agentColor={info.color}
        />
      ))}
    </AvatarGroup>
  );
}
