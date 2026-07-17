'use client';

/**
 * Custom OpenAI-compatible providers — settings UI.
 *
 * The frontend never constructs provider-shaped (OpenRouter SDK) model
 * payloads. Drafts collected here are converted into
 * `CustomProviderModelInput[]`; the backend canonicalises them into
 * `ModelSpec[]` server-side.
 */

import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input, Label, Switch, Textarea, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@portfolio/ui/components/shadcn';
import { useAgent } from '../hooks/useAgent';
import { useCustomModelProviders } from '../hooks/useCustomModelProviders';
import { useConfiguredProviders } from '../hooks/useConfiguredProviders';
import type { ModelSpec } from '../types/llm';
import { getModelContextLength, getModelDisplayName, getModelMaxCompletionTokens } from '../utils/models';

const FALLBACK_MODEL_PLACEHOLDER = {
  id: 'moonshotai/kimi-k2.6',
  name: 'Kimi K2.6',
  contextLength: '262144',
  maxCompletionTokens: '',
};

function RequiredAsterisk() {
  return <span className="text-destructive" aria-hidden="true">*</span>;
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

  const {
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
  } = useCustomModelProviders();
  const saveDisabled = saving || !draft.provider.trim() || !draft.baseUrl.trim() || !hasChanges;
  const { configuredProviders } = useConfiguredProviders();
  const editingHasApiKey = editingProvider
    ? configuredProviders.has(`model-provider:${editingProvider.id}`)
    : false;

  return (
    <div className="mb-6 lg:break-inside-avoid-column flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label>Custom Model Providers</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Add OpenAI-compatible providers. Models are exposed through the same registry as built-in providers.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewProviderForm}
          className="shrink-0 text-xs text-primary transition-colors hover:text-primary/80"
        >
          <Plus className="mr-1 inline size-3" /> New
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {providers.length === 0 ? (
              <div className="rounded-md border border-input p-3 text-xs text-muted-foreground">
                No custom model providers yet.
              </div>
            ) : providers.map((provider) => (
              <div key={provider.id} className="rounded-md border border-input p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{provider.provider}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${provider.enabled ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </span>

                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{provider.baseUrl}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {provider.models.length} {provider.models.length === 1 ? 'model' : 'models'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Enabled</span>
                      <Switch
                        checked={provider.enabled}
                        onCheckedChange={(checked) => void setProviderEnabled(provider, checked)}
                        disabled={saving || removingId !== null || updatingEnabledId !== null}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openUpdateProviderForm(provider)}
                      disabled={saving || removingId !== null || updatingEnabledId !== null}
                      className="text-xs text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeProvider(provider)}
                      disabled={saving || removingId !== null || updatingEnabledId !== null}
                      className="text-xs text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
                    >
                      {removingId === provider.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {formOpen && (
            <div className="rounded-md border border-input p-3 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    {draft.id ? `Update ${editingProvider?.provider ?? draft.provider}` : 'New custom provider'}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {draft.id ? 'Edit provider settings and model definitions.' : 'Add a provider and the models it exposes.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label className="font-normal text-xs">Provider <RequiredAsterisk /></Label>
                  <Input
                    value={draft.provider}
                    onChange={(e) => patchDraft({ provider: e.target.value })}
                    className="h-8 text-xs placeholder:text-xs"
                    placeholder="OpenAI"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label className="font-normal text-xs">Base URL <RequiredAsterisk /></Label>
                  <Input
                    value={draft.baseUrl}
                    onChange={(e) => patchDraft({ baseUrl: e.target.value })}
                    className="h-8 font-mono text-xs placeholder:text-xs"
                    placeholder="https://api.openai.com/v1"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label className="font-normal text-xs">API Type <RequiredAsterisk /></Label>
                  <Select
                    value={draft.apiSurface}
                    onValueChange={(val) => patchDraft({ apiSurface: val as 'chat_completions' | 'responses' })}
                  >
                    <SelectTrigger className="h-8 text-xs" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chat_completions">Chat Completions (/v1/chat/completions)</SelectItem>
                      <SelectItem value="responses">Responses (/v1/responses)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The OpenAI-compatible endpoint this provider serves. Use Responses for providers like tera.
                  </p>
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label className="font-normal text-xs">API Key {editingHasApiKey ? '(configured)' : ''}</Label>
                  <Input
                    type="password"
                    value={draft.apiKey}
                    onChange={(e) => patchDraft({ apiKey: e.target.value, removeApiKey: false })}
                    className="h-8 font-mono text-xs placeholder:text-xs"
                    placeholder={editingHasApiKey ? 'Leave blank to keep existing key' : 'sk-...'}
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {editingHasApiKey && (
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
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label className="font-normal text-xs">Headers JSON</Label>
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
                  <Label className="font-normal text-xs">Models</Label>
                  <button
                    type="button"
                    onClick={addModel}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    Add model
                  </button>
                </div>

                {draft.models.map((model, index) => (
                  <div key={index} className="rounded-md border border-border p-3 flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Label className="font-normal text-xs">Model ID <RequiredAsterisk /></Label>
                        <Input
                          value={model.id}
                          onChange={(e) => updateModel(index, { id: e.target.value })}
                          placeholder={modelPlaceholder.id}
                          className="h-8 font-mono text-xs placeholder:text-xs"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="font-normal text-xs">Model Display Name</Label>
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
                          <Label className="font-normal text-xs">Context Length</Label>
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
                          <Label className="font-normal text-xs">Max Completion Tokens</Label>
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

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeModel(index)}
                        className="text-xs text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="inline size-3" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saveDisabled}
                  className={`text-xs text-primary transition-colors ${
                    saveDisabled ? '!cursor-default opacity-50' : 'cursor-pointer hover:text-primary/80'
                  }`}
                >
                  {saving ? 'Saving…' : draft.id ? 'Save provider' : 'Create provider'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
