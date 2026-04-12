'use client';

import type { Slot, SessionConfig } from './types';

export type { SessionConfig };

export interface Session {
  workload_id: string;
  workload_name: string;
  slots: Slot[];
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  slot_count: number;
}

export interface SessionContinuityResult {
  willContinue: boolean;
  gapMinutes: number | null;
  lastSlot: Slot | null;
  reason: 'same_session' | 'new_session' | 'no_previous_slot';
}

export interface ConcurrentCheckResult {
  canStart: boolean;
  activeCount: number;
  maxAllowed: number;
  shouldAutoStop: boolean;
  slotToAutoStop: Slot | null;
  reason: 'under_limit' | 'at_limit_auto_stop' | 'same_workload_active';
}

export function getDefaultConfig(): SessionConfig {
  return {
    breakThresholdMinutes: parseInt(process.env.NEXT_PUBLIC_BREAK_THRESHOLD_MINUTES || '5', 10),
    maxConcurrentSessions: parseInt(process.env.NEXT_PUBLIC_MAX_CONCURRENT_SESSIONS || '1', 10),
  };
}

export function groupSlotsIntoSessions(slots: Slot[], breakThresholdMinutes: number): Session[] {
  const slotsByWorkload = new Map<string, Slot[]>();

  slots
    .filter(slot => slot.end_time !== null)
    .forEach(slot => {
      if (!slotsByWorkload.has(slot.workload_id)) {
        slotsByWorkload.set(slot.workload_id, []);
      }
      slotsByWorkload.get(slot.workload_id)!.push(slot);
    });

  const sessions: Session[] = [];

  slotsByWorkload.forEach((workloadSlots) => {
    const sorted = [...workloadSlots].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    let currentSession: Slot[] = [];

    sorted.forEach((slot, index) => {
      if (index === 0) {
        currentSession = [slot];
      } else {
        const prevSlot = sorted[index - 1];
        const gapMinutes = calculateGapMinutes(prevSlot.end_time!, slot.start_time);

        if (gapMinutes <= breakThresholdMinutes) {
          currentSession.push(slot);
        } else {
          if (currentSession.length > 0) {
            sessions.push(createSessionFromSlots(currentSession));
          }
          currentSession = [slot];
        }
      }

      if (index === sorted.length - 1 && currentSession.length > 0) {
        sessions.push(createSessionFromSlots(currentSession));
      }
    });
  });

  return sessions;
}

export function checkSessionContinuity(
  slots: Slot[],
  workloadId: string,
  currentTime: Date,
  breakThresholdMinutes: number
): SessionContinuityResult {
  const lastCompletedSlot = getLastCompletedSlot(slots, workloadId);

  if (!lastCompletedSlot || !lastCompletedSlot.end_time) {
    return {
      willContinue: false,
      gapMinutes: null,
      lastSlot: null,
      reason: 'no_previous_slot',
    };
  }

  const gapMinutes = calculateGapMinutes(lastCompletedSlot.end_time, currentTime.toISOString());
  const willContinue = gapMinutes <= breakThresholdMinutes;

  return {
    willContinue,
    gapMinutes,
    lastSlot: lastCompletedSlot,
    reason: willContinue ? 'same_session' : 'new_session',
  };
}

export function checkConcurrentSlotLimit(
  slots: Slot[],
  workloadId: string,
  maxConcurrentSessions: number
): ConcurrentCheckResult {
  const activeSlots = getActiveSlots(slots);

  const sameWorkloadActive = activeSlots.find(slot => slot.workload_id === workloadId);
  if (sameWorkloadActive) {
    return {
      canStart: false,
      activeCount: activeSlots.length,
      maxAllowed: maxConcurrentSessions,
      shouldAutoStop: false,
      slotToAutoStop: null,
      reason: 'same_workload_active',
    };
  }

  if (activeSlots.length < maxConcurrentSessions) {
    return {
      canStart: true,
      activeCount: activeSlots.length,
      maxAllowed: maxConcurrentSessions,
      shouldAutoStop: false,
      slotToAutoStop: null,
      reason: 'under_limit',
    };
  }

  const oldestSlot = [...activeSlots].sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )[0];

  return {
    canStart: true,
    activeCount: activeSlots.length,
    maxAllowed: maxConcurrentSessions,
    shouldAutoStop: true,
    slotToAutoStop: oldestSlot,
    reason: 'at_limit_auto_stop',
  };
}

export function getActiveSlots(slots: Slot[]): Slot[] {
  return slots
    .filter(slot => slot.end_time === null)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
}

export function getActiveSlot(slots: Slot[]): Slot | null {
  const active = getActiveSlots(slots);
  return active.length > 0 ? active[0] : null;
}

export function getLastCompletedSlot(slots: Slot[], workloadId: string): Slot | null {
  const completed = slots
    .filter(slot => slot.workload_id === workloadId && slot.end_time !== null)
    .sort((a, b) => new Date(b.end_time!).getTime() - new Date(a.end_time!).getTime());

  return completed.length > 0 ? completed[0] : null;
}

export function calculateGapMinutes(endTime: string, startTime: string): number {
  const end = new Date(endTime).getTime();
  const start = new Date(startTime).getTime();
  return (start - end) / (1000 * 60);
}

function createSessionFromSlots(slots: Slot[]): Session {
  const sorted = [...slots].sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const firstSlot = sorted[0];
  const lastSlot = sorted[sorted.length - 1];

  const totalDuration = sorted.reduce((sum, slot) => sum + (slot.duration || 0), 0);

  return {
    workload_id: firstSlot.workload_id,
    workload_name: firstSlot.workload_name,
    slots: sorted,
    start_time: firstSlot.start_time,
    end_time: lastSlot.end_time!,
    duration_seconds: totalDuration,
    slot_count: sorted.length,
  };
}

export function calculateActiveDuration(startTime: string): number {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  return Math.floor((now - start) / 1000);
}

export function getSessionSlots(
  slots: Slot[],
  workloadId: string,
  breakThresholdMinutes: number
): Slot[] {
  const lastSlot = getLastCompletedSlot(slots, workloadId);

  if (!lastSlot || !lastSlot.end_time) {
    return [];
  }

  // Find contiguous session: walk backwards from last completed slot,
  // include slots where the gap between consecutive slots < breakThreshold
  const workloadSlots = slots
    .filter(slot =>
      slot.workload_id === workloadId &&
      slot.end_time !== null
    )
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const thresholdMs = breakThresholdMinutes * 60 * 1000;
  const sessionSlots: Slot[] = [];

  for (let i = workloadSlots.length - 1; i >= 0; i--) {
    sessionSlots.unshift(workloadSlots[i]);
    if (i > 0) {
      const prevEnd = new Date(workloadSlots[i - 1].end_time!).getTime();
      const currStart = new Date(workloadSlots[i].start_time).getTime();
      if (currStart - prevEnd > thresholdMs) break;
    }
  }

  return sessionSlots;
}
