/**
 * Agent Configuration Panel
 * Configure agent execution parameters and capabilities
 */

'use client';

import React, { useState } from 'react';
import { Checkbox as MuiCheckbox } from '@mui/material';
import { Wrench, ArrowLeft, Pen } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  Label,
  Input,
  Textarea,
  Slider,
} from '@/features/shared/components/shadcn';
import type { AgentConfig, NativeTool, Tool, McpHostStatus } from '../types';
import { createDefaultAgentConfig, MODEL_REGISTRY, getModelSpec, hasCapability } from '../services/models-registry';

import { ModelCapability } from '../types';
import { useAgent } from '../hooks/useAgent';
import { McpConfigCardContent } from './McpConfigCardContent';

export function AgentConfigPanel() {
  // Store state
  const { agentConfig, setAgentConfig, toolsPool, workflowsPool, removeComponent, uiMode } = useAgent();
  // MCP is Phase 3 — stub as not connected
  const mcpHostStatus = 'notConnected' as McpHostStatus;

  // UI state (not part of agent config)
  const [showMcpConfig, setShowMcpConfig] = useState(false);
  const [showSystemInstructions, setShowSystemInstructions] = useState(false);
  const [showNativeToolsWarning, setShowNativeToolsWarning] = useState(false);

  // Read all config directly from store (single source of truth)
  const config = agentConfig || createDefaultAgentConfig();
  const availableTools = config.availableTools || [];

  // Model capabilities (dynamically from registry)
  const modelOptions = Object.values(MODEL_REGISTRY);
  const selectedModelSpec = getModelSpec(config.model);
  const supportsThinking = hasCapability(config.model, ModelCapability.THINKING);
  const supportsToolCalling = hasCapability(config.model, ModelCapability.TOOL_CALLING);

  // Group models by provider for the dropdown
  const modelsByProvider = modelOptions.reduce<Record<string, typeof modelOptions>>((acc, model) => {
    const provider = model.provider;
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {});

  const providerLabels: Record<string, string> = {
    google: 'Google',
    fireworks: 'Fireworks AI',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
  };

  // Chat mode = standalone (centered card), side-by-side = inline
  const isStandalone = uiMode === 'chat';

  const handleClose = () => {
    removeComponent('configurations-panel');
  };

  // Helper to update any config field
  const updateConfig = (updates: Partial<AgentConfig>) => {
    setAgentConfig({ ...config, ...updates });
  };

  // Helper to update availableTools
  const updateAvailableTools = (tools: Tool[]) => {
    updateConfig({ availableTools: tools });
  };

  // Helper to update selectedNativeTools
  const updateSelectedNativeTools = (tools: NativeTool[]) => {
    updateConfig({ selectedNativeTools: tools });
  };

  // Helper to handle model change with thinking capability auto-update
  const handleModelChange = (modelName: string) => {
    const newModelSpec = getModelSpec(modelName);
    const newSupportsThinking = hasCapability(modelName, ModelCapability.THINKING);
    
    updateConfig({
      model: modelName,
      provider: newModelSpec?.provider || 'google',
      enableThinking: newSupportsThinking,
      includeThoughtsInResponse: newSupportsThinking,
    });
  };

  // Helper to check if a native tool is selected
  const isNativeToolSelected = (tool: NativeTool) => {
    return config.selectedNativeTools.some(t => t.id === tool.id);
  };

  // Helper to toggle native tool selection
  const toggleNativeTool = (tool: NativeTool, checked: boolean) => {
    if (checked) {
      updateSelectedNativeTools([...config.selectedNativeTools, tool]);
    } else {
      updateSelectedNativeTools(config.selectedNativeTools.filter(t => t.id !== tool.id));
    }
  };


  return (
    <Card className={isStandalone ? "w-md min-w-[320px] lg:h-[76vh] lg:w-full" : "w-full border-none shadow-none bg-transparent"}>
      <CardHeader>
        <CardTitle>Agent Configuration</CardTitle>
        <CardDescription>Configure model behavior and capabilities</CardDescription>
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

      <CardContent className={`h-full pb-4 lg:overflow-y-auto lg:[scrollbar-gutter:stable] scrollbar-inner`}>
        {/* Additional Content */}
        {/* MCP Config Editor */}
        {(showMcpConfig || showSystemInstructions) ? (
          <div className="h-full">
            {showMcpConfig ? (
                <McpConfigCardContent onClose={() => setShowMcpConfig(false)} />
              ) :
              showSystemInstructions && (
              /* System Instructions Editor */
              <div className="h-full flex flex-col gap-3">
                <Label htmlFor="systemInstructions-editor">System Instructions</Label>
                <Textarea
                  id="systemInstructions-editor"
                  value={config.systemInstructions || ''}
                  onChange={(e) => updateConfig({ systemInstructions: e.target.value || undefined })}
                  placeholder="You are a helpful assistant..."
                  className="flex-1 my-2 resize-none h-full"
                />

                <button
                  onClick={() => {
                    setShowMcpConfig(false);
                    setShowSystemInstructions(false);
                  }}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Back to config"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">Back</span>
                </button>
              </div>
            )}
          </div>

          ) : (

          /* Main Content */
          <div className={`flex flex-col ${isStandalone ? 'lg:block lg:h-full lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-6' : ''}`}>
            <div>
              {/* Model Selection */}
              <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3" >
                <Label htmlFor="model">Model</Label>
                <select
                  id="model"
                  value={config.model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background dark:bg-zinc-900 border border-input rounded-md text-foreground dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-ring [&>option]:bg-background [&>option]:dark:bg-zinc-900 [&>option]:text-foreground [&>option]:dark:text-zinc-200"
                >
                  {Object.entries(modelsByProvider).map(([provider, models]) => (
                    <optgroup key={provider} label={providerLabels[provider] || provider}>
                      {models.map((model) => (
                        <option key={model.id} value={model.id} className="bg-background dark:bg-zinc-900 text-foreground dark:text-zinc-200">
                          {model.displayName || model.id}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Max tokens: {selectedModelSpec?.maxTokens?.toLocaleString() || 'Unknown'}
                </p>
              </div>

              {/* System Instructions */}
              <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3">
                <Label>System Instructions</Label>
                {config.systemInstructions ? (
                  <button
                    onClick={() => setShowSystemInstructions(true)}
                    className="flex items-center justify-between gap-2 p-3 text-left border border-input rounded-md hover:bg-secondary transition-colors group"
                  >
                    <span className="text-sm text-muted-foreground truncate">
                      {config.systemInstructions.slice(0, 100)}{config.systemInstructions.length > 100 ? '...' : ''}
                    </span>
                    <Pen className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowSystemInstructions(true)}
                    className="flex items-center justify-center gap-2 p-4 border border-dashed border-input rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <span className="text-xs">Add System Instructions</span>
                    <Pen className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Generation Parameters */}
              <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3" >
                <Label>Generation Parameters</Label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="temperature" className="font-normal text-[0.805rem]">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      value={config.temperature}
                      onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
                      min="0"
                      max="2"
                      step="0.1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Controls randomness
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="topP" className="font-normal text-[0.805rem]">Top P</Label>
                    <Input
                      id="topP"
                      type="number"
                      value={config.topP}
                      onChange={(e) => updateConfig({ topP: parseFloat(e.target.value) })}
                      min="0"
                      max="1"
                      step="0.05"
                    />
                    <p className="text-xs text-muted-foreground">
                      Nucleus sampling threshold
                    </p>
                  </div>
                </div>
              </div>

              {/* Streaming Section */}
              <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3" >
                <Label>Streaming</Label>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center">
                    <MuiCheckbox
                      id="enableStream"
                      checked={config.stream}
                      onChange={(e) => updateConfig({ stream: e.target.checked })}
                      size="small"
                      disableRipple
                      sx={{
                        padding: '2px',
                        color: 'var(--color-border)',
                        '&.Mui-checked': { color: 'var(--color-primary)' },
                      }}
                    />
                    <Label htmlFor="enableStream" className="font-normal text-[0.805rem] cursor-pointer">
                      Enable Stream
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground pl-1">
                    When enabled, responses stream incrementally as they&apos;re generated.
                  </p>
                </div>
              </div>

              {/* Thinking Section */}
              {supportsThinking && (
                <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3">
                  <Label>Thinking Mode</Label>
                  
                  <div className="flex items-center">
                    <MuiCheckbox
                      id="enableThinking"
                      checked={config.enableThinking}
                      onChange={(e) => updateConfig({ enableThinking: e.target.checked })}
                      size="small"
                      disableRipple
                      sx={{
                        padding: '2px',
                        color: 'var(--color-border)',
                        '&.Mui-checked': { color: 'var(--color-primary)' },
                      }}
                    />
                    <Label htmlFor="enableThinking" className="font-normal text-[0.805rem] cursor-pointer">
                      Enable Thinking
                    </Label>
                  </div>

                  {config.enableThinking && (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="thinkingBudget" className="font-normal text-[0.805rem]">
                          Thinking Budget
                        </Label>
                        <Input
                          id="thinkingBudget"
                          type="number"
                          value={config.thinkingBudget?.toString() || ''}
                          onChange={(e) => updateConfig({ thinkingBudget: e.target.value ? parseInt(e.target.value) : undefined })}
                          placeholder="Leave empty for default"
                          min={-1}
                          max={1000000}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center">
                          <MuiCheckbox
                            id="includeThoughtsInResponse"
                            checked={config.includeThoughtsInResponse}
                            onChange={(e) => updateConfig({ includeThoughtsInResponse: e.target.checked })}
                            size="small"
                            disableRipple
                            sx={{
                              padding: '2px',
                              color: 'var(--color-border)',
                              '&.Mui-checked': { color: 'var(--color-primary)' },
                            }}
                          />
                          <Label htmlFor="includeThoughtsInResponse" className="font-normal text-[0.805rem] cursor-pointer">
                            Include Thoughts in Response
                          </Label>
                        </div>
                        <p className="text-[0.7rem] text-muted-foreground ml-6">
                          Whether the agent&apos;s thoughts are returned
                        </p>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center">
                          <MuiCheckbox
                            id="includeThoughtsInContext"
                            checked={config.includeThoughtsInContext ?? false}
                            onChange={(e) => updateConfig({ includeThoughtsInContext: e.target.checked })}
                            size="small"
                            disableRipple
                            sx={{
                              padding: '2px',
                              color: 'var(--color-border)',
                              '&.Mui-checked': { color: 'var(--color-primary)' },
                            }}
                          />
                          <Label htmlFor="includeThoughtsInContext" className="font-normal text-[0.805rem] cursor-pointer">
                            Include Thoughts in Context
                          </Label>
                        </div>
                        <p className="text-[0.7rem] text-muted-foreground ml-6">
                          Send agent&apos;s thoughts back to agent as context
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              {/* Native Tools Section */}
              {supportsToolCalling && (
                <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3" >
                  <Label>Native Tools</Label>
                  
                  {selectedModelSpec?.nativeTools && selectedModelSpec.nativeTools.length > 0 ? (
                    <>
                      {selectedModelSpec.nativeTools.map((nativeTool) => {
                        const isSelected = isNativeToolSelected(nativeTool);
                        return (
                          <div key={nativeTool.id} className="flex items-center">
                            <MuiCheckbox
                              id={nativeTool.id}
                              checked={isSelected}
                              onChange={(e) => {
                                if (config.enableTools && e.target.checked) {
                                  setShowNativeToolsWarning(true);
                                  setTimeout(() => setShowNativeToolsWarning(false), 3000);
                                } else {
                                  toggleNativeTool(nativeTool, e.target.checked);
                                }
                              }}
                              size="small"
                              disableRipple
                              sx={{
                                padding: '2px',
                                color: 'var(--color-border)',
                                '&.Mui-checked': { color: 'var(--color-primary)' },
                              }}
                            />
                            <Label htmlFor={nativeTool.id} className="font-normal text-[0.805rem] cursor-pointer">
                              {nativeTool.name}
                            </Label>
                          </div>
                        );
                      })}
                      {showNativeToolsWarning && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-500">
                          ⚠️ Cannot combine native tools with MCP tools
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No native tools available for this model
                    </p>
                  )}
                </div>
              )}

              {/* Workflows Section */}
              {supportsToolCalling && (
                <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3">
                  <Label>Workflows</Label>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center">
                      <MuiCheckbox
                        id="enableWorkflows"
                        checked={config.enableWorkflows ?? true}
                        onChange={(e) => updateConfig({ enableWorkflows: e.target.checked })}
                        size="small"
                        disableRipple
                        sx={{
                          padding: '2px',
                          color: 'var(--color-border)',
                          '&.Mui-checked': { color: 'var(--color-primary)' },
                        }}
                      />
                      <Label htmlFor="enableWorkflows" className="font-normal text-[0.805rem] cursor-pointer">
                        Enable Workflows
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-1">
                      Workflows add orchestration to agent execution
                    </p>
                  </div>
                  {(config.enableWorkflows ?? true) && (
                    <div className="flex flex-wrap gap-2 p-2 max-h-[280px] border border-border rounded-md">
                      {workflowsPool.map(workflow => {
                        const isEnabled = config.selectedWorkflows?.includes(workflow.id) ?? false;
                        return (
                          <button
                            key={workflow.id}
                            onClick={() => {
                              const current = config.selectedWorkflows || [];
                              const updated = isEnabled
                                ? current.filter(id => id !== workflow.id)
                                : [...current, workflow.id];
                              updateConfig({ selectedWorkflows: updated });
                            }}
                            className={`
                              px-3 py-1 rounded-sm text-[0.68rem] font-mono transition-all cursor-pointer
                              ${isEnabled
                                ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/50 hover:bg-violet-500/30'
                                : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                              }
                            `}
                            title={workflow.description}
                          >
                            {workflow.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Output Limits */}
              <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3">
                <Label>Output Limits</Label>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="maxOutputTokens" className="font-normal text-[0.805rem]">Max Output Tokens (optional)</Label>
                  <Input
                    id="maxOutputTokens"
                    type="number"
                    value={config.maxOutputTokens?.toString() || ''}
                    onChange={(e) => updateConfig({ maxOutputTokens: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="Leave empty for default"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <Label htmlFor="maxModelCalls" className="font-normal text-[0.805rem]">Max Model Responses</Label>
                    <span className="text-sm text-muted-foreground">{config.maxModelCalls}</span>
                  </div>
                  <Slider
                    id="maxModelCalls"
                    min={1}
                    max={100}
                    step={1}
                    value={[config.maxModelCalls]}
                    onValueChange={([value]) => updateConfig({ maxModelCalls: value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum allowed model responses in one agent call
                  </p>
                  {config.maxModelCalls === 1 && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      ⚠️ Agent cannot follow up on tool results
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              {/* MCP Tools Section */}
              {supportsToolCalling && (
                <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3">
                  <Label>MCP Tools</Label>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center">
                      <MuiCheckbox
                        id="enableTools"
                        checked={config.enableTools}
                        onChange={(e) => updateConfig({ enableTools: e.target.checked })}
                        size="small"
                        disableRipple
                        sx={{
                          padding: '2px',
                          color: 'var(--color-border)',
                          '&.Mui-checked': { color: 'var(--color-primary)' },
                        }}
                      />
                      <Label htmlFor="enableTools" className="font-normal text-[0.805rem] cursor-pointer">
                        Enable Tools
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-1">
                      Enable tool calling for extended capabilities
                    </p>
                  </div>
                  {config.enableTools && (
                    <>
                      {/* Tools Pool */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                          <Label className="text-[0.805rem]">Tools Pool</Label>
                          {mcpHostStatus === 'connected' && (
                            <button
                              onClick={() => setShowMcpConfig(true)}
                              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span>Edit MCP config</span>
                              <Wrench className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {/* Tool Buttons */}
                        <div className="flex flex-wrap content-start gap-2 max-h-[280px] overflow-y-auto p-2 border border-border rounded-md">
                          {toolsPool.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-4 text-center w-full">
                              No tools available.
                            </div>
                          ) : (
                            toolsPool.map(tool => {
                              const isBuiltin = tool.source === 'builtin';
                              const server = tool.server;
                              const isEnabled = availableTools.some(t => t.server === tool.server && t.tool === tool.tool);
                              const isMcpHostAvailable = mcpHostStatus === 'connected';
                              return (
                                <button
                                  key={`${tool.server}:${tool.tool}`}
                                  onClick={() => {
                                    if (!isMcpHostAvailable && !isBuiltin) return;
                                    if (isEnabled) {
                                      // Remove tool from array
                                      const newTools = availableTools.filter(t => 
                                        !(t.server === tool.server && t.tool === tool.tool)
                                      );
                                      updateAvailableTools(newTools);
                                    } else {
                                      // Add tool to array
                                      updateAvailableTools([...availableTools, tool]);
                                    }
                                  }}
                                  disabled={!isMcpHostAvailable && !isBuiltin}
                                  className={`
                                    px-3 py-1 rounded-sm text-[0.68rem] font-mono transition-all
                                    ${isEnabled
                                      ? isBuiltin
                                        ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/50 hover:bg-cyan-500/30'
                                        : 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/50 hover:bg-orange-500/30'
                                      : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                                    }
                                    ${!isMcpHostAvailable && !isBuiltin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                  `}
                                  title={tool.description}
                                >
                                  {server}/{tool.tool}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Max Concurrent Tools */}
                      <div className="flex flex-col gap-2 pt-2">
                        <div className="flex justify-between">
                          <Label htmlFor="maxConcurrentTools" className="text-[0.805rem]">Max Concurrent Tools</Label>
                          <span className="text-sm text-muted-foreground">{config.maxConcurrentTools}</span>
                        </div>
                        <Slider
                          id="maxConcurrentTools"
                          min={1}
                          max={10}
                          step={1}
                          value={[config.maxConcurrentTools]}
                          onValueChange={([value]) => updateConfig({ maxConcurrentTools: value })}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
