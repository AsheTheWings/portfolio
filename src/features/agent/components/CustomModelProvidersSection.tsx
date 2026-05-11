'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input, Label, Switch, Textarea } from '@/features/shared/components/shadcn';
import { useAgent } from '../hooks/useAgent';
import type { ModelSpec } from '../types';
import { getModelContextLength, getModelDisplayName } from '../utils/openrouter-models';
import { httpClient } from '@/features/shared/utils/http-client';

type CustomModelParameter =
  | 'temperature'
  | 'top_p'
  | 'top_k'
  | 'min_p'
  | 'top_a'
  | 'frequency_penalty'
  | 'presence_penalty'
  | 'repetition_penalty'
  | 'max_tokens'
  | 'max_completion_tokens'
  | 'logit_bias'
  | 'logprobs'
  | 'top_logprobs'
  | 'seed'
  | 'response_format'
  | 'structured_outputs'
  | 'stop'
  | 'tools'
  | 'tool_choice'
  | 'parallel_tool_calls'
  | 'include_reasoning'
  | 'reasoning'
  | 'reasoning_effort'
  | 'web_search_options'
  | 'verbosity';

interface OpenRouterCompatibleModel {
  architecture: {
    inputModalities: string[];
    instructType?: string | null;
    modality: string | null;
    outputModalities: string[];
    tokenizer?: string;
  };
  canonicalSlug: string;
  contextLength: number | null;
  created: number;
  defaultParameters: Record<string, unknown> | null;
  description?: string;
  expirationDate?: string | null;
  huggingFaceId?: string | null;
  id: string;
  knowledgeCutoff?: string | null;
  links: { details: string };
  name: string;
  perRequestLimits: { completionTokens: number; promptTokens: number } | null;
  pricing: { prompt: string; completion: string; [key: string]: unknown };
  supportedParameters: CustomModelParameter[];
  supportedVoices: string[] | null;
  topProvider: {
    contextLength?: number | null;
    isModerated: boolean;
    maxCompletionTokens?: number | null;
  };
}

interface ProviderModelSettings {
  id: string;
  providerId: string;
  modelId: string;
  model: OpenRouterCompatibleModel;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserModelProviderSettings {
  id: string;
  providerKey: string;
  name: string;
  baseURL: string;
  headers: Record<string, string>;
  enabled: boolean;
  hasApiKey: boolean;
  credentialProvider: `model-provider:${string}`;
  models: ProviderModelSettings[];
  createdAt: string;
  updatedAt: string;
}

interface ModelDraft {
  id: string;
  name: string;
  contextLength: string;
  supportsImageInput: boolean;
  supportedParameters: CustomModelParameter[];
}

interface ProviderDraft {
  id?: string;
  providerKey: string;
  name: string;
  baseURL: string;
  apiKey: string;
  removeApiKey: boolean;
  enabled: boolean;
  headersJson: string;
  models: ModelDraft[];
}

const EMPTY_MODEL: ModelDraft = {
  id: '',
  name: '',
  contextLength: '',
  supportsImageInput: true,
  supportedParameters: ['temperature', 'top_p', 'max_tokens', 'tools'],
};

const EMPTY_PROVIDER: ProviderDraft = {
  providerKey: '',
  name: '',
  baseURL: '',
  apiKey: '',
  removeApiKey: false,
  enabled: true,
  headersJson: '{}',
  models: [{ ...EMPTY_MODEL }],
};

const FALLBACK_MODEL_PLACEHOLDER = {
  id: 'moonshotai/kimi-k2.6',
  name: 'Kimi K2.6',
  contextLength: '262144',
};

const PARAMETER_OPTIONS: Array<{ value: CustomModelParameter; label: string }> = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'top_p', label: 'Top P' },
  { value: 'top_k', label: 'Top K' },
  { value: 'min_p', label: 'Min P' },
  { value: 'frequency_penalty', label: 'Frequency Penalty' },
  { value: 'presence_penalty', label: 'Presence Penalty' },
  { value: 'max_tokens', label: 'Max Tokens' },
  { value: 'max_completion_tokens', label: 'Max Completion Tokens' },
  { value: 'stop', label: 'Stop' },
  { value: 'tools', label: 'Tools' },
  { value: 'tool_choice', label: 'Tool Choice' },
  { value: 'parallel_tool_calls', label: 'Parallel Tool Calls' },
  { value: 'response_format', label: 'Response Format' },
  { value: 'structured_outputs', label: 'Structured Outputs' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'reasoning_effort', label: 'Reasoning Effort' },
  { value: 'include_reasoning', label: 'Include Reasoning' },
  { value: 'verbosity', label: 'Verbosity' },
  { value: 'seed', label: 'Seed' },
];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-provider';
}

