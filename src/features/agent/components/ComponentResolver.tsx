/**
 * Component Resolver — Shared utilities for resolving component types
 *
 * Provides:
 * - resolveSystemPanel(): Maps system panel types to their React components
 * - resolveComponent(): Flat switch for all component types (used by flat mode)
 *
 * Chat mode renders UserMessage/AgentMessage directly in ChatInterface.
 * Flat mode uses resolveComponent for standalone types.
 */

import React from 'react';
import type { AgentSessionComponent } from '../types';
import { AgentsConfigPanel } from './AgentsConfigPanel';
import { SettingsPanel } from './SettingsPanel';
import { HistoryPanel } from './HistoryPanel';
import { AssetPickerPanel } from './AssetPickerPanel';
import { UserMessage } from './UserMessage';
import { AgentMessage } from './AgentMessage';
import { AgentThoughts } from './AgentThoughts';
import { ToolCall } from './ToolCall';
import { UserFeedback } from './UserFeedback';
import { MarkdownContent } from './MarkdownContent';
import { isTextFeedback } from '../utils/toAgentSessionComponent';

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
 * Resolve any AgentSessionComponent to its React representation.
 * Flat switch — no wrapper, no RenderContext. Each component receives
 * data via props and renders inside its own ComponentShell.
 */
export function resolveComponent(
  component: AgentSessionComponent,
): React.ReactNode {
  switch (component.type) {
    case 'user-message':
      return <UserMessage component={component} />;
    case 'agent-message':
      return <AgentMessage component={component} />;
    case 'user-feedback':
      return <UserFeedback feedback={isTextFeedback(component.data.result) ? component.data.result.userFeedback : ''} />;
    case 'system-call':
      return <SystemCall data={component.data} />;
    // Flat mode standalone types (not reached in chat mode):
    case 'agent-thoughts':
      return <AgentThoughts maxLines={6} thoughts={component.data.thoughts} isStreaming={component.isStreaming} />;
    case 'tool-call':
      return <ToolCall data={component.data} />;
    case 'message':
      return component.role === 'agent'
        ? <div className="p-3 rounded-lg bg-muted/30 border border-border/50"><MarkdownContent content={component.data.message ?? ''} /></div>
        : null;
    // System panels:
    case 'config-panel':
    case 'settings-panel':
    case 'history-panel':
    case 'asset-picker-panel':
      return resolveSystemPanel(component.type);
    default:
      return null;
  }
}
