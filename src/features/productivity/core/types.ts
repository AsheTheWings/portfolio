'use client';

export interface Slot {
  id: string;
  workload_id: string;
  workload_name: string;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  is_active: boolean;
}

export interface SessionConfig {
  breakThresholdMinutes: number;
  maxConcurrentSessions: number;
}
