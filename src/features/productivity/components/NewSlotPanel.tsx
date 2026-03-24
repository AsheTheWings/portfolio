'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Slot } from '../core/types';
import { httpClient } from '@/features/shared/utils/http-client';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Input } from '@/features/shared/components/shadcn';

interface Workload {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchWorkloads(): Promise<Workload[]> {
  const res = await fetch('/api/productivity/workloads', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = (payload as { error?: string })?.error || 'Failed to load workloads';
    throw new Error(message);
  }

  return (await res.json()) as Workload[];
}

async function startSlotByWorkloadName(workloadName: string): Promise<Slot> {
  return httpClient.post<Slot>('/productivity/slots/start', {
    workload_name: workloadName,
  });
}

interface NewSlotPanelProps {
  onStarted: () => void;
}

export function NewSlotPanel({ onStarted }: NewSlotPanelProps) {
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [workloadName, setWorkloadName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWorkloads();
      setWorkloads(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workloads');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canStart = useMemo(
    () => workloadName.trim().length > 0 && !isStarting,
    [workloadName, isStarting]
  );

  const handleStart = useCallback(async () => {
    if (!canStart) return;

    setIsStarting(true);
    setError(null);
    try {
      await startSlotByWorkloadName(workloadName.trim());
      setWorkloadName('');
      onStarted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start slot');
    } finally {
      setIsStarting(false);
    }
  }, [canStart, onStarted, workloadName]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New slot</CardTitle>
        <CardDescription>Start tracking time for a workload.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <Input
            value={workloadName}
            onChange={(e) => setWorkloadName(e.target.value)}
            placeholder={isLoading ? 'Loading workloads…' : 'Workload name'}
            aria-label="Workload name"
            disabled={isLoading || isStarting}
          />

          {!isLoading && workloads.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {workloads.slice(0, 12).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWorkloadName(w.name)}
                  className="px-3 py-1 rounded-md border border-border bg-background text-sm hover:bg-accent transition-colors"
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={handleStart} disabled={!canStart}>
              {isStarting ? 'Starting…' : 'Start'}
            </Button>
            <Button variant="outline" onClick={load} disabled={isLoading || isStarting}>
              Refresh workloads
            </Button>
          </div>

          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
        </div>
      </CardContent>
      <CardFooter />
    </Card>
  );
}
