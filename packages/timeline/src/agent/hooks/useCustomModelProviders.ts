'use client';

/**
 * Data/controller hook for custom OpenAI-compatible model providers.
 *
 */

import { useEffect, useMemo, useState } from 'react';
import type {
  CreateCustomModelProviderInput,
  CustomModelInput,
  CustomModelProvider,
} from '@agentime/protocol';
import { agentimeHttp } from '../lib/agentime-client';
import { recordHttpProblem } from '../problems/http';
import { useAgentStore } from '../stores/useAgentStore';
import type {
  LlmApiSurface,
  LlmRegistrySnapshot,
  ModelSpec,
} from '../types/llm';
import { modelSupportsVision } from '../utils/models';

export interface ModelDraft {
  id: string;
  name: string;
  contextLength: string;
  maxCompletionTokens: string;
  supportsImageInput: boolean;
}

export interface ProviderDraft {
  id?: string;
  provider: string;
  baseUrl: string;
  apiSurface: LlmApiSurface;
  apiKey: string;
  removeApiKey: boolean;
  headersJson: string;
  models: ModelDraft[];
}

const EMPTY_MODEL: ModelDraft = {
  id: '',
  name: '',
  contextLength: '',
  maxCompletionTokens: '',
  supportsImageInput: true,
};

const EMPTY_PROVIDER: ProviderDraft = {
  provider: '',
  baseUrl: '',
  apiSurface: 'chat_completions',
  apiKey: '',
  removeApiKey: false,
  headersJson: '{}',
  models: [{ ...EMPTY_MODEL }],
};

function cloneModelDraft(draft: ModelDraft): ModelDraft {
  return { ...draft };
}

function emptyProviderDraft(): ProviderDraft {
  return {
    ...EMPTY_PROVIDER,
    models: [cloneModelDraft(EMPTY_MODEL)],
  };
}

function parseOptionalPositiveInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function modelInputFromDraft(draft: ModelDraft): CustomModelInput {
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

function providerDraftFromSettings(provider: CustomModelProvider): ProviderDraft {
  return {
    id: provider.id,
    provider: provider.provider,
    baseUrl: provider.baseUrl,
    apiSurface: provider.apiSurface ?? 'chat_completions',
    apiKey: '',
    removeApiKey: false,
    headersJson: JSON.stringify(provider.headers ?? {}, null, 2),
    models: provider.models.length
      ? provider.models.map(modelDraftFromSpec)
      : [cloneModelDraft(EMPTY_MODEL)],
  };
}

function toPayload(draft: ProviderDraft, isUpdate: boolean): CreateCustomModelProviderInput {
  const headers = JSON.parse(draft.headersJson || '{}') as Record<string, string>;
  const models = draft.models
    .filter((model) => model.id.trim())
    .map(modelInputFromDraft);

  const payload: CreateCustomModelProviderInput = {
    provider: draft.provider.trim(),
    baseUrl: draft.baseUrl.trim(),
    apiSurface: draft.apiSurface,
    headers,
    models,
  };

  if (!isUpdate) payload.enabled = true;
  return payload;
}

async function fetchModelProviders(): Promise<CustomModelProvider[]> {
  return agentimeHttp.listCustomModelProviders();
}

async function createModelProvider(draft: ProviderDraft): Promise<CustomModelProvider> {
  const provider = await agentimeHttp.createCustomModelProvider(toPayload(draft, false));
  if (draft.apiKey.trim()) {
    await agentimeHttp.upsertCredential(`model-provider:${provider.id}`, draft.apiKey.trim());
  }
  return provider;
}

async function updateModelProvider(draft: ProviderDraft): Promise<CustomModelProvider | null> {
  if (!draft.id) return null;
  const provider = await agentimeHttp.updateCustomModelProvider(draft.id, toPayload(draft, true));
  if (draft.apiKey.trim()) {
    await agentimeHttp.upsertCredential(`model-provider:${draft.id}`, draft.apiKey.trim());
  } else if (draft.removeApiKey) {
    await agentimeHttp.deleteCredential(`model-provider:${draft.id}`);
  }
  return provider;
}

async function updateModelProviderEnabled(id: string, enabled: boolean): Promise<CustomModelProvider> {
  return agentimeHttp.updateCustomModelProvider(id, { enabled });
}

async function deleteModelProvider(id: string): Promise<void> {
  await agentimeHttp.deleteCustomModelProvider(id);
}

function isValidModelRegistry(value: unknown): value is LlmRegistrySnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const registry = value as Record<string, unknown>;
  return registry.contractVersion === 5
    && Array.isArray(registry.models)
    && typeof registry.defaultModelId === 'string'
    && Array.isArray(registry.parameters);
}

async function refreshModelRegistry(): Promise<void> {
  const registry = await agentimeHttp.getModelRegistry();
  if (!isValidModelRegistry(registry)) {
    throw new Error('Unsupported model registry response.');
  }
  useAgentStore.getState().setLlmRegistry(registry);
}

