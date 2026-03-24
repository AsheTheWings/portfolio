'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Input, Textarea } from '@/features/shared/components/shadcn';

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

async function createWorkload(input: { name: string; description?: string | null }): Promise<Workload> {
  const res = await fetch('/api/productivity/workloads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, description: input.description ?? null }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = (payload as { error?: string })?.error || 'Failed to create workload';
    throw new Error(message);
  }

  return (await res.json()) as Workload;
}

interface WorkloadsPanelProps {
  onChanged?: () => void;
}

export function WorkloadsPanel({ onChanged }: WorkloadsPanelProps) {
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const canCreate = useMemo(() => name.trim().length > 0 && !isCreating, [name, isCreating]);

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

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);
    try {
      const created = await createWorkload({
        name: name.trim(),
        description: description.trim().length ? description.trim() : null,
      });

      setWorkloads(prev => [created, ...prev]);
      setName('');
      setDescription('');
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create workload');
    } finally {
      setIsCreating(false);
    }
  }, [canCreate, description, name, onChanged]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workloads</CardTitle>
        <CardDescription>Create and manage your workloads.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workload name"
              aria-label="Workload name"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              aria-label="Workload description"
              className="min-h-[96px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleCreate} disabled={!canCreate}>
              {isCreating ? 'Creating…' : 'Create'}
            </Button>
            <Button variant="outline" onClick={load} disabled={isLoading || isCreating}>
              Refresh
            </Button>
          </div>

          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

          <div className="border-t border-border pt-4">
            <div className="text-sm text-muted-foreground mb-2">
              {isLoading ? 'Loading…' : `${workloads.length} total`}
            </div>

            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : workloads.length === 0 ? (
              <div className="text-sm text-muted-foreground">No workloads yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {workloads.map((w) => (
                  <div key={w.id} className="rounded-lg border border-border px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
                    </div>
                    {w.description && (
                      <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{w.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter />
    </Card>
  );
}
