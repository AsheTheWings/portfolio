'use client';

/**
 * useConfiguredProviders Hook
 *
 * Fetches which providers have API keys configured from the backend.
 * Extracted from ModelPickerView so the picker stays a pure UI component.
 */

import { useState, useEffect } from 'react';
import { httpClient } from '@/features/shared/utils/http-client';

export function useConfiguredProviders(): Set<string> {
  const [configured, setConfigured] = useState<Set<string>>(new Set());

  useEffect(() => {
    httpClient
      .get<{ configured: string[] }>('/settings/api-keys')
      .then((data) => setConfigured(new Set(data.configured)))
      .catch(() => { /* panel still usable without key status */ });
  }, []);

  return configured;
}
