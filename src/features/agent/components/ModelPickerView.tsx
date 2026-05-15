'use client';

/**
 * Model Picker View
 *
 * Full-panel replacement for the model dropdown in AgentsConfigPanel.
 *
 *  - Search across all models
 *  - Provider filter pills (driven by `ModelSpec.provider` display name)
 *  - Grouped list by provider display name
 *  - Selection passes `{ providerId, modelId }` so duplicate model ids
 *    across providers disambiguate correctly
 *  - Capability badges derived from `supportedParameters` /
 *    `inputModalities` (no separate capabilities array)
 */

import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { Input } from '@/features/shared/components/shadcn';
import type { ModelSpec } from '../types';
import {
  getModelCapabilityBadges,
  getModelContextLength,
  getModelDisplayName,
  getModelProviderName,
} from '../utils/models';

// ============================================================
// Types
// ============================================================

export interface ModelPickerViewProps {
  models: ModelSpec[];
  selectedModelId: string;
  selectedProviderId?: string;
  onSelect: (selection: { providerId: string; modelId: string }) => void;
  onClose: () => void;
  /** Whether the user has configured an OpenRouter API key */
  hasApiKey: boolean;
  /** Called when the user clicks to add an API key from the warning banner */
  onOpenSettings: () => void;
}

// ============================================================
// Helpers
// ============================================================

function formatContext(tokens?: number): string {
  if (!tokens) return '—';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

// ============================================================
// Component
// ============================================================

export function ModelPickerView({
  models,
  selectedModelId,
  selectedProviderId = 'openrouter',
  onSelect,
  onClose,
  hasApiKey,
  onOpenSettings,
}: ModelPickerViewProps) {
  const [query, setQuery] = useState('');
  const [activeProviderName, setActiveProviderName] = useState<string>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Distinct provider display names in stable insertion order.
  const providerNames = useMemo(() => {
    const seen = new Set<string>();
    for (const m of models) seen.add(getModelProviderName(m));
    return Array.from(seen);
  }, [models]);

  // Filtered + grouped by provider display name.
  const grouped = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = models.filter((m) => {
      const providerName = getModelProviderName(m);
      const displayName = getModelDisplayName(m);
      const matchProvider = activeProviderName === 'all' || providerName === activeProviderName;
      const matchQuery =
        !q ||
        displayName.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q);
      return matchProvider && matchQuery;
    });

    const groups = new Map<string, ModelSpec[]>();
    for (const m of filtered) {
      const providerName = getModelProviderName(m);
      if (!groups.has(providerName)) groups.set(providerName, []);
      groups.get(providerName)!.push(m);
    }
    return groups;
  }, [models, query, activeProviderName]);

  const handleSelect = (model: ModelSpec) => {
    onSelect({ providerId: model.providerId, modelId: model.id });
    onClose();
  };

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models…"
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Provider filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveProviderName('all')}
          className={`px-2.5 py-0.5 rounded-full text-xs transition-colors border ${
            activeProviderName === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
          }`}
        >
          All
        </button>
        {providerNames.map((p) => (
          <button
            key={p}
            onClick={() => setActiveProviderName(p === activeProviderName ? 'all' : p)}
            className={`px-2.5 py-0.5 rounded-full text-xs transition-colors border ${
              activeProviderName === p
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Model metadata header */}
      <div className="grid grid-cols-[minmax(0,1fr)_88px_minmax(160px,0.75fr)_16px] items-center gap-2 px-2 text-[10px] text-muted-foreground">
        <span />
        <span className="text-center">Context Length</span>
        <span>Capabilities</span>
        <span />
      </div>

      {/* Scrollable model list */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1 space-y-0">
        {grouped.size === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No models found</p>
        )}
        {Array.from(grouped.entries()).map(([providerName, providerModels]) => {
          const isOpenRouter = providerModels[0]?.providerId === 'openrouter';

          return (
            <div key={providerName}>
              {/* Provider section header */}
              <div className="flex items-center gap-2 py-2 sticky top-0 bg-background z-10">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex-1">
                  {providerName}
                </span>
                <span className="text-[10px] text-muted-foreground">{isOpenRouter ? 'built-in' : 'custom'}</span>
              </div>

              {/* Model rows */}
              {providerModels.map((model) => {
                const isSelected = model.id === selectedModelId && model.providerId === selectedProviderId;
                const displayName = getModelDisplayName(model);
                const capabilities = getModelCapabilityBadges(model);

                return (
                  <button
                    key={`${model.providerId}:${model.id}`}
                    onClick={() => {
                      if (!hasApiKey && isSelected) {
                        onOpenSettings();
                      } else {
                        handleSelect(model);
                      }
                    }}
                    className={`w-full grid grid-cols-[minmax(0,1fr)_88px_minmax(160px,0.75fr)_16px] items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors text-sm
                      ${!hasApiKey && !isSelected ? 'opacity-50' : ''}
                      ${isSelected
                        ? hasApiKey
                          ? 'bg-primary/10 text-primary'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        : 'hover:bg-accent text-foreground'
                      }`}
                  >
                    <span className="min-w-0 truncate text-xs">{displayName}</span>
                    <span className="text-center shrink-0 text-[10px] text-muted-foreground font-mono">
                      {formatContext(getModelContextLength(model))}
                    </span>
                    <span className="flex min-w-0 flex-wrap gap-1">
                      {capabilities.length ? capabilities.map((capability) => (
                        <span
                          key={capability}
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] leading-none ${
                            isSelected
                              ? hasApiKey
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                              : 'border-border bg-background/50 text-muted-foreground'
                          }`}
                        >
                          {capability}
                        </span>
                      )) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </span>
                    <div className="flex justify-center shrink-0">
                      {isSelected && (
                        hasApiKey
                          ? <Check className="w-3 h-3 text-primary" />
                          : <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">→</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Back button */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back</span>
      </button>
    </div>
  );
}
