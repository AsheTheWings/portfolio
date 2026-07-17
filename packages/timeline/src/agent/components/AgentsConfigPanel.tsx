/**
 * Agent Configuration Panel
 * Configure agent execution parameters and capabilities
 */

'use client';

import React, { useState } from 'react';
import { Checkbox as MuiCheckbox } from '@mui/material';
import { Wrench, ArrowLeft, Pen, ChevronDown, Check } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  Label,
  Textarea,
  Slider,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Avatar,
  AvatarImage,
  AvatarFallback,
  InputWithStackedButtons,
  Input,
} from '@portfolio/ui/components/shadcn';
import { agentimeHttp } from '../lib/agentime-client';
import { revalidateAcquiredAgents } from '../hooks/useAcquiredAgentsQuery';
import type { AgentConfig, Agent } from '../types/session';
import type { JsonValue } from '@agentime/protocol';
import type { Tool, McpHostStatus } from '../types/tools';
import { useAgentStore, selectModel } from '../stores/useAgentStore';
import { createDefaultAgentConfig } from '../utils/agent-factory';
import { useAgent } from '../hooks/useAgent';
import { useConfiguredProviders } from '../hooks/useConfiguredProviders';
import { McpConfigCardContent } from './McpConfigCardContent';
import { ModelPickerView } from './ModelPickerView';
import { ModelParameterControl } from './ModelParameterControl';
import {
  getModelContextLength,
  getModelDisplayName,
  modelSupportsTools,
} from '../utils/models';

