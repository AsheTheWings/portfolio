'use client';

/**
 * useSessionBranching - Hook for creating branches via WS
 * Sends revert_to_session_event / edit_session_event WS messages.
 * session_branched response is handled by useWsEventIngestion → triggers navigation.
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';
import { JsonValueSchema, type JsonValue } from '@agentime/protocol';
import { runScopedCommand } from '../problems/commands';

export function useSessionBranching() {
  const { command } = useAgentConnection();

  /**
   * Submit edit by sending edit_session_event WS message
   */
  const submitEdit = useCallback(async (
    editingEventId: string,
    editingData: Record<string, unknown>
  ) => {
    const store = useAgentStore.getState();
    const sessionId = store.currentSessionId;
    if (!sessionId) {
      return;
    }

    const updatedData: Record<string, JsonValue> = {};

    if (editingData.message !== undefined) {
      updatedData.message = JsonValueSchema.parse(editingData.message);
    }

    if (editingData.arguments !== undefined) {
      updatedData.arguments = JsonValueSchema.parse(typeof editingData.arguments === 'string'
        ? JSON.parse(editingData.arguments)
        : editingData.arguments);
    }

    if (editingData.result !== undefined) {
      updatedData.result = JsonValueSchema.parse(editingData.result);
    }

    store.cancelEdit();

    const frontConfig = store.agents[0]?.config ?? undefined;

    await runScopedCommand(command, {
      type: 'edit_session_event',
      sessionId,
      breakpointEventId: editingEventId,
      updatedData,
      configOverride: frontConfig,
    }, `session-edit:${editingEventId}`).catch(() => undefined);
  }, [command]);

  /**
   * Revert to a session event by sending revert_to_session_event WS message
   */
  const revertToComponent = useCallback(async (eventId: string) => {
    const store = useAgentStore.getState();
    const sessionId = store.currentSessionId;
    if (!sessionId) {
      return;
    }

    await runScopedCommand(command, {
      type: 'revert_to_session_event',
      sessionId,
      breakpointEventId: eventId,
    }, `session-revert:${eventId}`).catch(() => undefined);
  }, [command]);

  return {
    submitEdit,
    revertToComponent,
  };
}