export function useCustomModelProviders() {
  const [providers, setProviders] = useState<CustomModelProvider[]>([]);
  const [draft, setDraft] = useState<ProviderDraft>(() => emptyProviderDraft());
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingEnabledId, setUpdatingEnabledId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModelProviders()
      .then(setProviders)
      .catch((err) => {
        if (!recordHttpProblem(err, 'model', 'custom-model-providers')) {
          setError('Failed to load providers');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const editingProvider = useMemo(
    () => draft.id ? providers.find((provider) => provider.id === draft.id) : undefined,
    [draft.id, providers],
  );

  const refreshProviders = async (preferredId?: string | null) => {
    const items = await fetchModelProviders();
    setProviders(items);

    if (preferredId) {
      const provider = items.find((item) => item.id === preferredId);
      if (provider) {
        setDraft(providerDraftFromSettings(provider));
        setFormOpen(true);
        return;
      }
    }

    if (preferredId === null || (draft.id && !items.some((item) => item.id === draft.id))) {
      setFormOpen(false);
      setDraft(emptyProviderDraft());
    }
  };

  const openNewProviderForm = () => {
    setError(null);
    setDraft(emptyProviderDraft());
    setFormOpen(true);
  };

  const openUpdateProviderForm = (provider: CustomModelProvider) => {
    setError(null);
    setDraft(providerDraftFromSettings(provider));
    setFormOpen(true);
  };

  const closeForm = () => {
    setError(null);
    setFormOpen(false);
    setDraft(emptyProviderDraft());
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

  const addModel = () => {
    setDraft((prev) => ({
      ...prev,
      models: [...prev.models, cloneModelDraft(EMPTY_MODEL)],
    }));
  };

  const removeModel = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      models: prev.models.filter((_, i) => i !== index),
    }));
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
        await refreshProviders(created?.id ?? null);
      }
      await refreshModelRegistry();
      closeForm();
    } catch (err) {
      if (!recordHttpProblem(err, 'model', 'custom-model-providers')) {
        setError(err instanceof Error ? err.message : 'Failed to save provider');
      }
    } finally {
      setSaving(false);
    }
  };

  const removeProvider = async (provider: CustomModelProvider) => {
    if (!window.confirm(`Delete ${provider.provider}?`)) return;
    setRemovingId(provider.id);
    setError(null);
    try {
      await deleteModelProvider(provider.id);
      await refreshProviders(provider.id === draft.id ? null : undefined);
      await refreshModelRegistry();
    } catch (err) {
      if (!recordHttpProblem(err, 'model', 'custom-model-providers')) {
        setError('Failed to delete provider');
      }
    } finally {
      setRemovingId(null);
    }
  };

  const setProviderEnabled = async (provider: CustomModelProvider, enabled: boolean) => {
    setUpdatingEnabledId(provider.id);
    setError(null);
    try {
      await updateModelProviderEnabled(provider.id, enabled);
      await refreshProviders(provider.id === draft.id ? provider.id : undefined);
      await refreshModelRegistry();
    } catch (err) {
      if (!recordHttpProblem(err, 'model', 'custom-model-providers')) {
        setError('Failed to update provider status');
      }
    } finally {
      setUpdatingEnabledId(null);
    }
  };

  const hasChanges = useMemo(() => {
    if (!draft.id || !editingProvider) return true;
    if (draft.provider.trim() !== editingProvider.provider) return true;
    if (draft.baseUrl.trim() !== editingProvider.baseUrl) return true;
    if (draft.apiSurface !== (editingProvider.apiSurface ?? 'chat_completions')) return true;
    if (draft.apiKey.trim() !== '') return true;
    if (draft.removeApiKey) return true;
    const originalHeaders = JSON.stringify(editingProvider.headers ?? {}, null, 2);
    if (draft.headersJson.trim() !== originalHeaders) return true;
    const currentModels = draft.models
      .filter((m) => m.id.trim())
      .map((m) => ({
        id: m.id.trim(),
        name: m.name.trim(),
        contextLength: m.contextLength.trim(),
        maxCompletionTokens: m.maxCompletionTokens.trim(),
        supportsImageInput: m.supportsImageInput,
      }));
    const originalModels = editingProvider.models.map((m) => ({
      id: m.id,
      name: m.name,
      contextLength: m.contextLength != null ? String(m.contextLength) : '',
      maxCompletionTokens: m.maxCompletionTokens != null ? String(m.maxCompletionTokens) : '',
      supportsImageInput: modelSupportsVision(m),
    }));
    if (currentModels.length !== originalModels.length) return true;
    for (let i = 0; i < currentModels.length; i++) {
      if (JSON.stringify(currentModels[i]) !== JSON.stringify(originalModels[i])) return true;
    }
    return false;
  }, [draft, editingProvider]);

  return {
    providers,
    draft,
    formOpen,
    loading,
    saving,
    removingId,
    updatingEnabledId,
    error,
    editingProvider,
    hasChanges,
    openNewProviderForm,
    openUpdateProviderForm,
    closeForm,
    patchDraft,
    updateModel,
    addModel,
    removeModel,
    save,
    removeProvider,
    setProviderEnabled,
  };
}