export function AgentsConfigPanel() {
  // Store state
  const { agents, agentConfig, updateFrontAgentConfig, setFrontAgent, toolsPool, modelsPool, modelParameters, removeComponent, uiInterface, upsertSystemPanel } = useAgent();
  // MCP is Phase 3 — stub as not connected
  const mcpHostStatus = 'notConnected' as McpHostStatus;

  // UI state (not part of agent config)
  const [showMcpConfig, setShowMcpConfig] = useState(false);
  const [showSystemInstructions, setShowSystemInstructions] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showExportForm, setShowExportForm] = useState(false);

  // BYOK: check whether user has OpenRouter / Tera keys configured
  const { configuredProviders } = useConfiguredProviders();
  const hasOpenRouterKey = configuredProviders.has('openrouter');
  const hasTeraKey = configuredProviders.has('tera');

  // Front agent + config (single source of truth)
  const frontAgent: Agent | undefined = agents[0];
  const acquiredAgentsMap = useAgentStore((s) => s.acquiredAgents);
  const acquiredAgent = frontAgent && frontAgent.agentId !== 'none' ? acquiredAgentsMap[frontAgent.agentId] : undefined;

  const config = agentConfig || createDefaultAgentConfig(undefined, modelsPool);
  const setAgentConfig = updateFrontAgentConfig;

  // Selected model is resolved by `(providerId, modelId)`.
  const selectedModelSpec = selectModel(modelsPool, {
    providerId: config.providerId ?? 'openrouter',
    modelId: config.modelId,
  });
  const supportsToolCalling = modelSupportsTools(selectedModelSpec);
  // Render parameters in registry order, intersected with the selected model
  // and filtered by `schema.hidden`. Registry order IS the rendering contract.
  const supportedParameters = new Set(selectedModelSpec?.supportedParameters ?? []);
  const visibleParameterSchemas = modelParameters
    .filter((schema) => !schema.hidden && supportedParameters.has(schema.key));

  // Chat mode = standalone (centered card), side-by-side = inline
  const isStandalone = uiInterface === 'chat';

  const handleClose = () => {
    removeComponent('configurations-panel');
  };

  // Helper to update any config field
  const updateConfig = (updates: Partial<AgentConfig>) => {
    setAgentConfig({ ...config, ...updates });
  };

  const updateProviderParameters = (updates: Record<string, JsonValue | undefined>) => {
    const next: Record<string, JsonValue> = { ...(config.providerParameters ?? {}) };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null || value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
    }
    updateConfig({ providerParameters: next });
  };

  // Helper to update availableTools
  const availableTools = config.availableTools || [];
  const updateAvailableTools = (tools: Tool[]) => {
    updateConfig({ availableTools: tools });
  };

  // Helper to handle model change.
  const handleModelChange = ({ providerId, modelId }: { providerId: string; modelId: string }) => {
    updateConfig({ providerId, modelId });
  };


  return (
    <Card className={isStandalone ? "w-md min-w-[320px] lg:h-[76vh] lg:w-full" : "w-full border-none shadow-none bg-transparent"}>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">

            <CardTitle>Agents Configuration</CardTitle>
          </div>
          <CardDescription>Configure agents behavior and capabilities</CardDescription>
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

      <CardContent className={`h-full lg:overflow-y-auto lg:[scrollbar-gutter:stable] scrollbar-inner`}>
        {/* Additional Content */}
        {/* MCP Config Editor */}
        {(showMcpConfig || showSystemInstructions || showModelPicker || showExportForm) ? (
          <div className="h-full">
            {showMcpConfig ? (
                <McpConfigCardContent onClose={() => setShowMcpConfig(false)} />
              ) : showModelPicker ? (
                  <ModelPickerView
                  models={modelsPool}
                  selectedModelId={config.modelId}
                  selectedProviderId={config.providerId ?? 'openrouter'}
                  onSelect={handleModelChange}
                  onClose={() => setShowModelPicker(false)}
                  configuredProviders={configuredProviders}
                  onOpenSettings={() => {
                    setShowModelPicker(false);
                    upsertSystemPanel('settings-panel', 'settings-panel');
                  }}
                />
              ) : showExportForm ? (
                <ExportAgentForm onBack={() => setShowExportForm(false)} />
              ) :
              showSystemInstructions && (
              /* System Instructions Editor */
              <div className="h-full flex flex-col gap-3">
                <Label htmlFor="systemInstructions-editor">System Instructions</Label>
                <Textarea
                  id="systemInstructions-editor"
                  value={config.clientInstructions || ''}
                  onChange={(e) => updateConfig({ clientInstructions: e.target.value || undefined })}
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
          <div className="grid grid-cols-1 gap-6 pb-4 lg:grid-cols-2">
            <div className="flex flex-col">
              {/* Agent Selection */}
              <div className="mb-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label>Agent</Label>
                  <button
                    onClick={() => setShowExportForm(true)}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Export as Agent
                  </button>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-background dark:bg-zinc-900 border border-input rounded-md text-foreground dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <Avatar className="size-5">
                        {acquiredAgent?.portraitRef && (
                          <AvatarImage src={acquiredAgent.portraitRef} alt={acquiredAgent.name} />
                        )}
                        <AvatarFallback color={acquiredAgent?.color ?? '#E2E8F0'} className="text-[10px]">
                          {(acquiredAgent?.name ?? 'A').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-left truncate">{acquiredAgent?.name ?? 'Assistant'}</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                    {agents.map((a) => {
                      const saved = a.agentId !== 'none' ? acquiredAgentsMap[a.agentId] : undefined;
                      const name = saved?.name ?? 'Assistant';
                      const color = saved?.color ?? '#E2E8F0';
                      const avatarImage = saved?.portraitRef;
                      const isActive = a.agentId === frontAgent?.agentId;

                      return (
                        <DropdownMenuItem
                          key={a.agentId}
                          onClick={() => { if (!isActive) setFrontAgent(a.agentId); }}
                          className="flex items-center gap-2"
                        >
                          <Avatar className="size-5">
                            {avatarImage && <AvatarImage src={avatarImage} alt={name} />}
                            <AvatarFallback color={color} className="text-[10px]">
                              {name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate">{name}</span>
                          {isActive && <Check className="w-4 h-4 text-primary" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Model Selection */}
              <div className="mb-6 flex flex-col gap-3" >
                <Label>Model</Label>
                {!hasOpenRouterKey && !hasTeraKey && modelsPool.filter((m) => m.providerId !== 'openrouter' && m.providerId !== 'tera').length === 0 ? (
                  <button
                    type="button"
                    onClick={() => upsertSystemPanel('settings-panel', 'settings-panel')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-700 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-ring hover:bg-amber-500/20 transition-colors cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                      <path d="M8 1L1 14h14L8 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    <span className="flex-1 text-left truncate">Add an LLM API key to get started</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowModelPicker(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-background dark:bg-zinc-900 border border-input rounded-md text-foreground dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-ring hover:bg-accent transition-colors"
                  >
                    <span className="flex-1 text-left truncate">{selectedModelSpec ? getModelDisplayName(selectedModelSpec) : config.modelId}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
                {selectedModelSpec && (
                  <p className="text-xs text-muted-foreground">
                    Context: {getModelContextLength(selectedModelSpec)?.toLocaleString() || 'Unknown'} tokens
                  </p>
                )}
              </div>

              {/* System Instructions */}
              <div className="mb-6 flex flex-col gap-3">
                <Label>System Instructions</Label>
                {config.clientInstructions ? (
                  <button
                    onClick={() => setShowSystemInstructions(true)}
                    className="flex items-center justify-between gap-2 p-3 text-left border border-input rounded-md hover:bg-secondary transition-colors group"
                  >
                    <span className="text-sm text-muted-foreground truncate">
                      {config.clientInstructions.slice(0, 100)}{config.clientInstructions.length > 100 ? '...' : ''}
                    </span>
                    <Pen className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowSystemInstructions(true)}
                    className="flex items-center justify-center gap-2 p-4 py-8 border border-dashed border-input rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <span className="text-xs">Add System Instructions</span>
                    <Pen className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Run Limits */}
              <div className="mb-6 flex flex-col gap-3">
                  <Label>Run Limits</Label>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="maxModelCalls" className="font-normal text-[0.805rem]">Max Model Responses</Label>
                    <div className="flex items-center gap-3">
                      <Slider
                        id="maxModelCalls"
                        className="flex-1"
                        min={1}
                        max={100}
                        step={1}
                        value={[config.maxModelCalls]}
                        onValueChange={([value]) => updateConfig({ maxModelCalls: value })}
                      />
                      <InputWithStackedButtons
                        value={config.maxModelCalls}
                        onChange={(value) => updateConfig({ maxModelCalls: value })}
                        minValue={1}
                        maxValue={100}
                        step={1}
                        className="w-24"
                        inputClassName="text-xs md:text-xs"
                      />
                    </div>
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

              {/* Streaming Section */}
              <div className="mb-6 flex flex-col gap-3" >
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

              {/* MCP Tools Section */}
              {supportsToolCalling && (
                <div className="mb-6 flex flex-col gap-3">
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
                              return (
                                <button
                                  key={`${tool.server}:${tool.tool}`}
                                  onClick={() => {
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
                                  className={`
                                    px-3 py-1 rounded-sm text-[0.68rem] font-mono transition-all cursor-pointer
                                    ${isEnabled
                                      ? isBuiltin
                                        ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/50 hover:bg-cyan-500/30'
                                        : 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/50 hover:bg-orange-500/30'
                                      : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                                    }
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
                        <Label htmlFor="maxConcurrentTools" className="text-[0.805rem]">Max Concurrent Tools</Label>
                        <div className="flex items-center gap-3">
                          <Slider
                            id="maxConcurrentTools"
                            className="flex-1"
                            min={1}
                            max={10}
                            step={1}
                            value={[config.maxConcurrentTools]}
                            onValueChange={([value]) => updateConfig({ maxConcurrentTools: value })}
                          />
                          <InputWithStackedButtons
                            value={config.maxConcurrentTools}
                            onChange={(value) => updateConfig({ maxConcurrentTools: value })}
                            minValue={1}
                            maxValue={10}
                            step={1}
                            className="w-24"
                            inputClassName="text-xs md:text-xs"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col">
              {/* Model parameters (rendered in registry order). */}
              {visibleParameterSchemas.length > 0 && (
                <div className="mb-6 flex flex-col gap-3">
                  <Label>Generation Parameters</Label>
                  <div className="flex flex-col gap-2">
                    {visibleParameterSchemas.map((schema) => (
                      <ModelParameterControl
                        key={schema.key}
                        schema={schema}
                        providerParameters={config.providerParameters ?? {}}
                        defaultValue={schema.default}
                        onUpdate={updateProviderParameters}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Export Agent Form — replaces entire config view
// ============================================================

interface ExportAgentFormProps {
  onBack: () => void;
}

function ExportAgentForm({ onBack }: ExportAgentFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const agentConfig = useAgentStore((s) => s.agents[0]?.config ?? null);

  const handleSave = async () => {
    if (!name.trim() || !agentConfig) return;
    setSaving(true);
    try {
      const created = await agentimeHttp.createAgent({
        name: name.trim(),
        description: description.trim() || null,
        config: agentConfig,
        visibility: isPublic ? 'public' : 'private',
        generatePortrait: true,
      });

      // Seed the acquired-agents map optimistically so the popover/config panel
      // can resolve the new agent's name/avatar immediately, then revalidate
      // against the server for the canonical record (e.g. once the avatar is ready).
      const store = useAgentStore.getState();
      const merged = [...Object.values(store.acquiredAgents), created];
      store.setAcquiredAgents(merged);

      // Add to the active session list and bring to front (auto-select).
      store.addAgent(created.id, created.config);
      store.setFrontAgent(created.id);

      revalidateAcquiredAgents();

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
      <div className="h-full flex flex-col justify-center items-center text-xs text-primary py-8 text-center">
        <span className="font-semibold text-sm">Agent created!</span>
        <span className="text-muted-foreground mt-1">Avatar is generating...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">Export as Agent</h4>
        <p className="text-xs text-muted-foreground">
          Export the current configuration as a reusable agent.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-agent-name" className="text-xs">Agent Name</Label>
          <Input
            id="export-agent-name"
            placeholder="Agent name (required)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs"
            maxLength={50}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-agent-desc" className="text-xs">Description</Label>
          <Input
            id="export-agent-desc"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 text-xs"
            maxLength={200}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <MuiCheckbox
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              size="small"
              disableRipple
              sx={{ padding: '2px', color: 'var(--color-border)', '&.Mui-checked': { color: 'var(--color-primary)' } }}
            />
            Public Agent
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Back to config"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 
                   rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
