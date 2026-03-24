'use client';

/**
 * SessionComponentContext - Provides component-level state and controls
 * Used by SessionComponentWrapper to pass data to wrapped components
 */

import { createContext, useContext } from 'react';
import type { SessionComponent, SessionComponentType, SessionComponentControls, RenderContext, EditingData } from '../types';

interface SessionComponentContextValue {
  // Component identity
  componentId: string;
  componentType?: SessionComponentType;
  componentRole?: 'user' | 'agent' | 'system';
  
  // Full component data bucket
  data: SessionComponent['data'];
  
  // Streaming state
  isStreaming: boolean;
  
  // Explicit controls (from component.controls)
  controls?: SessionComponentControls;
  
  // Render context
  renderContext?: RenderContext;
  
  // Edit mode state (from store)
  isEditMode: boolean;
  editingData?: EditingData | null;
  isValidForSubmit?: boolean;
  
  // Edit actions
  onStartEdit: (data: string | EditingData) => void;
  onUpdateEditingData: (data: EditingData) => void;
  onCancelEdit: () => void;
  onSubmitEdit: () => void;
  onValidationChange?: (isValid: boolean) => void;
}

const SessionComponentContext = createContext<SessionComponentContextValue | null>(null);

export function useSessionComponent(): SessionComponentContextValue {
  const context = useContext(SessionComponentContext);
  if (!context) {
    throw new Error('useSessionComponent must be used within a SessionComponentWrapper');
  }
  return context;
}

// Backward compat aliases (to be removed)
export const ControlsContext = SessionComponentContext;
export const useControls = useSessionComponent;

export { SessionComponentContext };
export type { SessionComponentContextValue };
