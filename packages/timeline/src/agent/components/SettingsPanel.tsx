'use client';

/**
 * Settings Panel
 * Configuration panel for agent settings
 * Self-contained: handles its own state and close behavior
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Checkbox as MuiCheckbox } from '@mui/material';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, Label, Input } from '@portfolio/ui/components/shadcn';
import { useAgent } from '../hooks/useAgent';
import type { McpHostStatus } from '../types';
import { loadMcpConfig, saveMcpConfig } from '../utils/mcp-config';
import { httpClient } from '@portfolio/api-client';
import { useConfiguredProviders } from '../hooks/useConfiguredProviders';
import { CustomModelProvidersSection } from './CustomModelProvidersSection';

// ============================================================
// BYOK — Provider definitions
// ============================================================

interface ProviderDef {
  id: string;
  label: string;
  placeholder: string;
  helpUrl: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    placeholder: 'sk-or-...',
    helpUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'tera',
    label: 'Tera',
    placeholder: 'sk-tera-...',
    helpUrl: 'https://tera.asheservices.online',
  },
  {
    id: 'fal',
    label: 'Fal.ai',
    placeholder: 'fal-key-...',
    helpUrl: 'https://fal.ai/dashboard/keys',
  },
];

const API_KEY_SECTIONS = [
  {
    id: 'llm',
    title: 'LLM',
    description: 'Language model inference providers used by chat and agent runs.',
    providerIds: ['openrouter', 'tera'],
  },
  {
    id: 'media-generation',
    title: 'Media Generation',
    description: 'Image, video, and other media generation providers.',
    providerIds: ['fal'],
  },
] as const;

// ============================================================
// API helpers
// ============================================================

async function saveProviderKey(provider: string, key: string): Promise<void> {
  await httpClient.put(`/settings/api-keys/${provider}`, { key });
}

async function removeProviderKey(provider: string): Promise<void> {
  await httpClient.delete(`/settings/api-keys/${provider}`);
}

// ============================================================
// ApiKeyRow — manages one provider's input state
// ============================================================

interface ApiKeyRowProps {
  provider: ProviderDef;
  isConfigured: boolean;
  onSaved: (provider: string) => void;
  onRemoved: (provider: string) => void;
}

function ApiKeyRow({ provider, isConfigured, onSaved, onRemoved }: ApiKeyRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveProviderKey(provider.id, value.trim());
      setValue('');
      setEditing(false);
      onSaved(provider.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await removeProviderKey(provider.id);
      onRemoved(provider.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove key');
    } finally {
      setRemoving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSave();
    if (e.key === 'Escape') { setValue(''); setEditing(false); setError(null); }
  };

  return (
    <div className="rounded-md border border-input p-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{provider.label}</span>
              {isConfigured && !editing && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1" fill="none" />
                    <path d="M3.5 6L5.5 8L8.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Configured
                </span>
              )}
              {!isConfigured && !editing && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Not configured
                </span>
              )}
            </div>
            <a
              href={provider.helpUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex text-xs text-cyan-600 transition-colors hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300"
              title="Get API key"
            >
              Get API key
            </a>
          </div>

          {!editing && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => { setEditing(true); setError(null); }}
                className="text-xs text-primary transition-colors hover:text-primary/80"
              >
                {isConfigured ? 'Update' : 'Add'}
              </button>
              {isConfigured && (
                <button
                  onClick={() => void handleRemove()}
                  disabled={removing}
                  className="text-xs text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
                >
                  {removing ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>
          )}
        </div>

        {editing && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={provider.placeholder}
              className="h-8 flex-1 font-mono text-xs placeholder:text-xs"
              autoComplete="new-password"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleSave()}
                disabled={saving || !value.trim()}
                className="text-xs text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setValue(''); setEditing(false); setError(null); }}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SettingsPanel
// ============================================================

export function SettingsPanel() {
  const { removeComponent, uiInterface, setUiInterface } = useAgent();
  // MCP is Phase 3 — stub as no-ops / not connected
  const connectMcp = useCallback(async (_config: unknown) => { /* Phase 3 */ }, []);
  const disconnectMcp = useCallback(async () => { /* Phase 3 */ }, []);
  const mcpHostStatus = 'notConnected' as McpHostStatus;
  const [mcpEnabled, setMcpEnabled] = useState(() => loadMcpConfig().enabled);
  const [mcpPort, setMcpPort] = useState(() => loadMcpConfig().port);
  const prevMcpPort = useRef(mcpPort);

  // BYOK configured-provider state is shared via SWR across Settings + Agent config.
  const {
    configuredProviderIds,
    isLoading: keysLoading,
    mutate: mutateConfiguredProviders,
  } = useConfiguredProviders();

  const handleKeySaved = useCallback((providerId: string) => {
    void mutateConfiguredProviders(
      (current = []) => [...new Set([...current, providerId])],
      { revalidate: true },
    );
  }, [mutateConfiguredProviders]);

  const handleKeyRemoved = useCallback((providerId: string) => {
    void mutateConfiguredProviders(
      (current = []) => current.filter((id) => id !== providerId),
      { revalidate: true },
    );
  }, [mutateConfiguredProviders]);

  const handleMcpEnabledToggle = async () => {
    const newEnabled = !mcpEnabled;
    setMcpEnabled(newEnabled);
    
    const config = loadMcpConfig();
    config.enabled = newEnabled;
    saveMcpConfig(config);
    
    if (newEnabled) {
      try {
        await connectMcp(config);
      } catch (err: unknown) {
        console.warn('MCP connection failed:', err instanceof Error ? err.message : String(err));
      }
    } else {
      await disconnectMcp();
    }
  };

  const handleMcpPortChange = (value: string) => {
    const portNum = parseInt(value, 10);
    if (!isNaN(portNum) && portNum > 0 && portNum < 65536) {
      setMcpPort(portNum);
      const config = loadMcpConfig();
      config.port = portNum;
      saveMcpConfig(config);
    }
  };

  // Debounced auto-reconnect on port change
  useEffect(() => {
    if (prevMcpPort.current === mcpPort) return;
    if (!mcpEnabled || mcpHostStatus === 'notConnected') {
      prevMcpPort.current = mcpPort;
      return;
    }
    const timeoutId = setTimeout(async () => {
      const config = loadMcpConfig();
      try {
        prevMcpPort.current = mcpPort;
        await disconnectMcp();
        await connectMcp(config);
      } catch (err: unknown) {
        console.warn('[SettingsPanel] Reconnection failed:', err instanceof Error ? err.message : String(err));
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [mcpPort, mcpEnabled, mcpHostStatus, connectMcp, disconnectMcp]);

  // Chat mode = standalone (centered card), side-by-side = inline
  const isStandalone = uiInterface === 'chat';
  const providersById = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

  const content = (
    <div className="flex flex-col pb-4">
      <div>
        {/* Interface Mode */}
        <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3">
          <Label>Interface Mode</Label>
          <p className="text-xs text-muted-foreground">
            Choose your preferred interface layout.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setUiInterface('chat')}
              className={`rounded-md border p-3 transition-all ${
                uiInterface === 'chat'
                  ? 'border-primary bg-primary/5'
                  : 'border-input hover:bg-secondary'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <svg width="40" height="28" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="36" height="24" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
                <span className="text-sm font-medium">Chat</span>
                <span className="text-center text-xs text-muted-foreground">Traditional chat interface</span>
              </div>
            </button>

            <button
              onClick={() => setUiInterface('flat')}
              className={`rounded-md border p-3 transition-all ${
                uiInterface === 'flat'
                  ? 'border-primary bg-primary/5'
                  : 'border-input hover:bg-secondary'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <svg width="40" height="28" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="36" height="24" stroke="currentColor" strokeWidth="2" fill="none" />
                  <line x1="20" y1="2" x2="20" y2="26" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="text-sm font-medium">Flat</span>
                <span className="text-center text-xs text-muted-foreground">Linear event stream</span>
              </div>
            </button>
          </div>
        </div>

        {/* Local MCP Host Section */}
        <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3">
          <Label>Local MCP Host</Label>
          <div className="flex flex-col gap-1">
            <div className="flex items-center">
              <MuiCheckbox
                id="mcp-enabled-settings"
                checked={mcpEnabled}
                onChange={() => {
                  handleMcpEnabledToggle();
                }}
                size="small"
                disableRipple
                sx={{
                  padding: '2px',
                  color: 'var(--color-border)',
                  '&.Mui-checked': { color: 'var(--color-primary)' },
                }}
              />
              <Label htmlFor="mcp-enabled-settings" className="font-normal text-xs cursor-pointer">
                Enable MCP Host
              </Label>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
              Configure connection to local MCP host service.
            </p>
          </div>

          {mcpEnabled && (
            <div className="grid grid-cols-2 gap-3 rounded-md border border-input p-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="mcp-port-settings" className="font-normal text-xs">
                  Port
                </Label>
                <Input
                  type="number"
                  id="mcp-port-settings"
                  value={mcpPort}
                  onChange={(e) => handleMcpPortChange(e.target.value)}
                  min="1"
                  max="65535"
                  className="h-8 w-24 text-xs"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              <div className="flex items-center gap-2">
                <Label className="font-normal text-xs">Status</Label>
                {mcpHostStatus === 'connected' && (
                  <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
                )}
                {mcpHostStatus === 'notConnected' && (
                  <span className="text-xs text-muted-foreground">Not connected</span>
                )}
                {mcpHostStatus === 'error' && (
                  <span className="text-xs text-red-600 dark:text-red-400">Error</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        {/* API Keys Section (BYOK) */}
        <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3">
          <div>
            <Label>API Keys</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Your keys are encrypted at rest and used only for your own inference requests.
            </p>
          </div>

          {keysLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex flex-col gap-6">
              {API_KEY_SECTIONS.map((section) => (
                <div key={section.id} className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-xs font-medium text-foreground">{section.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {section.providerIds.map((providerId) => {
                      const provider = providersById.get(providerId);
                      if (!provider) return null;

                      return (
                        <ApiKeyRow
                          key={provider.id}
                          provider={provider}
                          isConfigured={configuredProviderIds.includes(provider.id)}
                          onSaved={handleKeySaved}
                          onRemoved={handleKeyRemoved}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <CustomModelProvidersSection />
      </div>
    </div>
  );

  const handleClose = () => {
    removeComponent('settings-panel');
  };

  return (
    <Card className={isStandalone ? "w-md min-w-[320px] lg:h-[76vh] lg:w-full" : "w-full border-none shadow-none bg-transparent"}>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage playground settings</CardDescription>
        </div>
        <CardAction>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Close panel"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </CardAction>
      </CardHeader>

      <CardContent className="h-full lg:overflow-y-auto lg:[scrollbar-gutter:stable] scrollbar-inner">
        {content}
      </CardContent>
    </Card>
  );
}

