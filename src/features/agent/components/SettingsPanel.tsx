'use client';

/**
 * Settings Panel
 * Configuration panel for agent settings
 * Self-contained: handles its own state and close behavior
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Checkbox as MuiCheckbox } from '@mui/material';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, Label, Input } from '@/features/shared/components/shadcn';
import { useAgent } from '../hooks/useAgent';
import type { McpHostStatus } from '../types';
import { loadMcpConfig, saveMcpConfig } from '../utils/mcp-config';
import { httpClient } from '@/features/shared/utils/http-client';

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
    id: 'google',
    label: 'Google (Gemini)',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    placeholder: 'fw_...',
    helpUrl: 'https://fireworks.ai/api-keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    placeholder: 'sk-or-...',
    helpUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'fal',
    label: 'Fal.ai',
    placeholder: 'fal-key-...',
    helpUrl: 'https://fal.ai/dashboard/keys',
  },
];

// ============================================================
// API helpers
// ============================================================

async function fetchConfiguredProviders(): Promise<string[]> {
  const data = await httpClient.get<{ configured: string[] }>('/api/settings/api-keys');
  return data.configured;
}

async function saveProviderKey(provider: string, key: string): Promise<void> {
  await httpClient.put(`/api/settings/api-keys/${provider}`, { key });
}

async function removeProviderKey(provider: string): Promise<void> {
  await httpClient.delete(`/api/settings/api-keys/${provider}`);
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{provider.label}</span>
          {isConfigured && !editing && (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1" fill="none" />
                <path d="M3.5 6L5.5 8L8.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Configured
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={provider.helpUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Get API key"
          >
            Get key ↗
          </a>
          {isConfigured && !editing && (
            <>
              <button
                onClick={() => { setEditing(true); setError(null); }}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Update
              </button>
              <button
                onClick={() => void handleRemove()}
                disabled={removing}
                className="text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
              >
                {removing ? '…' : 'Remove'}
              </button>
            </>
          )}
          {!isConfigured && !editing && (
            <button
              onClick={() => { setEditing(true); setError(null); }}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Add
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex gap-2 items-center">
          <Input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={provider.placeholder}
            className="flex-1 h-8 text-xs font-mono"
            autoFocus
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving || !value.trim()}
            className="text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => { setValue(''); setEditing(false); setError(null); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
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

  // BYOK state
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);

  useEffect(() => {
    fetchConfiguredProviders()
      .then(setConfiguredProviders)
      .catch(() => { /* silently ignore — panel still usable */ })
      .finally(() => setKeysLoading(false));
  }, []);

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

  const content = (
    <>
        {/* Interface Mode */}
        <div className="flex flex-col gap-3">
          <Label>Interface Mode</Label>
          <p className="text-xs text-muted-foreground">
            Choose your preferred interface layout
          </p>
          
          <div className="flex gap-2">
            {/* Chat Layout */}
            <div className="flex-1">
              <button
                onClick={() => setUiInterface('chat')}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  uiInterface === 'chat'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg width="40" height="28" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="2" width="36" height="24" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                  <span className="text-sm font-medium">Chat</span>
                  <span className="text-xs text-muted-foreground text-center">Traditional chat interface</span>
                </div>
              </button>
            </div>

            {/* Flat Layout */}
            <div className="flex-1">
              <button
                onClick={() => setUiInterface('flat')}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  uiInterface === 'flat'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg width="40" height="28" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="2" width="36" height="24" stroke="currentColor" strokeWidth="2" fill="none" />
                    <line x1="20" y1="2" x2="20" y2="26" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span className="text-sm font-medium">Flat</span>
                  <span className="text-xs text-muted-foreground text-center">Linear event stream</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Local MCP Host Section */}
        <div className="flex flex-col gap-3 pt-6 border-t border-border">
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
              <Label htmlFor="mcp-enabled-settings" className="font-normal text-[0.805rem] cursor-pointer">
                Enable MCP Host
              </Label>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
              Configure connection to local MCP host service
            </p>
          </div>

          {mcpEnabled && (
            <div className="flex">
              <div className="w-[50%] flex items-center gap-2">
                <Label htmlFor="mcp-port-settings" className="font-normal text-[0.805rem]">
                  Port
                </Label>
                <Input
                  type="number"
                  id="mcp-port-settings"
                  value={mcpPort}
                  onChange={(e) => handleMcpPortChange(e.target.value)}
                  min="1"
                  max="65535"
                  className="w-24 h-8 text-sm"
                />
              </div>
              
              <div className="w-[50%] flex items-center gap-2">
                <Label className="font-normal text-[0.805rem]">Status</Label>
                {mcpHostStatus === 'connected' && (
                  <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
                )}
                {mcpHostStatus === 'notConnected' && (
                  <span className="text-sm text-muted-foreground">Not connected</span>
                )}
                {mcpHostStatus === 'error' && (
                  <span className="text-sm text-red-600 dark:text-red-400">Error</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* API Keys Section (BYOK) */}
        <div className="flex flex-col gap-4 pt-6 border-t border-border">
          <div>
            <Label>API Keys</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Your keys are encrypted at rest and used only for your own inference requests.
            </p>
          </div>

          {keysLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex flex-col gap-4">
              {PROVIDERS.map((provider) => (
                <ApiKeyRow
                  key={provider.id}
                  provider={provider}
                  isConfigured={configuredProviders.includes(provider.id)}
                  onSaved={(id) => setConfiguredProviders((prev) => [...new Set([...prev, id])])}
                  onRemoved={(id) => setConfiguredProviders((prev) => prev.filter((p) => p !== id))}
                />
              ))}
            </div>
          )}
        </div>
      </>
  );

  // Chat mode = standalone (centered card), side-by-side = inline
  const isStandalone = uiInterface === 'chat';

  const handleClose = () => {
    removeComponent('settings-panel');
  };

  return (
    <Card className={isStandalone ? "w-md min-w-[320px]" : "w-full border-none shadow-none bg-transparent"}>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Manage playground settings</CardDescription>
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

      <CardContent className="flex flex-col gap-6">
        {content}
      </CardContent>
    </Card>
  );
}

