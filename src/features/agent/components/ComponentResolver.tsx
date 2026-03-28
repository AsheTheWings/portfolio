/**
 * Component Resolver - Maps AgentSessionComponent types to React components
 * 
 * Provides context-aware rendering:
 * - Same component type can render differently based on UI mode
 * - Separates data layer (AgentSessionComponent) from presentation layer
 * - Enables custom UI for different component types (tools, panels, messages)
 * - Handles presentation concerns (e.g., system panels are centered in chat mode)
 */

import React from 'react';
import type { AgentSessionComponent, RenderContext } from '../types';
import { AgentConfigPanel } from './AgentConfigPanel';
import { SettingsPanel } from './SettingsPanel';
import { HistoryPanel } from './HistoryPanel';
import { AssetPickerPanel } from './AssetPickerPanel';
import { MessageBubble } from './MessageBubble';
import { AgentThoughts } from './AgentThoughts';
import { ToolCall } from './ToolCall';
import { UserFeedback } from './UserFeedback';
import { AgentSessionComponentWrapper } from './AgentSessionComponentWrapper';

// Tool-owned components
import { 
  AgentJobCreation, 
  AgentJobDashboard,
  AgentJobSummary,
  AgentJobOperation 
} from '../tools/agent-job';
import { SystemCall } from '../tools/system-call';

/**
 * Resolve a AgentSessionComponent to its React representation
 * 
 * All non-system components are wrapped in AgentSessionComponentWrapper for consistent UX.
 * System panels (config, settings, history) have their own close/layout handling.
 * 
 * @param component - The AgentSessionComponent to render
 * @param context - Rendering context (mode, standalone, etc.)
 * @returns React element or null
 */
export function resolveComponent(
  component: AgentSessionComponent,
  context: RenderContext
): React.ReactNode {
  const { type, role, data, id, isStreaming, hideComponent, controls } = component;

  // Mode-specific filtering
  if (context.mode === 'chat' || context.mode === 'sideBySide') {
    // Foreground mode: exclude hidden components (they go to background job interface)
    if (hideComponent) {
      return null;
    }
  } else if (context.mode === 'backgroundJob-dashboard') {
    // Dashboard view: only agent-job-dashboard components
    if (type !== 'agent-job-dashboard' || !hideComponent) {
      return null;
    }
  } else if (context.mode === 'backgroundJob-actions') {
    // Actions panel: only background tool-call and agent-thoughts
    if (!hideComponent || !(type === 'agent-thoughts' || type === 'tool-call')) {
      return null;
    }
  }

  // System panels (config, settings, history, asset-picker) - standalone, no AgentSessionComponentWrapper
  if (type === 'config-panel' || type === 'settings-panel' || type === 'history-panel' || type === 'asset-picker-panel') {
    return resolveSystemPanel(type, context);
  }

  // Early return for thoughts visibility check
  if (type === 'agent-thoughts') {
    if (!context.includeThoughtsInResponse && context.mode !== 'backgroundJob-actions') {
      return null;
    }
  }

  // Determine rendering mode
  const isChatMode = context.mode === 'chat' || context.mode === 'backgroundJob-actions';
  const showControls = isChatMode;

  // Resolve child component based on type
  const child = resolveChild(type, role, data, isChatMode);
  if (child === null) {
    console.warn('Unknown component type:', type);
    return null;
  }

  // Wrap in AgentSessionComponentWrapper
  const wrapped = (
    <AgentSessionComponentWrapper
      componentId={id}
      componentRole={role}
      componentType={type}
      data={data}
      isStreaming={isStreaming ?? false}
      controls={controls}
      showControls={showControls}
      renderContext={context}
    >
      {child}
    </AgentSessionComponentWrapper>
  );

  // Chat mode: wrap in div for spacing
  if (isChatMode) {
    return <div key={id}>{wrapped}</div>;
  }

  return wrapped;
}

/**
 * Resolve child component based on type
 */
function resolveChild(
  type: AgentSessionComponent['type'],
  role: AgentSessionComponent['role'],
  data: AgentSessionComponent['data'],
  isChatMode: boolean
): React.ReactNode {
  switch (type) {
    case 'message':
      return <MessageBubble />;

    case 'system-call':
      return <SystemCall data={data} />;

    case 'agent-job-creation':
      return <AgentJobCreation data={data as any} />;

    case 'agent-job-dashboard':
      return <AgentJobDashboard data={data as any} />;

    case 'agent-job-summary':
      return <AgentJobSummary data={data as any} />;

    case 'agent-job-operation':
      return <AgentJobOperation data={data as any} />;

    case 'tool-call':
      return isChatMode ? (
        <div className="w-[90%]">
          <ToolCall />
        </div>
      ) : (
        <ToolCall />
      );

    case 'agent-thoughts':
      return isChatMode ? (
        <div className="w-[74%]">
          <AgentThoughts maxLines={8} />
        </div>
      ) : (
        <AgentThoughts maxLines={6} />
      );

    case 'user-feedback':
      return <UserFeedback feedback={(data.result as any)?.userFeedback || ''} />;

    default:
      return null;
  }
}

/**
 * Resolve system panel components
 * Panels are self-contained - they get uiMode from store and handle close internally
 */
function resolveSystemPanel(
  type: 'config-panel' | 'settings-panel' | 'history-panel' | 'asset-picker-panel',
  context: RenderContext
): React.ReactNode {
  let panelContent: React.ReactNode;
  switch (type) {
    case 'config-panel':
      panelContent = <AgentConfigPanel />;
      break;
    case 'settings-panel':
      panelContent = <SettingsPanel />;
      break;
    case 'history-panel':
      panelContent = <HistoryPanel />;
      break;
    case 'asset-picker-panel':
      panelContent = <AssetPickerPanel />;
      break;
  }

  // Center in chat mode, inline in side-by-side
  if (context.mode === 'chat') {
    return (
      <div className="w-full flex justify-center py-2">
        {panelContent}
      </div>
    );
  }

  return panelContent;
}

/**
 * Render system panel with text-only fallback
 * Used when system component has no specific renderer
 */
export function renderSystemFallback(content?: string): React.ReactNode {
  if (!content) return null;
  
  return (
    <div className="w-full flex justify-center py-6">
      <p className="text-sm text-muted-foreground italic">{content}</p>
    </div>
  );
}
