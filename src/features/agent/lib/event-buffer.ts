/**
 * Module-level event buffer for WS/REST reconciliation.
 *
 * During session load, events are buffered while the REST snapshot is fetched.
 * After hydration, the buffer is drained and non-duplicate events are replayed.
 */

import type { AgentSessionEvent } from '../types';

let buffer: AgentSessionEvent[] = [];
let active = false;

export function startEventBuffering() {
  active = true;
  buffer = [];
}

/** Returns true if the event was buffered (caller should skip processing). */
export function bufferEvent(event: AgentSessionEvent): boolean {
  if (!active) return false;
  buffer.push(event);
  return true;
}

/** Stops buffering and returns all buffered events. */
export function drainEventBuffer(): AgentSessionEvent[] {
  active = false;
  const drained = buffer;
  buffer = [];
  return drained;
}
