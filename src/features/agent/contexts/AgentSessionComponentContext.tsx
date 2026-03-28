'use client';

/**
 * AgentSessionComponentContext - Provides component-level state and controls
 * Used by AgentSessionComponentWrapper to pass data to wrapped components
 */

import { createContext, useContext } from 'react';
import type { AgentSessionComponent, AgentSessionComponentType, AgentSessionComponentControls, RenderContext, EditingData } from '../types';

interface AgentSessionComponentContextValue {
  // Component identity
  componentId: string;
  componentType?: AgentSessionComponentType;
  componentRole?: 'user' | 'agent' | 'system';
  
  // Full component data bucket
  data: AgentSessionComponent['data'];
  
  // Streaming state
  isStreaming: boolean;
  
  // Explicit controls (from component.controls)
  controls?: AgentSessionComponentControls;
  
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

const AgentSessionComponentContext = createContext<AgentSessionComponentContextValue | null>(null);

export function useAgentSessionComponent(): AgentSessionComponentContextValue {
  const context = useContext(AgentSessionComponentContext);
  if (!context) {
    throw new Error('useAgentSessionComponent must be used within a AgentSessionComponentWrapper');
  }
  return context;
}

// Backward compat aliases (to be removed)
export const ControlsContext = AgentSessionComponentContext;
export const useControls = useAgentSessionComponent;

export { AgentSessionComponentContext };
export type { AgentSessionComponentContextValue };
