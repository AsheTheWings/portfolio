'use client';

import { useCallback, useEffect, useState } from 'react';
import { Slider } from '@/features/shared/components/shadcn/slider';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '@/features/shared/components/shadcn/field';
import { getConfig, saveConfig } from '../core/config-storage';

export function SettingsView() {
  const config = getConfig();

  const [maxConcurrent, setMaxConcurrent] = useState(config.maxConcurrentSessions);
  const [breakThreshold, setBreakThreshold] = useState(config.breakThresholdMinutes);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMaxConcurrent(config.maxConcurrentSessions);
    setBreakThreshold(config.breakThresholdMinutes);
  }, [config.breakThresholdMinutes, config.maxConcurrentSessions]);

  const persist = useCallback((partial: { maxConcurrentSessions?: number; breakThresholdMinutes?: number }) => {
    try {
      const nextBreak = partial.breakThresholdMinutes ?? breakThreshold;
      const nextMax = partial.maxConcurrentSessions ?? maxConcurrent;

      if (nextBreak < 1 || nextBreak > 60) {
        setError('Break threshold must be between 1-60 minutes');
        return;
      }

      if (nextMax < 1 || nextMax > 5) {
        setError('Max concurrent sessions must be between 1-5');
        return;
      }

      saveConfig({
        breakThresholdMinutes: nextBreak,
        maxConcurrentSessions: nextMax,
      });

      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    }
  }, [breakThreshold, maxConcurrent]);

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10">
      <div className="space-y-4">
        <FieldGroup>
          <FieldSet>
            <Field>
              <FieldTitle>Max Concurrent Sessions</FieldTitle>
              <FieldDescription>
                Run at most <span className="font-medium tabular-nums">{maxConcurrent}</span>{' '}
                {maxConcurrent === 1 ? 'slot' : 'slots'} simultaneously
              </FieldDescription>
              <Slider
                value={[maxConcurrent]}
                onValueChange={(v) => {
                  setMaxConcurrent(v[0]);
                  persist({ maxConcurrentSessions: v[0] });
                }}
                max={5}
                min={1}
                step={1}
                className="mt-2"
                aria-label="Max Concurrent Sessions"
              />
            </Field>

            <FieldSeparator />

            <Field>
              <FieldTitle>Break Threshold</FieldTitle>
              <FieldDescription>
                Gaps ≤<span className="font-medium tabular-nums">{breakThreshold}</span> minutes continue
                the same session
              </FieldDescription>
              <Slider
                value={[breakThreshold]}
                onValueChange={(v) => {
                  setBreakThreshold(v[0]);
                  persist({ breakThresholdMinutes: v[0] });
                }}
                max={60}
                min={1}
                step={1}
                className="mt-2"
                aria-label="Break Threshold in Minutes"
              />
            </Field>
          </FieldSet>

          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>
      </div>
    </div>
  );
}
