'use client';

/**
 * Configuration storage for session settings
 * Uses localStorage for client-side persistence
 */

import { getDefaultConfig, type SessionConfig } from '@/features/productivity/core/session-calculator';

const STORAGE_KEY = 'timeline_session_config';

/**
 * Get current session configuration
 * Falls back to defaults if not set
 */
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

/**
 * Save session configuration
 */
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

/**
 * Reset configuration to defaults
 */
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
