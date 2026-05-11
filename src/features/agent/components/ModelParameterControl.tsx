'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Checkbox as MuiCheckbox } from '@mui/material';
import { Input, Label, Slider } from '@/features/shared/components/shadcn';
import type { ModelParameterSchema } from '../types';

type ProviderParameters = Record<string, unknown>;

interface ModelParameterControlProps {
  schema: ModelParameterSchema;
  providerParameters: ProviderParameters;
  defaultValue?: unknown;
  onUpdate: (updates: ProviderParameters) => void;
}

function isSet(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function formatDefault(value: unknown): string {
  if (!isSet(value)) return 'Provider default';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function numberValue(value: unknown): number | '' {
  return typeof value === 'number' && Number.isFinite(value) ? value : '';
}

function stringArrayValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string').join('\n');
  return typeof value === 'string' ? value : '';
}

function parseStringArray(value: string): string[] | undefined {
  const values = value
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);
  return values.length ? values : undefined;
}

function parseNumberInput(raw: string, integer: boolean): number | undefined {
  if (!raw) return undefined;
  const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getReasoningBudget(value: unknown): number | '' {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const budget = (value as { max_tokens?: unknown }).max_tokens;
  return typeof budget === 'number' && Number.isFinite(budget) ? budget : '';
}

export function ModelParameterControl({
  schema,
  providerParameters,
  defaultValue,
  onUpdate,
}: ModelParameterControlProps) {
  const explicitValue = providerParameters[schema.key];
  const configured = isSet(explicitValue);
  const hasDefault = isSet(defaultValue);
  const [expanded, setExpanded] = useState(configured || hasDefault);
  const [draft, setDraft] = useState(() => stringArrayValue(explicitValue));

  const helper = useMemo(() => {
    if (configured) return 'Custom value';
    return `Default: ${formatDefault(defaultValue)}`;
  }, [configured, defaultValue]);

  const clear = () => {
    onUpdate({ [schema.key]: undefined });
    setDraft('');
    if (!hasDefault) setExpanded(false);
  };

  const renderEditor = () => {
    if (schema.control === 'reasoning-budget') {
      return (
        <Input
          type="number"
          value={getReasoningBudget(explicitValue)}
          onChange={(e) => onUpdate({
            [schema.key]: e.target.value ? { max_tokens: parseInt(e.target.value, 10) } : undefined,
          })}
          placeholder="Provider default"
          min={schema.constraints?.min}
          step={schema.constraints?.step}
        />
      );
    }

    if (schema.control === 'select' || schema.type === 'enum') {
      return (
        <select
          value={typeof explicitValue === 'string' ? explicitValue : ''}
          onChange={(e) => onUpdate({ [schema.key]: e.target.value || undefined })}
          className="w-full px-3 py-2 text-sm bg-background dark:bg-zinc-900 border border-input rounded-md text-foreground dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Provider default</option>
          {(schema.constraints?.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    }

    if (schema.control === 'tri-state' || schema.type === 'boolean') {
      return (
        <select
          value={typeof explicitValue === 'boolean' ? String(explicitValue) : ''}
          onChange={(e) => onUpdate({
            [schema.key]: e.target.value === '' ? undefined : e.target.value === 'true',
          })}
          className="w-full px-3 py-2 text-sm bg-background dark:bg-zinc-900 border border-input rounded-md text-foreground dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Provider default</option>
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      );
    }

    if (schema.control === 'tags' || schema.type === 'string[]') {
      return (
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onUpdate({ [schema.key]: parseStringArray(e.target.value) });
          }}
          placeholder="One stop sequence per line"
          className="min-h-20 w-full px-3 py-2 text-sm bg-background dark:bg-zinc-900 border border-input rounded-md text-foreground dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      );
    }

    if (schema.control === 'slider' && typeof schema.constraints?.min === 'number' && typeof schema.constraints?.max === 'number') {
      const explicitNumber = numberValue(explicitValue);
      const defaultNumber = numberValue(defaultValue);
      const current = explicitNumber !== '' ? explicitNumber : defaultNumber !== '' ? defaultNumber : schema.constraints.min;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Slider
              min={schema.constraints.min}
              max={schema.constraints.max}
              step={schema.constraints.step ?? 0.01}
              value={[current]}
              onValueChange={([value]) => onUpdate({ [schema.key]: value })}
            />
            <Input
              type="number"
              value={current}
              onChange={(e) => onUpdate({
                [schema.key]: parseNumberInput(e.target.value, schema.type === 'integer'),
              })}
              min={schema.constraints.min}
              max={schema.constraints.max}
              step={schema.constraints.step}
              className="w-20"
            />
          </div>
        </div>
      );
    }

    if (schema.type === 'number' || schema.type === 'integer') {
      return (
        <Input
          type="number"
          value={numberValue(explicitValue)}
          onChange={(e) => onUpdate({
            [schema.key]: parseNumberInput(e.target.value, schema.type === 'integer'),
          })}
          placeholder="Provider default"
          min={schema.constraints?.min}
          max={schema.constraints?.max}
          step={schema.constraints?.step}
        />
      );
    }

    return (
      <Input
        value={typeof explicitValue === 'string' ? explicitValue : ''}
        onChange={(e) => onUpdate({ [schema.key]: e.target.value || undefined })}
        placeholder="Provider default"
      />
    );
  };

  return (
    <div className="rounded-md border border-border bg-background/40 p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 text-muted-foreground hover:text-foreground"
          aria-label={expanded ? `Collapse ${schema.label}` : `Configure ${schema.label}`}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <Label className="font-normal text-[0.805rem] cursor-pointer">{schema.label}</Label>
            {configured && <span className="text-[10px] text-primary">configured</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{schema.description}</p>
          {!expanded && <p className="text-[0.7rem] text-muted-foreground mt-1">{helper}</p>}
        </button>
        {!expanded && !configured && !hasDefault && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 text-[0.7rem] text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="w-3 h-3" />
            Configure
          </button>
        )}
        {configured && (
          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Reset ${schema.label}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="pl-5 flex flex-col gap-1.5">
          {schema.control === 'tri-state' && schema.key === 'include_reasoning' ? (
            <div className="flex items-center">
              <MuiCheckbox
                checked={explicitValue === true}
                indeterminate={explicitValue === undefined}
                onChange={(e) => onUpdate({ [schema.key]: e.target.checked ? true : undefined })}
                size="small"
                disableRipple
                sx={{
                  padding: '2px',
                  color: 'var(--color-border)',
                  '&.Mui-checked': { color: 'var(--color-primary)' },
                }}
              />
              <span className="text-xs text-muted-foreground">
                {explicitValue === true ? 'Enabled' : 'Provider default'}
              </span>
            </div>
          ) : renderEditor()}
          <p className="text-[0.7rem] text-muted-foreground">Leave unset to use the provider/model default.</p>
        </div>
      )}
    </div>
  );
}
