'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NewSlotPanel,
  SettingsPanel,
  ToolsBar,
  type ProductivityAction,
  WorkloadsPanel,
} from '@/features/productivity';
import type { Slot } from '@/features/productivity/core/types';
import { SessionCard } from '@/features/productivity/components/SessionCard';
import { httpClient } from '@/features/shared/utils/http-client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/features/shared/components/shadcn';

async function fetchActiveSlots(): Promise<Slot[]> {
  return httpClient.get<Slot[]>('/productivity/slots/active');
}

async function stopSlot(slotId: string): Promise<void> {
  await httpClient.post('/productivity/slots/stop', { slot_id: slotId });
}

async function stopAllSlots(): Promise<void> {
  await httpClient.post('/productivity/slots/stop-all');
}
export default function ProductivityClient() {
  const [activeSlots, setActiveSlots] = useState<Slot[]>([]);
  const [isLoadingActive, setIsLoadingActive] = useState(true);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openPanel, setOpenPanel] = useState<ProductivityAction | null>(null);
  const [panelInstance, setPanelInstance] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const refreshActiveSlots = useCallback(async () => {
    setIsLoadingActive(true);
    setError(null);
    try {
      const activeSlotData = await fetchActiveSlots();
      setActiveSlots(activeSlotData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load active slots');
    } finally {
      setIsLoadingActive(false);
    }
  }, []);

  useEffect(() => {
    void refreshActiveSlots();
  }, [refreshActiveSlots]);

  useEffect(() => {
    if (!openPanel) return;

    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current && panelRef.current.contains(target)) return;
      setOpenPanel(null);
    };

    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [openPanel]);

  const handleToolbarAction = useCallback((action: ProductivityAction) => {
    setOpenPanel(action);
    setPanelInstance((v) => v + 1);
  }, []);

  const handleStop = useCallback(async (slotId: string) => {
    setIsStopping(true);
    setError(null);
    try {
      await stopSlot(slotId);
      await refreshActiveSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop slot');
    } finally {
      setIsStopping(false);
    }
  }, [refreshActiveSlots]);

  const handleStopAll = useCallback(async () => {
    setIsStopping(true);
    setError(null);
    try {
      await stopAllSlots();
      await refreshActiveSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop slots');
    } finally {
      setIsStopping(false);
    }
  }, [refreshActiveSlots]);

  const panel = useMemo(() => {
    if (!openPanel) return null;

    if (openPanel === 'new-slot') {
      return (
        <NewSlotPanel
          key={panelInstance}
          onStarted={async () => {
            setOpenPanel(null);
            await refreshActiveSlots();
          }}
        />
      );
    }

    if (openPanel === 'workloads') {
      return <WorkloadsPanel key={panelInstance} />;
    }

    return <SettingsPanel key={panelInstance} />;
  }, [openPanel, panelInstance, refreshActiveSlots]);

  return (
    <div className="h-full w-full">
      <ToolsBar onAction={handleToolbarAction} />

      <div className="w-full max-w-6xl mx-auto px-6 py-10">
        <div className="lg:block">
          {panel && (
            <div ref={panelRef} className="mb-6 lg:float-right lg:w-[420px] lg:max-h-[600px] border-2 border-red-500 lg:overflow-auto lg:ml-6 lg:mb-6">
              {panel}
            </div>
          )}

          <div className="mb-6 overflow-hidden">
            <div>
              <h2 className="text-lg font-semibold">Active slots</h2>
              <p className="text-sm text-muted-foreground">Currently running timers.</p>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                onClick={refreshActiveSlots}
                disabled={isStopping || isLoadingActive}
              >
                Refresh
              </Button>
              <Button
                variant="destructive"
                onClick={handleStopAll}
                disabled={activeSlots.length === 0 || isStopping}
              >
                Stop all
              </Button>
            </div>
          </div>

          {isLoadingActive ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : activeSlots.length === 0 ? (
            <div className="text-sm text-muted-foreground">No active slots.</div>
          ) : (
            <>
              {activeSlots.map((slot, index) => (
                <div key={slot.id} className="relative inline-block w-full md:w-[calc(50%-0.5rem)] lg:w-full mb-4 lg:mr-4 align-top">
                  <SessionCard
                    slot={slot}
                    index={index}
                    totalSlots={activeSlots.length}
                    isNewest={index === 0}
                    isOldest={index === activeSlots.length - 1}
                  />

                  <div className="absolute bottom-4 right-4">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStop(slot.id)}
                      disabled={isStopping}
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}

          {error && <div className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</div>}
        </div>
      </div>
    </div>
  );
}
