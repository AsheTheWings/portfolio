'use client';

import { getDefaultConfig } from './session-calculator';
import type { SessionConfig } from './types';

const STORAGE_KEY = 'timeline_session_config';

export function getConfig(): SessionConfig {
  if (typeof window === 'undefined') {
    return getDefaultConfig();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultConfig();
    }

    const parsed = JSON.parse(stored) as Partial<SessionConfig>;
    const defaults = getDefaultConfig();

    return {
      breakThresholdMinutes: parsed.breakThresholdMinutes ?? defaults.breakThresholdMinutes,
      maxConcurrentSessions: parsed.maxConcurrentSessions ?? defaults.maxConcurrentSessions,
    };
  } catch {
    return getDefaultConfig();
  }
}

export function saveConfig(config: Partial<SessionConfig>): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const current = getConfig();
    const updated = {
      ...current,
      ...config,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save config:', error);
    throw new Error('Failed to save configuration');
  }
}

export function resetConfig(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset config:', error);
  }
}
