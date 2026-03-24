/**
 * Agent feature exports
 * 
 * Use the provided hooks (useAgent, useSessionLifecycle, useAgentCall)
 * to interact with the agent system.
 */

export * from './types';
export { AgentProvider, useAgent } from './contexts/AgentContext';
export { Session, SessionsManager, McpClient } from './core';

// UI components (can be used standalone or inline)
export { AgentPlayground } from './components/AgentPlayground';
export { ChatInterface } from './components/ChatInterface';
export { SideBySideInterface } from './components/SideBySideInterface';
export { ToolsBar } from './components/ToolsBar';
export { AgentConfigPanel } from './components/AgentConfigPanel';
export { SettingsPanel } from './components/SettingsPanel';
export { HistoryPanel } from './components/HistoryPanel';

// Store and hooks (public API for agent operations)
export { useAgentStore } from './stores/useAgentStore';
export { useSessionLifecycle } from './hooks/useSessionLifecycle';
export { useSessionRouting } from './hooks/useSessionRouting';
export { useAgentCall } from './hooks/useAgentCall';
export { useSessionHistory } from './hooks/useSessionHistory';
export { useSessionMetadata } from './hooks/useSessionMetadata';
export { useHydrateStore } from './hooks/useHydrateStore';

// Configuration utilities
export { loadMcpConfig, saveMcpConfig, loadToolPreferences, saveToolPreferences, getDefaultMcpConfig } from './utils/mcp-config';
export { loadAgentConfig, saveAgentConfig, clearAgentConfig, loadCurrentSessionId, saveCurrentSessionId } from './utils/agent-storage';
