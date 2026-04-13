/**
 * Agent feature exports
 * 
 * Use the provided hooks (useAgent, useAgentSessionLifecycle, useAgentCall)
 * to interact with the agent system.
 */

export * from './types';
export { useAgent } from './hooks/useAgent';
export { useAcquiredAgentsQuery } from './hooks/useAcquiredAgentsQuery';
export { McpClient } from './lib/mcp-client';

// UI components (can be used standalone or inline)
export { AgentPlayground } from './components/AgentPlayground';
export { ChatInterface } from './components/ChatInterface';
export { FlatInterface } from './components/FlatInterface';
export { ToolsBar } from './components/ToolsBar';
export { AgentsConfigPanel } from './components/AgentsConfigPanel';
export { SettingsPanel } from './components/SettingsPanel';
export { HistoryPanel } from './components/HistoryPanel';

// Store and hooks (public API for agent operations)
export { useAgentStore } from './stores/useAgentStore';
export { useAgentSessionLifecycle } from './hooks/useAgentSessionLifecycle';
export { useAgentSessionRouting } from './hooks/useAgentSessionRouting';
export { useAgentCall } from './hooks/useAgentCall';
export { useAgentSessionHistory } from './hooks/useAgentSessionHistory';
export { useAgentSessionMetadata } from './hooks/useAgentSessionMetadata';
export { useHydrateStore } from './hooks/useHydrateStore';

// Configuration utilities
export { loadMcpConfig, saveMcpConfig, loadToolPreferences, saveToolPreferences, getDefaultMcpConfig } from './utils/mcp-config';
export { loadAgents, saveAgents, clearAgents, saveCurrentAgentSessionId } from './utils/agent-storage';