function buildModelFromDraft(draft: ModelDraft, providerName: string, baseURL: string): OpenRouterCompatibleModel {
  const contextLength = draft.contextLength.trim() ? Number.parseInt(draft.contextLength.trim(), 10) : null;
  const id = draft.id.trim();
  const name = draft.name.trim() || id;
  const safeBaseURL = baseURL.replace(/\/$/, '');
  const inputModalities = draft.supportsImageInput ? ['text', 'image'] : ['text'];

  return {
    architecture: {
      inputModalities,
      modality: draft.supportsImageInput ? 'text+image->text' : 'text->text',
      outputModalities: ['text'],
    },
    canonicalSlug: id,
    contextLength,
    created: Math.floor(Date.now() / 1000),
    defaultParameters: null,
    description: `${name} via ${providerName}`,
    id,
    links: { details: safeBaseURL || 'custom-provider' },
    name,
    perRequestLimits: contextLength ? { promptTokens: contextLength, completionTokens: Math.max(1, Math.floor(contextLength / 2)) } : null,
    pricing: { prompt: '0', completion: '0' },
    supportedParameters: draft.supportedParameters,
    supportedVoices: null,
    topProvider: {
      contextLength,
      isModerated: false,
      maxCompletionTokens: contextLength ? Math.max(1, Math.floor(contextLength / 2)) : null,
    },
  };
}

function modelDraftFromSettings(model: OpenRouterCompatibleModel): ModelDraft {
  return {
    id: model.id,
    name: model.name,
    contextLength: typeof model.contextLength === 'number' ? String(model.contextLength) : '',
    supportsImageInput: model.architecture.inputModalities.includes('image'),
    supportedParameters: model.supportedParameters,
  };
}

function providerDraftFromSettings(provider: UserModelProviderSettings): ProviderDraft {
  return {
    id: provider.id,
    providerKey: provider.providerKey,
    name: provider.name,
    baseURL: provider.baseURL,
    apiKey: '',
    removeApiKey: false,
    enabled: provider.enabled,
    headersJson: JSON.stringify(provider.headers ?? {}, null, 2),
    models: provider.models.length
      ? provider.models.map((entry) => modelDraftFromSettings(entry.model))
      : [{ ...EMPTY_MODEL }],
  };
}

async function fetchModelProviders(): Promise<UserModelProviderSettings[]> {
  const data = await httpClient.get<{ providers: UserModelProviderSettings[] }>('/settings/model-providers');
  return data.providers;
}

async function createModelProvider(draft: ProviderDraft): Promise<void> {
  await httpClient.post('/settings/model-providers', toPayload(draft, false));
}

async function updateModelProvider(draft: ProviderDraft): Promise<void> {
  if (!draft.id) return;
  await httpClient.patch(`/settings/model-providers/${draft.id}`, toPayload(draft, true));
}

async function deleteModelProvider(id: string): Promise<void> {
  await httpClient.delete(`/settings/model-providers/${id}`);
}

function toPayload(draft: ProviderDraft, isUpdate: boolean) {
  const headers = JSON.parse(draft.headersJson || '{}') as Record<string, string>;
  const models = draft.models
    .filter((model) => model.id.trim())
    .map((model) => buildModelFromDraft(model, draft.name.trim(), draft.baseURL.trim()));
  const payload: Record<string, unknown> = {
    providerKey: draft.providerKey.trim() || slugify(draft.name),
    name: draft.name.trim(),
    baseURL: draft.baseURL.trim(),
    headers,
    enabled: draft.enabled,
    models,
  };

  if (draft.apiKey.trim()) payload.apiKey = draft.apiKey.trim();
  if (isUpdate && draft.removeApiKey) payload.apiKey = null;
  return payload;
}

function cloneModelDraft(draft: ModelDraft): ModelDraft {
  return {
    ...draft,
    supportedParameters: [...draft.supportedParameters],
  };
}

