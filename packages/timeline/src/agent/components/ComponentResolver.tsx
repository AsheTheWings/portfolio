/**
 * Component Resolver — Centralized component type→React mapping
 *
 * Both ChatInterface and FlatInterface delegate to resolveComponent()
 * for determining which React component renders for a given type.
 * Interfaces handle structural concerns (layout, grouping, ship wrapping).
 *
 * Exports:
 * - resolveComponent(): Maps any SessionComponent to React content
 * - resolveSystemPanel(): Maps system panel types to their React components
 */

import React from 'react';
import type { SessionComponent } from '../types';
import { useAgentStore } from '../stores/useAgentStore';
import { AgentsConfigPanel } from './AgentsConfigPanel';
import { SettingsPanel } from './SettingsPanel';
import { HistoryPanel } from './HistoryPanel';
import { AssetPickerPanel } from './AssetPickerPanel';
import { UserMessage } from './UserMessage';
import { AgentMessage } from './AgentMessage';
import { AgentThoughts } from './AgentThoughts';
import { ToolCall } from './ToolCall';
import { UserFeedback } from './UserFeedback';
import { FlatAgentResponse } from './FlatAgentResponse';
import { ResumeWorkflow } from './ResumeWorkflow';
import { isTextFeedback } from '../utils/toSessionComponent';

// Tool-owned components
import { SystemCall } from '../tools/system-call';

/**
 * Resolve a system panel type to its React component.
 * Panels are self-contained — they handle close internally.
 */
export function resolveSystemPanel(
  type: 'config-panel' | 'settings-panel' | 'history-panel' | 'asset-picker-panel',
): React.ReactNode {
  switch (type) {
    case 'config-panel':
      return <AgentsConfigPanel />;
    case 'settings-panel':
      return <SettingsPanel />;
    case 'history-panel':
      return <HistoryPanel />;
    case 'asset-picker-panel':
      return <AssetPickerPanel />;
  }
}

/**
 * Resolve any SessionComponent to its pure React representation.
 * Returns content-only components — no collapse wrappers or layout shells.
 * The consuming interface applies structural wrappers (CollapsibleShip, etc.).
 */
export function resolveComponent(
  component: SessionComponent,
): React.ReactNode {
  // Read user mode once — used by multiple cases below.
  // useAgentStore.getState() is synchronous and safe to call outside hooks.
  const { userMode, selectedWorkflowId } = useAgentStore.getState();
  const isClientMode = userMode === 'client';

  switch (component.type) {
    // Chat-mode composites
    case 'user-message':
      return <UserMessage component={component} />;

    case 'agent-message': {
      return <AgentMessage component={component} />;
    }

    // Shared types (both modes)
    case 'user-feedback':
      return <UserFeedback feedback={isTextFeedback(component.data.result) ? component.data.result.userFeedback : ''} />;
    case 'system-call':
      return <SystemCall data={component.data} />;

    // Flat-mode standalone types (not reached in chat mode)
    case 'agent-thoughts':
      // In client mode: suppress thoughts entirely.
      if (isClientMode) return null;
      return <AgentThoughts thoughts={component.data.thoughts} isStreaming={component.isStreaming} />;

    case 'tool-call':
      // In client mode: suppress tool-call cards entirely.
      if (isClientMode) return null;
      return <ToolCall data={component.data} />;

    case 'message':
      if (component.role !== 'agent') return null;
      // In client mode: suppress while streaming (flat interface parallel to chat guard).
      if (isClientMode && component.isStreaming) return null;
      return <FlatAgentResponse component={component} />;

    // System components
    case 'resume-workflow':
      return <ResumeWorkflow />;

    // System panels
    case 'config-panel':
    case 'settings-panel':
    case 'history-panel':
    case 'asset-picker-panel':
      return resolveSystemPanel(component.type);

    default:
      return null;
  }
}
