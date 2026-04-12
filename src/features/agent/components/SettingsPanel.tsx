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

export function SettingsPanel() {
  const [apiKeys, setApiKeys] = useState<string[]>(['']);
  const { removeComponent, uiMode, setUiMode } = useAgent();
  // MCP is Phase 3 — stub as no-ops / not connected
  const connectMcp = useCallback(async (_config: unknown) => { /* Phase 3 */ }, []);
  const disconnectMcp = useCallback(async () => { /* Phase 3 */ }, []);
  const mcpHostStatus = 'notConnected' as McpHostStatus;
  const [mcpEnabled, setMcpEnabled] = useState(() => loadMcpConfig().enabled);
  const [mcpPort, setMcpPort] = useState(() => loadMcpConfig().port);
  const prevMcpPort = useRef(mcpPort);

  const handleAddApiKey = () => {
    setApiKeys([...apiKeys, '']);
  };

  const handleRemoveApiKey = (index: number) => {
    setApiKeys(apiKeys.filter((_, i) => i !== index));
  };

  const handleApiKeyChange = (index: number, value: string) => {
    const newKeys = [...apiKeys];
    newKeys[index] = value;
    setApiKeys(newKeys);
  };

  const handleMcpEnabledToggle = async () => {
    const newEnabled = !mcpEnabled;
    setMcpEnabled(newEnabled);
    
    const config = loadMcpConfig();
    config.enabled = newEnabled;
    saveMcpConfig(config);
    
    // Connect or disconnect based on new state
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
    // Only reconnect if port actually changed
    if (prevMcpPort.current === mcpPort) {
      return;
    }

    // Only reconnect if MCP is enabled and was previously connected or in error state
    if (!mcpEnabled || mcpHostStatus === 'notConnected') {
      prevMcpPort.current = mcpPort;
      return;
    }

    // Debounce: wait 1 second after last port change
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
                onClick={() => setUiMode('chat')}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  uiMode === 'chat'
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

            {/* Side-by-Side Layout */}
            <div className="flex-1">
              <button
                onClick={() => setUiMode('side-by-side')}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  uiMode === 'side-by-side'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg width="40" height="28" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="2" width="36" height="24" stroke="currentColor" strokeWidth="2" fill="none" />
                    <line x1="20" y1="2" x2="20" y2="26" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span className="text-sm font-medium">Side-by-Side</span>
                  <span className="text-xs text-muted-foreground text-center">Agent-User split view</span>
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

        {/* API Keys Section */}
        <div className="flex flex-col gap-3 pt-6 border-t border-border">
          <Label>API Keys</Label>
          
          <div className="flex flex-col gap-2">
            {apiKeys.map((key, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  type="password"
                  value={key}
                  onChange={(e) => handleApiKeyChange(index, e.target.value)}
                  placeholder={`API Key ${index + 1}`}
                  className="flex-1"
                />
                {apiKeys.length > 1 && (
                  <button
                    onClick={() => handleRemoveApiKey(index)}
                    className="p-2 hover:bg-accent rounded transition-colors text-destructive"
                    title="Remove API key"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add API Key Button */}
          <button
            onClick={handleAddApiKey}
            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add API Key
          </button>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Note: API keys are managed on the frontend for now. No actual business logic is implemented yet.
            </p>
          </div>
        </div>
      </>
  );

  // Chat mode = standalone (centered card), side-by-side = inline
  const isStandalone = uiMode === 'chat';

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
