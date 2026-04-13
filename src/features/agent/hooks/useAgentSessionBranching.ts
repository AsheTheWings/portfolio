'use client';

/**
 * useAgentSessionBranching - Hook for creating branches via WS
 * Sends revert_to_component / edit_component WS messages.
 * session_branched response is handled by useWsEventIngestion → triggers navigation.
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';

export function useAgentSessionBranching() {
  const { send } = useAgentConnection();

  /**
   * Submit edit by sending edit_component WS message
   */
  const submitEdit = useCallback(async (
    editingEventId: string,
    editingData: Record<string, unknown>
  ) => {
    const store = useAgentStore.getState();
    const sessionId = store.currentSessionId;
    if (!sessionId) {
      console.error('Cannot submit edit: no current session');
      return;
    }

    const updatedData: Record<string, unknown> = {};

    if (editingData.message !== undefined) {
      updatedData.message = editingData.message;
    }

    if (editingData.arguments !== undefined) {
      updatedData.arguments = typeof editingData.arguments === 'string'
        ? JSON.parse(editingData.arguments)
        : editingData.arguments;
    }

    if (editingData.result !== undefined) {
      updatedData.result = editingData.result;
    }

    store.cancelEdit();

    const frontConfig = store.agents[0]?.config ?? undefined;

    send({
      type: 'edit_component',
      sessionId,
      breakpointEventId: editingEventId,
      updatedData,
      configOverride: frontConfig as unknown as Record<string, unknown> | undefined,
    });
  }, [send]);

  /**
   * Revert to component by sending revert_to_component WS message
   */
  const revertToComponent = useCallback(async (eventId: string) => {
    const store = useAgentStore.getState();
    const sessionId = store.currentSessionId;
    if (!sessionId) {
      console.error('Cannot revert: no current session');
      return;
    }

    send({
      type: 'revert_to_component',
      sessionId,
      breakpointEventId: eventId,
    });
  }, [send]);

  return {
    submitEdit,
    revertToComponent,
  };
}
