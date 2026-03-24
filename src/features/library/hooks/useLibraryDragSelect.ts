'use client';

/**
 * useLibraryDragSelect - Drag selection handlers for @viselect/react
 */

import { useCallback } from 'react';
import { SelectionEvent } from '@viselect/react';
import { useLibraryStore } from '../stores/useLibraryStore';

/**
 * Extract item IDs from selected elements
 */
function extractIds(els: Element[]): string[] {
  return els.map(v => v.getAttribute('data-item-id')).filter((id): id is string => id !== null);
}

export function useLibraryDragSelect() {
  const onDragSelectStart = useCallback(({ event, selection }: SelectionEvent) => {
    // Don't start if clicking on an item
    const target = event?.target as HTMLElement | undefined;
    if (target?.closest('[data-item-id]')) {
      selection.cancel();
      return;
    }
  }, []);

  const onDragSelectMove = useCallback(({ store: { changed: { added, removed } } }: SelectionEvent) => {
    const addedIds = extractIds(added);
    const removedIds = extractIds(removed);
    
    useLibraryStore.setState(state => {
      const next = new Set(state.selectedIds);
      addedIds.forEach(id => next.add(id));
      removedIds.forEach(id => next.delete(id));
      return { selectedIds: next };
    });
  }, []);

  return {
    onDragSelectStart,
    onDragSelectMove,
  };
}
