'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X, Check } from 'lucide-react';
import { Checkbox as MuiCheckbox } from '@mui/material';
import { Input, Label, Slider, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, InputWithStackedButtons } from '@portfolio/ui/components/shadcn';
import type { ModelParameterSchema } from '../types/llm';

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
    return hasDefault ? `Default: ${formatDefault(defaultValue)}` : null;
  }, [configured, defaultValue, hasDefault]);

  const clear = () => {
    onUpdate({ [schema.key]: undefined });
    setDraft('');
    if (!hasDefault) setExpanded(false);
  };

  const renderEditor = () => {
    const constraints = schema.constraints;

    if (schema.control === 'reasoning-budget') {
      return (
        <Input
          type="number"
          value={getReasoningBudget(explicitValue)}
          onChange={(e) => onUpdate({
            [schema.key]: e.target.value ? { max_tokens: parseInt(e.target.value, 10) } : undefined,
          })}
          placeholder="Provider default"
          min={constraints?.min}
          step={constraints?.step}
          className="text-xs md:text-xs"
        />
      );
    }

    if (schema.control === 'select' || schema.type === 'enum') {
      const selectedOption = (constraints?.options ?? []).find((o) => o.value === explicitValue);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-background dark:bg-zinc-900 border border-input rounded-md text-foreground dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <span className="flex-1 text-left truncate">{selectedOption?.label ?? 'Provider default'}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
            <DropdownMenuItem
              onClick={() => onUpdate({ [schema.key]: undefined })}
              className="text-xs"
            >
              <span className="flex-1">Provider default</span>
              {!isSet(explicitValue) && <Check className="w-3 h-3 text-primary shrink-0" />}
            </DropdownMenuItem>
            {(constraints?.options ?? []).map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onUpdate({ [schema.key]: option.value })}
                className="text-xs"
              >
                <span className="flex-1">{option.label}</span>
                {explicitValue === option.value && <Check className="w-3 h-3 text-primary shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (schema.control === 'tri-state' || schema.type === 'boolean') {
      const valueLabel =
        typeof explicitValue === 'boolean'
          ? explicitValue
            ? 'Enabled'
            : 'Disabled'
          : 'Provider default';
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-background dark:bg-zinc-900 border border-input rounded-md text-foreground dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <span className="flex-1 text-left truncate">{valueLabel}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
            <DropdownMenuItem
              onClick={() => onUpdate({ [schema.key]: undefined })}
              className="text-xs"
            >
              <span className="flex-1">Provider default</span>
              {typeof explicitValue !== 'boolean' && <Check className="w-3 h-3 text-primary shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onUpdate({ [schema.key]: true })}
              className="text-xs"
            >
              <span className="flex-1">Enabled</span>
              {explicitValue === true && <Check className="w-3 h-3 text-primary shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onUpdate({ [schema.key]: false })}
              className="text-xs"
            >
              <span className="flex-1">Disabled</span>
              {explicitValue === false && <Check className="w-3 h-3 text-primary shrink-0" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          className="min-h-20 w-full px-3 py-2 text-xs bg-background dark:bg-zinc-900 border border-input rounded-md text-foreground dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      );
    }

    if (schema.control === 'slider' && typeof constraints?.min === 'number' && typeof constraints?.max === 'number') {
      const explicitNumber = numberValue(explicitValue);
      const defaultNumber = numberValue(defaultValue);
      const current = explicitNumber !== '' ? explicitNumber : defaultNumber !== '' ? defaultNumber : constraints.min;
      return (
        <div className="flex items-center gap-3">
          <Slider
            className="flex-1"
            min={constraints.min}
            max={constraints.max}
            step={constraints.step ?? 0.01}
            value={[current]}
            onValueChange={([value]) => onUpdate({ [schema.key]: value })}
          />
          <InputWithStackedButtons
            value={current}
            onChange={(value) => onUpdate({
              [schema.key]: parseNumberInput(String(value), schema.type === 'integer'),
            })}
            minValue={constraints.min}
            maxValue={constraints.max}
            step={constraints.step ?? 0.01}
            className="w-24"
            inputClassName="text-xs md:text-xs"
          />
        </div>
      );
    }

    if (schema.type === 'number' || schema.type === 'integer') {
      const hasSlider = typeof constraints?.min === 'number' && typeof constraints?.max === 'number';
      const numVal = numberValue(explicitValue);
      if (hasSlider && numVal !== '') {
        return (
          <div className="flex items-center gap-3">
            <Slider
              className="flex-1"
              min={constraints.min}
              max={constraints.max}
              step={constraints.step ?? (schema.type === 'integer' ? 1 : 0.01)}
              value={[numVal]}
              onValueChange={([value]) => onUpdate({ [schema.key]: value })}
            />
            <InputWithStackedButtons
              value={numVal}
              onChange={(value) => onUpdate({
                [schema.key]: parseNumberInput(String(value), schema.type === 'integer'),
              })}
              minValue={constraints.min}
              maxValue={constraints.max}
              step={constraints.step ?? (schema.type === 'integer' ? 1 : 0.01)}
              className="w-24"
              inputClassName="text-xs md:text-xs"
            />
          </div>
        );
      }
      return (
        <InputWithStackedButtons
          value={numVal === '' ? undefined : numVal}
          onChange={(value) => onUpdate({
            [schema.key]: parseNumberInput(String(value), schema.type === 'integer'),
          })}
          minValue={constraints?.min}
          maxValue={constraints?.max}
          step={constraints?.step}
          className="w-full max-w-[96px]"
          inputClassName="text-xs md:text-xs"
        />
      );
    }

    return (
      <Input
        value={typeof explicitValue === 'string' ? explicitValue : ''}
        onChange={(e) => onUpdate({ [schema.key]: e.target.value || undefined })}
        placeholder="Provider default"
        className="text-xs md:text-xs"
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
            <span
              className={`text-[10px] text-primary ${configured ? 'visible' : 'invisible'}`}
              aria-hidden={!configured}
            >
              configured
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{schema.description}</p>
          {!expanded && helper && <p className="text-[0.7rem] text-muted-foreground mt-1">{helper}</p>}
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
        {configured ? (
          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Reset ${schema.label}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : !expanded && !hasDefault ? null : (
          <span className="w-3.5 shrink-0" aria-hidden="true" />
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
