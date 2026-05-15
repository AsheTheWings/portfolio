'use client';

/**
 * Custom OpenAI-compatible providers — settings UI.
 *
 * The frontend never constructs provider-shaped (OpenRouter SDK) model
 * payloads. Drafts collected here are converted into
 * `CustomProviderModelInput[]`; the backend canonicalises them into
 * `ModelSpec[]` server-side.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input, Label, Switch, Textarea } from '@/features/shared/components/shadcn';
import { useAgent } from '../hooks/useAgent';
import type { CustomProviderModelInput, ModelSpec, UserModelProviderSettings } from '../types/llm';
import { getModelContextLength, getModelDisplayName, getModelMaxCompletionTokens, modelSupportsVision } from '../utils/models';
import { httpClient } from '@/features/shared/utils/http-client';

// ============================================================
// Draft types
// ============================================================

interface ModelDraft {
  id: string;
  name: string;
  contextLength: string;
  maxCompletionTokens: string;
  supportsImageInput: boolean;
}

interface ProviderDraft {
  id?: string;
  provider: string;
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
  maxCompletionTokens: '',
  supportsImageInput: false,
};

const EMPTY_PROVIDER: ProviderDraft = {
  provider: '',
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
  maxCompletionTokens: '',
};

// ============================================================
// Draft <-> wire conversions
// ============================================================

function parseOptionalPositiveInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function modelInputFromDraft(draft: ModelDraft): CustomProviderModelInput {
  return {
    id: draft.id.trim(),
    name: draft.name.trim() || undefined,
    contextLength: parseOptionalPositiveInteger(draft.contextLength),
    maxCompletionTokens: parseOptionalPositiveInteger(draft.maxCompletionTokens),
    inputModalities: draft.supportsImageInput ? ['text', 'image'] : ['text'],
  };
}

function modelDraftFromSpec(spec: ModelSpec): ModelDraft {
  return {
    id: spec.id,
    name: spec.name,
    contextLength: spec.contextLength != null ? String(spec.contextLength) : '',
    maxCompletionTokens: spec.maxCompletionTokens != null ? String(spec.maxCompletionTokens) : '',
    supportsImageInput: modelSupportsVision(spec),
  };
}

function providerDraftFromSettings(provider: UserModelProviderSettings): ProviderDraft {
  return {
    id: provider.id,
    provider: provider.provider,
    baseURL: provider.baseURL,
    apiKey: '',
    removeApiKey: false,
    enabled: provider.enabled,
    headersJson: JSON.stringify(provider.headers ?? {}, null, 2),
    models: provider.models.length
      ? provider.models.map(modelDraftFromSpec)
      : [{ ...EMPTY_MODEL }],
  };
}

function toPayload(draft: ProviderDraft, isUpdate: boolean): Record<string, unknown> {
  const headers = JSON.parse(draft.headersJson || '{}') as Record<string, string>;
  const models = draft.models
    .filter((model) => model.id.trim())
    .map(modelInputFromDraft);

  const payload: Record<string, unknown> = {
    provider: draft.provider.trim(),
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
  return { ...draft };
}

// ============================================================
// API
// ============================================================

async function fetchModelProviders(): Promise<UserModelProviderSettings[]> {
  const data = await httpClient.get<{ providers: UserModelProviderSettings[] }>('/settings/model-providers');
  return data.providers;
}

async function createModelProvider(draft: ProviderDraft): Promise<UserModelProviderSettings | null> {
  const data = await httpClient.post<{ provider: UserModelProviderSettings | null }>(
    '/settings/model-providers',
    toPayload(draft, false),
  );
  return data.provider;
}

async function updateModelProvider(draft: ProviderDraft): Promise<UserModelProviderSettings | null> {
  if (!draft.id) return null;
  const data = await httpClient.patch<{ provider: UserModelProviderSettings | null }>(
    `/settings/model-providers/${draft.id}`,
    toPayload(draft, true),
  );
  return data.provider;
}

async function deleteModelProvider(id: string): Promise<void> {
  await httpClient.delete(`/settings/model-providers/${id}`);
}

// ============================================================
// Placeholder
// ============================================================

function getOpenRouterDefaultPlaceholder(modelsPool: ModelSpec[], defaultModelId: string | null): typeof FALLBACK_MODEL_PLACEHOLDER {
  const defaultModel = (defaultModelId
    ? modelsPool.find((model) => model.providerId === 'openrouter' && model.id === defaultModelId)
    : undefined)
    ?? modelsPool.find((model) => model.providerId === 'openrouter')
    ?? modelsPool[0];

  if (!defaultModel) return FALLBACK_MODEL_PLACEHOLDER;

  return {
    id: defaultModel.id || FALLBACK_MODEL_PLACEHOLDER.id,
    name: getModelDisplayName(defaultModel) || FALLBACK_MODEL_PLACEHOLDER.name,
    contextLength: String(getModelContextLength(defaultModel) ?? FALLBACK_MODEL_PLACEHOLDER.contextLength),
    maxCompletionTokens: getModelMaxCompletionTokens(defaultModel) != null
      ? String(getModelMaxCompletionTokens(defaultModel))
      : '',
  };
}

// ============================================================
// Component
// ============================================================

export function CustomModelProvidersSection() {
  const { modelsPool, defaultModelId } = useAgent();
  const modelPlaceholder = useMemo(
    () => getOpenRouterDefaultPlaceholder(modelsPool, defaultModelId),
    [modelsPool, defaultModelId],
  );

  const [providers, setProviders] = useState<UserModelProviderSettings[]>([]);
  const [draft, setDraft] = useState<ProviderDraft>(() => ({
    ...EMPTY_PROVIDER,
    models: [cloneModelDraft(EMPTY_MODEL)],
  }));
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
    setDraft(provider
      ? providerDraftFromSettings(provider)
      : { ...EMPTY_PROVIDER, models: [cloneModelDraft(EMPTY_MODEL)] });
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
    const next = preferredId
      ? items.find((provider) => provider.id === preferredId)
      : selectedProvider;
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
        const created = await createModelProvider(draft);
        await refreshProviders(created?.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    if (!window.confirm(`Delete ${draft.provider}?`)) return;
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
          Add OpenAI-compatible providers. Models are exposed through the same registry as built-in providers.
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
                {provider.provider}
                {provider.hasApiKey ? ' · key' : ' · no key'}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label className="font-normal text-[0.805rem]">Provider</Label>
              <Input
                value={draft.provider}
                onChange={(e) => patchDraft({ provider: e.target.value })}
                className="h-8 text-sm"
                placeholder="OpenAI"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label className="font-normal text-[0.805rem]">Base URL</Label>
              <Input
                value={draft.baseURL}
                onChange={(e) => patchDraft({ baseURL: e.target.value })}
                className="h-8 font-mono text-xs"
                placeholder="https://api.openai.com/v1"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label className="font-normal text-[0.805rem]">API Key {selectedProvider?.hasApiKey ? '(configured)' : ''}</Label>
              <Input
                type="password"
                value={draft.apiKey}
                onChange={(e) => patchDraft({ apiKey: e.target.value, removeApiKey: false })}
                className="h-8 font-mono text-xs"
                placeholder={selectedProvider?.hasApiKey ? 'Leave blank to keep existing key' : 'sk-...'}
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck={false}
              />
              {selectedProvider?.hasApiKey && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={draft.removeApiKey}
                    onChange={(e) => patchDraft({ removeApiKey: e.target.checked, apiKey: e.target.checked ? '' : draft.apiKey })}
                  />
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
              <Textarea
                value={draft.headersJson}
                onChange={(e) => patchDraft({ headersJson: e.target.value })}
                className="min-h-20 font-mono text-xs"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="font-normal text-[0.805rem]">Models</Label>
              <button
                type="button"
                onClick={() => patchDraft({ models: [...draft.models, cloneModelDraft(EMPTY_MODEL)] })}
                className="text-xs text-primary hover:text-primary/80"
              >
                Add model
              </button>
            </div>

            {draft.models.map((model, index) => (
              <div key={index} className="rounded-md border border-border p-3 flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="font-normal text-[0.805rem]">Model ID</Label>
                    <Input
                      value={model.id}
                      onChange={(e) => updateModel(index, { id: e.target.value })}
                      placeholder={modelPlaceholder.id}
                      className="h-8 font-mono text-xs placeholder:text-xs"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="font-normal text-[0.805rem]">Model Display Name</Label>
                    <Input
                      value={model.name}
                      onChange={(e) => updateModel(index, { name: e.target.value })}
                      placeholder={modelPlaceholder.name}
                      className="h-8 text-xs placeholder:text-xs"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-normal text-[0.805rem]">Context Length</Label>
                      <Input
                        value={model.contextLength}
                        onChange={(e) => updateModel(index, { contextLength: e.target.value })}
                        placeholder={modelPlaceholder.contextLength}
                        className="h-8 text-xs placeholder:text-xs"
                        inputMode="numeric"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-normal text-[0.805rem]">Max Completion Tokens</Label>
                      <Input
                        value={model.maxCompletionTokens}
                        onChange={(e) => updateModel(index, { maxCompletionTokens: e.target.value })}
                        placeholder={modelPlaceholder.maxCompletionTokens || 'optional'}
                        className="h-8 text-xs placeholder:text-xs"
                        inputMode="numeric"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border p-2">
                  <div>
                    <div className="text-xs font-medium">Image Input</div>
                    <div className="text-xs text-muted-foreground">Allow text plus image prompts for this model.</div>
                  </div>
                  <Switch
                    checked={model.supportsImageInput}
                    onCheckedChange={(checked) => updateModel(index, { supportsImageInput: checked })}
                  />
                </div>

                <div className="rounded-md border border-border p-2 text-xs text-muted-foreground">
                  Uses the OpenAI Chat Completions parameter surface. OpenRouter-only extensions are not available for custom providers.
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => patchDraft({ models: draft.models.filter((_, i) => i !== index) })}
                    className="text-xs text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="inline size-3" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !draft.provider.trim() || !draft.baseURL.trim()}
              className="text-xs text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
            >
              {saving ? 'Saving…' : draft.id ? 'Save provider' : 'Create provider'}
            </button>
            {draft.id && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={saving}
                className="text-xs text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
              >
                Delete provider
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