function getOpenRouterDefaultPlaceholder(modelsPool: ModelSpec[], defaultModelId: string | null): typeof FALLBACK_MODEL_PLACEHOLDER {
  const defaultModel = (defaultModelId
    ? modelsPool.find((model) => model.providerId === 'openrouter' && model.id === defaultModelId)
    : undefined)
    ?? modelsPool.find((model) => model.providerId === 'openrouter' && model.id === FALLBACK_MODEL_PLACEHOLDER.id)
    ?? modelsPool.find((model) => model.providerId === 'openrouter')
    ?? modelsPool.find((model) => model.source === 'built-in')
    ?? modelsPool[0];

  if (!defaultModel) return FALLBACK_MODEL_PLACEHOLDER;

  return {
    id: defaultModel.id || FALLBACK_MODEL_PLACEHOLDER.id,
    name: getModelDisplayName(defaultModel) || FALLBACK_MODEL_PLACEHOLDER.name,
    contextLength: String(getModelContextLength(defaultModel) ?? FALLBACK_MODEL_PLACEHOLDER.contextLength),
  };
}

export function CustomModelProvidersSection() {
  const { modelsPool, defaultModelId } = useAgent();
  const modelPlaceholder = useMemo(() => getOpenRouterDefaultPlaceholder(modelsPool, defaultModelId), [modelsPool, defaultModelId]);
  const [providers, setProviders] = useState<UserModelProviderSettings[]>([]);
  const [draft, setDraft] = useState<ProviderDraft>(() => ({ ...EMPTY_PROVIDER, models: [cloneModelDraft(EMPTY_MODEL)] }));
  const [selectedId, setSelectedId] = useState<string>('new');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModelProviders()
      .then((items) => {
        setProviders(items);
        if (items[0]) {
          setSelectedId(items[0].id);
          setDraft(providerDraftFromSettings(items[0]));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load providers'))
      .finally(() => setLoading(false));
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedId),
    [providers, selectedId],
  );

  const selectProvider = (id: string) => {
    setError(null);
    setSelectedId(id);
    const provider = providers.find((item) => item.id === id);
    setDraft(provider ? providerDraftFromSettings(provider) : { ...EMPTY_PROVIDER, models: [cloneModelDraft(EMPTY_MODEL)] });
  };

  const patchDraft = (updates: Partial<ProviderDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const updateModel = (index: number, updates: Partial<ModelDraft>) => {
    setDraft((prev) => ({
      ...prev,
      models: prev.models.map((model, i) => i === index ? { ...model, ...updates } : model),
    }));
  };

  const refreshProviders = async (preferredId?: string) => {
    const items = await fetchModelProviders();
    setProviders(items);
    const next = preferredId ? items.find((provider) => provider.id === preferredId) : selectedProvider;
    if (next) {
      setSelectedId(next.id);
      setDraft(providerDraftFromSettings(next));
    } else if (!items.length) {
      setSelectedId('new');
      setDraft({ ...EMPTY_PROVIDER, models: [cloneModelDraft(EMPTY_MODEL)] });
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      JSON.parse(draft.headersJson || '{}');
      if (draft.id) {
        await updateModelProvider(draft);
        await refreshProviders(draft.id);
      } else {
        await createModelProvider(draft);
        const items = await fetchModelProviders();
        setProviders(items);
        const created = items.find((provider) => provider.providerKey === (draft.providerKey.trim() || slugify(draft.name)));
        if (created) {
          setSelectedId(created.id);
          setDraft(providerDraftFromSettings(created));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    if (!window.confirm(`Delete ${draft.name}?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteModelProvider(draft.id);
      await refreshProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3">
      <div>
        <Label>Custom Model Providers</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Add OpenAI-compatible providers. Model metadata is stored in the same shape as the model registry.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border border-input p-3 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectProvider('new')}
              className={`rounded-full border px-2.5 py-1 text-xs ${selectedId === 'new' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              <Plus className="mr-1 inline size-3" /> New
            </button>
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => selectProvider(provider.id)}
                className={`rounded-full border px-2.5 py-1 text-xs ${selectedId === provider.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
              >
                {provider.name}
                {provider.hasApiKey ? ' · key' : ' · no key'}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="font-normal text-[0.805rem]">Provider Name</Label>
              <Input value={draft.name} onChange={(e) => patchDraft({ name: e.target.value, providerKey: draft.providerKey || slugify(e.target.value) })} className="h-8 text-sm" placeholder="OpenAI" autoComplete="off" autoCorrect="off" spellCheck={false} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="font-normal text-[0.805rem]">Provider Key</Label>
              <Input value={draft.providerKey} onChange={(e) => patchDraft({ providerKey: e.target.value })} className="h-8 font-mono text-xs" placeholder="openai" autoComplete="off" autoCorrect="off" spellCheck={false} />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label className="font-normal text-[0.805rem]">Base URL</Label>
              <Input value={draft.baseURL} onChange={(e) => patchDraft({ baseURL: e.target.value })} className="h-8 font-mono text-xs" placeholder="https://api.openai.com/v1" autoComplete="off" autoCorrect="off" spellCheck={false} />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label className="font-normal text-[0.805rem]">API Key {selectedProvider?.hasApiKey ? '(configured)' : ''}</Label>
              <Input type="password" value={draft.apiKey} onChange={(e) => patchDraft({ apiKey: e.target.value, removeApiKey: false })} className="h-8 font-mono text-xs" placeholder={selectedProvider?.hasApiKey ? 'Leave blank to keep existing key' : 'sk-...'} autoComplete="new-password" autoCorrect="off" spellCheck={false} />
              {selectedProvider?.hasApiKey && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={draft.removeApiKey} onChange={(e) => patchDraft({ removeApiKey: e.target.checked, apiKey: e.target.checked ? '' : draft.apiKey })} />
                  Remove stored key on save
                </label>
              )}
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-border p-2">
              <div>
                <div className="text-xs font-medium">Enabled</div>
                <div className="text-xs text-muted-foreground">Disabled providers are hidden from model selection.</div>
              </div>
              <Switch checked={draft.enabled} onCheckedChange={(checked) => patchDraft({ enabled: checked })} />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label className="font-normal text-[0.805rem]">Headers JSON</Label>
              <Textarea value={draft.headersJson} onChange={(e) => patchDraft({ headersJson: e.target.value })} className="min-h-20 font-mono text-xs" autoComplete="off" autoCorrect="off" spellCheck={false} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="font-normal text-[0.805rem]">Models</Label>
              <button type="button" onClick={() => patchDraft({ models: [...draft.models, cloneModelDraft(EMPTY_MODEL)] })} className="text-xs text-primary hover:text-primary/80">
                Add model
              </button>
            </div>

            {draft.models.map((model, index) => (
              <div key={index} className="rounded-md border border-border p-3 flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="font-normal text-[0.805rem]">Model ID</Label>
                    <Input value={model.id} onChange={(e) => updateModel(index, { id: e.target.value })} placeholder={modelPlaceholder.id} className="h-8 font-mono text-xs placeholder:text-xs" autoComplete="off" autoCorrect="off" spellCheck={false} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="font-normal text-[0.805rem]">Model Name</Label>
                    <Input value={model.name} onChange={(e) => updateModel(index, { name: e.target.value })} placeholder={modelPlaceholder.name} className="h-8 text-xs placeholder:text-xs" autoComplete="off" autoCorrect="off" spellCheck={false} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="font-normal text-[0.805rem]">Context Length</Label>
                    <Input value={model.contextLength} onChange={(e) => updateModel(index, { contextLength: e.target.value })} placeholder={modelPlaceholder.contextLength} className="h-8 text-xs placeholder:text-xs" inputMode="numeric" autoComplete="off" autoCorrect="off" spellCheck={false} />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border p-2">
                  <div>
                    <div className="text-xs font-medium">Image Input</div>
                    <div className="text-xs text-muted-foreground">Allow text plus image prompts for this model.</div>
                  </div>
                  <Switch checked={model.supportsImageInput} onCheckedChange={(checked) => updateModel(index, { supportsImageInput: checked })} />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium">Supported Params</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PARAMETER_OPTIONS.map((option) => {
                      const checked = model.supportedParameters.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateModel(index, {
                            supportedParameters: checked
                              ? model.supportedParameters.filter((value) => value !== option.value)
                              : [...model.supportedParameters, option.value],
                          })}
                          className={`rounded-md border px-2 py-0.5 text-xs ${checked ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={() => patchDraft({ models: draft.models.filter((_, i) => i !== index) })} className="text-xs text-destructive hover:text-destructive/80">
                    <Trash2 className="inline size-3" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={saving || !draft.name.trim() || !draft.baseURL.trim()} className="text-xs text-primary transition-colors hover:text-primary/80 disabled:opacity-50">
              {saving ? 'Saving…' : draft.id ? 'Save provider' : 'Create provider'}
            </button>
            {draft.id && (
              <button type="button" onClick={() => void remove()} disabled={saving} className="text-xs text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50">
                Delete provider
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
