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
import { ArrowLeft, Check, ChevronDown, Search } from 'lucide-react';
import { Input, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/features/shared/components/shadcn';
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

  // Hide OpenRouter models when the user hasn't configured an API key.
  const displayModels = useMemo(
    () => (hasApiKey ? models : models.filter((m) => m.providerId !== 'openrouter')),
    [models, hasApiKey]
  );

  // Distinct provider display names — custom providers first, then OpenRouter.
  const providerNames = useMemo(() => {
    const seen = new Set<string>();
    const custom: string[] = [];
    const builtin: string[] = [];
    for (const m of displayModels) {
      const name = getModelProviderName(m);
      if (seen.has(name)) continue;
      seen.add(name);
      if (m.providerId === 'openrouter') {
        builtin.push(name);
      } else {
        custom.push(name);
      }
    }
    return [...custom, ...builtin];
  }, [displayModels]);

  // Filtered + grouped by provider display name.
  const grouped = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = displayModels.filter((m) => {
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
  }, [displayModels, query, activeProviderName]);

  const handleSelect = (model: ModelSpec) => {
    onSelect({ providerId: model.providerId, modelId: model.id });
    onClose();
  };

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* Search + Provider filter */}
      <div className="flex items-center gap-2 mt-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 h-8 min-w-[140px] text-xs bg-background dark:bg-zinc-900 border border-input rounded-md text-foreground dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <span className="truncate">{activeProviderName === 'all' ? 'All providers' : activeProviderName}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setActiveProviderName('all')}
              className="text-xs"
            >
              <span className="flex-1">All providers</span>
              {activeProviderName === 'all' && <Check className="w-3 h-3 text-primary shrink-0" />}
            </DropdownMenuItem>
            {providerNames.map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={() => setActiveProviderName(p)}
                className="text-xs"
              >
                <span className="flex-1">{p}</span>
                {activeProviderName === p && <Check className="w-3 h-3 text-primary shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Model metadata header */}
      <div className="grid grid-cols-[minmax(0,1fr)_88px_minmax(160px,0.75fr)_16px] items-center gap-2 px-2 text-[10px] text-muted-foreground">
        <span>Model</span>
        <span className="text-center">Context</span>
        <span>Capabilities</span>
        <span />
      </div>

      {/* Scrollable model list */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1 space-y-0">
        {grouped.size === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No models found</p>
        )}
        {Array.from(grouped.entries())
          .sort(([, a], [, b]) => {
            const aIsOpenRouter = a[0]?.providerId === 'openrouter';
            const bIsOpenRouter = b[0]?.providerId === 'openrouter';
            if (aIsOpenRouter === bIsOpenRouter) return 0;
            return aIsOpenRouter ? 1 : -1;
          })
          .map(([providerName, providerModels]) => {
          const isOpenRouter = providerModels[0]?.providerId === 'openrouter';

          return (
            <div key={providerName}>
              {/* Provider section header */}
              <div className="flex items-center gap-2 px-2 py-2 sticky top-0 bg-background z-10">
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
                    onClick={() => handleSelect(model)}
                    className={`w-full grid grid-cols-[minmax(0,1fr)_88px_minmax(160px,0.75fr)_16px] items-center gap-2 px-2 py-1.5 text-left transition-colors text-sm
                      ${isSelected
                        ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20'
                        : 'hover:bg-cyan-500/5 text-foreground'
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
                          className={`rounded-[1px] border px-1 py-0.5 text-[10px] leading-none ${
                            isSelected
                              ? 'border-cyan-500/30 text-cyan-700 dark:text-cyan-400'
                              : 'border-border text-muted-foreground'
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
                        <Check className="w-3 h-3 text-cyan-700 dark:text-cyan-400" />
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
