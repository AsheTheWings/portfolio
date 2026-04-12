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
} from '@/features/shared/components/shadcn';

import { CopyButton } from '@/features/shared/components/shadcn/copy-button';
import { useAgent } from '../hooks/useAgent';
import { useAgentSessionMetadata } from '../hooks/useAgentSessionMetadata';
import { useAgentStore } from '../stores/useAgentStore';
import { createAgent } from '../lib/agent-api';
import type { SavedAgent as _SavedAgent } from '../types';
import { isLightColor } from '../utils/color';

interface AgentSessionPopoverProps {
  sessionId?: string;
  persistAgentSession?: boolean;
  ephemeral?: boolean;
}

export function AgentSessionPopover({
  sessionId,
  persistAgentSession: propPersistSession = true,
  ephemeral: propEphemeral = false,
}: AgentSessionPopoverProps) {
  const { setPersistAgentSession, setEphemeral, agents } = useAgent();
  const acquiredAgentsMap = useAgentStore((s) => s.acquiredAgents);
  const { metadata, updateTitle, updateAgentName, updateTitleLocked } = useAgentSessionMetadata(sessionId);
  
  const [localTitle, setLocalTitle] = useState('');
  const [localAgentName, setLocalAgentName] = useState('');
  const [localTitleLocked, setLocalTitleLocked] = useState(false);
  const [showExportForm, setShowExportForm] = useState(false);
  
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
    <Popover modal onOpenChange={(open) => { if (!open) setShowExportForm(false); }}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity cursor-pointer">
          {(() => {
            // Resolve agent display info
            const rawAgentInfos = agents.map(a => {
              if (a.agentId === 'none') {
                return { name: 'Assistant', color: '#E2E8F0', avatarImage: null as string | null, agentId: a.agentId };
              }
              const saved = acquiredAgentsMap[a.agentId];
              return {
                name: saved?.name ?? a.agentId,
                color: saved?.color ?? '#E2E8F0',
                avatarImage: saved?.avatarImage ?? null,
                agentId: a.agentId,
              };
            });

            // Filter out 'none' agent when it's not the only one
            const agentInfos = rawAgentInfos.length > 1 
              ? rawAgentInfos.filter(a => a.agentId !== 'none')
              : rawAgentInfos;

            const firstName = agentInfos[0]?.name ?? 'Assistant';
            const othersCount = agentInfos.length - 1;
            
            // Build display name: "John", "John and Jane", or "John and 2 others"
            let displayName: string;
            if (othersCount === 0) {
              displayName = firstName;
            } else if (othersCount === 1) {
              const secondName = agentInfos[1]?.name ?? 'Assistant';
              displayName = `${firstName} and ${secondName}`;
            } else {
              displayName = `${firstName} and ${othersCount} others`;
            }

            // Stacked avatars (up to 3)
            const stackedAgents = agentInfos.slice(0, 3);

            return (
              <>
                <div className="flex items-center flex-shrink-0">
                  {stackedAgents.map((info, i) => {
                    const textColor = isLightColor(info.color) ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
                    return (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 relative outline outline-2 outline-background"
                        style={{
                          backgroundColor: info.color,
                          marginLeft: i > 0 ? '-8px' : 0,
                          zIndex: stackedAgents.length - i,
                        }}
                      >
                        {info.avatarImage ? (
                          <img src={info.avatarImage} alt={info.name} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span 
                              className="text-xs font-bold antialiased"
                              style={{ color: textColor, textRendering: 'optimizeLegibility' }}
                            >
                              {info.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <span className="text-xs font-medium text-foreground truncate">
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
        {showExportForm ? (
          <ExportAgentForm onBack={() => setShowExportForm(false)} />
        ) : (
          <div className="flex flex-col gap-4">
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

              {/* Agent Name */}
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
                      id="persistAgentSession"
                      checked={propPersistSession}
                      onChange={(e) => setPersistAgentSession(e.target.checked)}
                      size="small"
                      disableRipple
                      sx={{ padding: '2px', color: 'var(--color-border)', '&.Mui-checked': { color: 'var(--color-primary)' } }}
                    />
                    <Label htmlFor="persistAgentSession" className="text-xs font-normal cursor-pointer">Persistent</Label>
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

              {/* Export as Agent */}
              <Separator className="my-1" />
              <button
                onClick={() => setShowExportForm(true)}
                className="w-full text-xs text-primary hover:text-primary/80 transition-colors py-1 text-left"
              >
                Export as Agent
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Export Agent Form — replaces entire popover content
// ============================================================

function ExportAgentForm({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isConfigurable, setIsConfigurable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const agentConfig = useAgentStore((s) => s.agents[0]?.config ?? null);

  const handleSave = async () => {
    if (!name.trim() || !agentConfig) return;
    setSaving(true);
    try {
      await createAgent({
        name: name.trim(),
        description: description.trim() || undefined,
        agentConfig,
        isPublic,
        isConfigurable: isPublic ? isConfigurable : false,
      });
      setSaved(true);
      setTimeout(() => onBack(), 1500);
    } catch (err) {
      console.error('[ExportAgent] Failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="text-xs text-primary py-4 text-center">
        Agent created! Avatar is generating...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <h4 className="text-sm font-semibold">Export as Agent</h4>

      <Input
        placeholder="Agent name (required)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-7 text-xs"
        maxLength={50}
        autoFocus
      />
      <Input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="h-7 text-xs"
        maxLength={200}
      />

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <MuiCheckbox
            checked={isPublic}
            onChange={(e) => {
              setIsPublic(e.target.checked);
              if (!e.target.checked) setIsConfigurable(false);
            }}
            size="small"
            disableRipple
            sx={{ padding: '2px', color: 'var(--color-border)', '&.Mui-checked': { color: 'var(--color-primary)' } }}
          />
          Public
        </label>

        {isPublic && (
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <MuiCheckbox
              checked={isConfigurable}
              onChange={(e) => setIsConfigurable(e.target.checked)}
              size="small"
              disableRipple
              sx={{ padding: '2px', color: 'var(--color-border)', '&.Mui-checked': { color: 'var(--color-primary)' } }}
            />
            Configurable
          </label>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded disabled:opacity-50 transition-colors hover:bg-primary/90"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
