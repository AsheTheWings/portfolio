'use client';

/**
 * McpConfigCardContent - MCP Host Configuration Editor
 * Reusable component for inline or modal use
 */

import { useState } from 'react';
import { Save, ArrowLeft, RefreshCw } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';


hljs.registerLanguage('json', json);

import { loadMcpConfig, saveMcpConfig } from '../utils/mcp-config';
import type { McpConfig, McpClientStatus } from '../types';
import { Label } from '@portfolio/ui/components/shadcn';
import { useAgentConnection } from '../hooks/useAgentConnection';
import { useAgentStore } from '../stores/useAgentStore';

// MCP server info type for type-safe access
interface McpServerInfo {
  status: string;
  tools: Array<{ name: string }>;
  error?: string;
}

interface McpConfigCardContentProps {
  onClose?: () => void;
}

export function McpConfigCardContent({ onClose }: McpConfigCardContentProps) {
  const { client } = useAgentConnection();
  const mcpClientStatus = useAgentStore(state => state.mcpClientStatus);
  const localMcpProblems = useAgentStore((state) => Object.values(state.localMcpProblems));
  
  const connectMcp = async (cfg: McpConfig) => {
    await client.updateMcpConfig(cfg);
  };
  const disconnectMcp = async () => {
    const cfg = loadMcpConfig();
    await client.updateMcpConfig({ ...cfg, enabled: false });
  };

  const mcpServerStatus: Record<string, { status: string }> = {};
  const mcpError: string | null = null;
  const [config, setConfig] = useState<McpConfig>(() => loadMcpConfig());
  const [jsonString, setJsonString] = useState(() => JSON.stringify(loadMcpConfig(), null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleJsonChange = (value: string) => {
    // Update the raw string immediately to allow typing
    setJsonString(value);
  };

  const validateAndParseJson = () => {
    try {
      const parsed = JSON.parse(jsonString);
      setConfig(parsed);
      setJsonError(null);
      return true;
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
      return false;
    }
  };

  const handleRestart = async () => {
    setIsReconnecting(true);
    try {
      // Disconnect if currently connected
      if (mcpClientStatus !== 'idle') {
        await disconnectMcp();
      }

      // Reconnect with current config
      if (config.enabled && config.servers.length > 0) {
        await connectMcp(config);
      }
    } catch (err: unknown) {
      useAgentStore.getState().setLocalMcpProblem({
        id: 'local-mcp:registration:host',
        code: 'MCP_HOST_UNAVAILABLE',
        message: 'The local MCP connection could not be restarted.',
        operation: 'registration',
        retryable: true,
        recoveryActions: ['retry', 'inspect_mcp_configuration'],
        observedAt: new Date().toISOString(),
      });
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleSave = async () => {
    // Validate JSON before saving
    if (!validateAndParseJson()) {
      return;
    }

    const shouldReconnect = window.confirm(
      'Saving MCP configuration will reconnect to the MCP host. Continue?'
    );

    if (!shouldReconnect) {
      return;
    }

    setIsReconnecting(true);

    try {
      // Disconnect if currently connected
      if (mcpClientStatus !== 'idle') {
        await disconnectMcp();
      }

      // Save config
      saveMcpConfig(config);

      // Reconnect with new config (even if empty - for consistent restart behavior)
      if (config.enabled) {
        await connectMcp(config);
      }

      onClose?.();
    } catch (err: unknown) {
      // Keep panel open, show error
      useAgentStore.getState().setLocalMcpProblem({
        id: 'local-mcp:configuration:host',
        code: 'MCP_CONFIGURATION_INVALID',
        message: 'The local MCP configuration could not be applied.',
        operation: 'configuration',
        retryable: false,
        recoveryActions: ['inspect_mcp_configuration'],
        observedAt: new Date().toISOString(),
      });
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex-1 flex flex-col gap-6  overflow-y-auto pr-2 scrollbar-inner">
        <div className="flex justify-between">
          <Label>MCP Config</Label>
          
          {/* MCP Client Status */}
          <div className="flex items-center gap-2 text-xs">
            <Label className="font-normal text-[0.805rem]">
              MCP client status
            </Label>
            {mcpClientStatus === 'connected' && !isReconnecting && (
              <span className="text-green-600 dark:text-green-400">
                Connected
              </span>
            )}
            {(mcpClientStatus === 'connecting' || isReconnecting) && (
              <span className="text-yellow-600 dark:text-yellow-400">
                Connecting
              </span>
            )}
            {mcpClientStatus === 'notConnected' && !isReconnecting && (
              <span className="text-orange-600 dark:text-orange-400">
                Not Connected
              </span>
            )}
            {mcpClientStatus === 'idle' && !isReconnecting && (
              <span className="text-muted-foreground">
                Idle
              </span>
            )}
            {mcpClientStatus === 'error' && !isReconnecting && (
              <span className="text-red-600 dark:text-red-400">
                Error: {mcpError}
              </span>
            )}
            
            {/* Restart Button */}
            <button
              onClick={handleRestart}
              disabled={isReconnecting || mcpClientStatus === 'connecting'}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:text-primary/80 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Restart MCP connection"
            >
              <RefreshCw className={`w-3 h-3 ${isReconnecting || mcpClientStatus === 'connecting' ? 'animate-spin' : ''}`} />
              Restart
            </button>
          </div>
        </div>

        {/* Server Status Section */}
        {config.enabled && config.servers.length > 0 && mcpClientStatus !== 'idle' && mcpClientStatus !== 'connecting' && (
          <div className="flex flex-col gap-3">
            <Label className="font-normal text-[0.805rem]">Server Status</Label>
            <div className="flex flex-col gap-3 border border-border rounded-md p-3">
              {config.servers.map((server) => {
                // Get server info from mcpServerStatus with type assertion
                const serverInfo = mcpServerStatus[server.name] as McpServerInfo | undefined;
                const isConnected = serverInfo?.status === 'connected';
                const isError = serverInfo?.status === 'error';
                const tools = serverInfo?.tools || [];
                
                return (
                  <div key={server.name} className="flex flex-col gap-1">
                    {/* Server Name and Status */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{server.name}</span>
                      {isConnected && tools.length > 0 && (
                        <span className="text-xs text-green-600 dark:text-green-400">● Active</span>
                      )}
                      {isConnected && tools.length === 0 && (
                        <span className="text-xs text-orange-600 dark:text-orange-400">● No tools</span>
                      )}
                      {isError && (
                        <span className="text-xs text-red-600 dark:text-red-400">● Error</span>
                      )}
                    </div>
                    
                    {/* Available Tools or Error Message */}
                    {tools.length > 0 ? (
                      <div className="text-xs text-muted-foreground pl-2">
                        {tools.length} tool{tools.length !== 1 ? 's' : ''}: {tools.map((t) => t.name).join(', ')}
                      </div>
                    ) : isError && serverInfo?.error ? (
                      <div className="text-xs text-red-600 dark:text-red-400 pl-2">
                        {serverInfo.error}
                      </div>
                    ) : isConnected ? (
                      <div className="text-xs text-muted-foreground pl-2">
                        Server connected but provided no tools
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            
            {mcpError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Error: {mcpError}
              </p>
            )}
          </div>
        )}

        {localMcpProblems.length > 0 && (
          <div
            role="alert"
            aria-live="polite"
            className="space-y-2 rounded-md border border-red-500/40 bg-red-500/5 p-3"
          >
            <Label className="text-red-600 dark:text-red-400">
              Local MCP needs attention
            </Label>
            {localMcpProblems.map((problem) => (
              <div key={problem.id} className="text-xs">
                <p className="font-medium">{problem.message}</p>
                <p className="mt-1 font-mono text-muted-foreground">
                  {problem.code}
                  {problem.server ? ` · ${problem.server}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* JSON Editor */}
        <div className="flex-1 flex flex-col gap-3">
          <Label htmlFor="mcp-json" className="font-normal text-[0.805rem]">
            Configuration JSON
          </Label>
          <div className="json-highlight flex-1 min-h-[300px] mx-1 border border-input rounded-md code-editor-container">
            <Editor
              value={jsonString}
              onValueChange={handleJsonChange}
              highlight={(code) => hljs.highlight(code, { language: 'json' }).value}
              padding={10}
              tabSize={2}
              insertSpaces={true}
              onBlur={validateAndParseJson}
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.75rem',
                lineHeight: '1.5',
                minHeight: '300px',
                maxWidth: '800px',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}
              className="min-h-[300px]"
            />
          </div>
          {jsonError && (
            <p className=" text-xs text-red-600 dark:text-red-400">
              Invalid JSON: {jsonError}
            </p>
          )}
        </div>


      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 border-t border-foreground pt-3">
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Back to config"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isReconnecting || !!jsonError}
          className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 
                   rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto">
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  );
}
