'use client';

/**
 * Model Picker View
 *
 * Full-panel replacement for the model dropdown in AgentsConfigPanel.
 * Activated when the user clicks the model trigger button.
 *
 * Features:
 *  - Search across all models
 *  - Provider filter pills
 *  - Grouped list by provider, each section has a header with API key status
 *  - Models dimmed when the provider has no configured key
 *  - Capability badge columns (Thinking, Vision, Image Gen, Tool Calling)
 *  - "Add API Key" row action → opens Settings panel
 *  - Back button returns to main config view
 */

import React, { useState, useMemo, useRef } from 'react';
import { ArrowLeft, Check, KeyRound, Search } from 'lucide-react';
import { Input } from '@/features/shared/components/shadcn';
import type { ModelSpec } from '../types';
import { ModelCapability } from '../types';

// ============================================================
// Types
// ============================================================

export interface ModelPickerViewProps {
  models: ModelSpec[];
  selectedModelId: string;
  configuredProviders: Set<string>;
  onSelect: (modelId: string) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

// ============================================================
// Constants
// ============================================================

export const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  fireworks: 'Fireworks AI',
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

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
// Capability badge icons (inline SVG keeps the bundle lean)
// ============================================================

function CapabilityIcon({ cap }: { cap: ModelCapability }) {
  switch (cap) {
    case ModelCapability.THINKING:
      return (
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <title>Thinking</title>
          <path d="M8 2a4 4 0 0 1 3.874 4.99A3 3 0 0 1 11 13H5a3 3 0 0 1-.874-5.01A4 4 0 0 1 8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          <path d="M6 13v1M8 13v2M10 13v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      );
    case ModelCapability.VISION:
      return (
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <title>Vision</title>
          <ellipse cx="8" cy="8" rx="6" ry="4" stroke="currentColor" strokeWidth="1.3"/>
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
        </svg>
      );
    case ModelCapability.IMAGE_GENERATION:
      return (
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <title>Image Generation</title>
          <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <circle cx="5.5" cy="6.5" r="1" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M2 11l3.5-3 2.5 2.5L11 7.5l3 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        </svg>
      );
    case ModelCapability.TOOL_CALLING:
      return (
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <title>Tool Calling</title>
          <path d="M9 3L13 7L7.5 12.5C7 13 6 13 5.5 12.5L3.5 10.5C3 10 3 9 3.5 8.5L9 3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          <path d="M11 1L15 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      );
    default:
      return null;
  }
}

const ALL_CAPABILITIES = [
  ModelCapability.THINKING,
  ModelCapability.VISION,
  ModelCapability.IMAGE_GENERATION,
  ModelCapability.TOOL_CALLING,
] as const;

const CAPABILITY_LABELS: Record<ModelCapability, string> = {
  [ModelCapability.THINKING]: 'Thinking',
  [ModelCapability.VISION]: 'Vision',
  [ModelCapability.IMAGE_GENERATION]: 'Img Gen',
  [ModelCapability.TOOL_CALLING]: 'Tools',
};

// ============================================================
// Component
// ============================================================

export function ModelPickerView({
  models,
  selectedModelId,
  configuredProviders,
  onSelect,
  onClose,
  onOpenSettings,
}: ModelPickerViewProps) {
  const [query, setQuery] = useState('');
  const [activeProvider, setActiveProvider] = useState<string>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search on mount
  React.useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Distinct provider list in stable insertion order from models array
  const providers = useMemo(() => {
    const seen = new Set<string>();
    for (const m of models) {
      seen.add(m.provider);
    }
    return Array.from(seen);
  }, [models]);

  // Filtered + grouped
  const grouped = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = models.filter((m) => {
      const matchProvider = activeProvider === 'all' || m.provider === activeProvider;
      const matchQuery =
        !q ||
        (m.displayName ?? m.id).toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q);
      return matchProvider && matchQuery;
    });

    // Group by provider, preserving insertion order
    const groups = new Map<string, ModelSpec[]>();
    for (const m of filtered) {
      if (!groups.has(m.provider)) groups.set(m.provider, []);
      groups.get(m.provider)!.push(m);
    }
    return groups;
  }, [models, query, activeProvider]);

  const handleSelect = (modelId: string, providerHasKey: boolean) => {
    if (!providerHasKey) return; // ignore clicks on dimmed models
    onSelect(modelId);
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
          onClick={() => setActiveProvider('all')}
          className={`px-2.5 py-0.5 rounded-full text-xs transition-colors border ${
            activeProvider === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
          }`}
        >
          All
        </button>
        {providers.map((p) => (
          <button
            key={p}
            onClick={() => setActiveProvider(p === activeProvider ? 'all' : p)}
            className={`px-2.5 py-0.5 rounded-full text-xs transition-colors border ${
              activeProvider === p
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {PROVIDER_LABELS[p] ?? p}
          </button>
        ))}
      </div>

      {/* Capability legend header */}
      <div className="flex items-center text-[10px] text-muted-foreground px-1 gap-1">
        <span className="flex-1 min-w-0" />
        <span className="w-10 text-center shrink-0">Context</span>
        {ALL_CAPABILITIES.map((cap) => (
          <span key={cap} className="w-7 text-center shrink-0 flex justify-center">
            <CapabilityIcon cap={cap} />
          </span>
        ))}
        <div className="w-4 shrink-0" /> {/* checkbox column */}
      </div>

      {/* Scrollable model list */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1 space-y-0">
        {grouped.size === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No models found</p>
        )}
        {Array.from(grouped.entries()).map(([provider, providerModels]) => {
          const hasKey = configuredProviders.has(provider);
          const label = PROVIDER_LABELS[provider] ?? provider;

          return (
            <div key={provider}>
              {/* Provider section header */}
              <div className="flex items-center gap-2 py-2 sticky top-0 bg-background z-10">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex-1">
                  {label}
                </span>
                {hasKey ? (
                  <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                    <Check className="w-3 h-3" />
                    Key configured
                  </span>
                ) : (
                  <button
                    onClick={onOpenSettings}
                    className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-colors"
                  >
                    <KeyRound className="w-3 h-3" />
                    Add API key
                  </button>
                )}
              </div>

              {/* Model rows */}
              {providerModels.map((model) => {
                const isSelected = model.id === selectedModelId;
                const dimmed = !hasKey;
                const displayName = model.displayName ?? model.id;

                return (
                  <button
                    key={model.id}
                    onClick={() => handleSelect(model.id, hasKey)}
                    disabled={dimmed}
                    className={`w-full flex items-center gap-1 px-2 py-1.5 rounded-md text-left transition-colors text-sm
                      ${dimmed
                        ? 'opacity-35 cursor-default'
                        : isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-accent text-foreground'
                      }`}
                  >
                    <span className="flex-1 min-w-0 truncate text-xs">{displayName}</span>
                    <span className="w-10 text-center shrink-0 text-[10px] text-muted-foreground font-mono">
                      {formatContext(model.maxTokens)}
                    </span>
                    {ALL_CAPABILITIES.map((cap) => (
                      <span
                        key={cap}
                        title={CAPABILITY_LABELS[cap]}
                        className={`w-7 flex justify-center shrink-0 ${
                          model.capabilities.includes(cap)
                            ? dimmed ? 'text-foreground' : 'text-primary'
                            : 'text-transparent'
                        }`}
                      >
                        <CapabilityIcon cap={cap} />
                      </span>
                    ))}
                    <div className="w-4 flex justify-center shrink-0">
                      {isSelected && !dimmed && <Check className="w-3 h-3 text-primary" />}
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
