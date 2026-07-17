/**
 * Agent feature exports
 * 
 * Use the provided hooks (useAgent, useSessionLifecycle, useWorkflow)
 * to interact with the agent system.
 */

export * from './types';
export { useAgent } from './hooks/useAgent';
export { useAcquiredAgentsQuery } from './hooks/useAcquiredAgentsQuery';
export { LocalMcpHttpToolProvider } from './lib/mcp-client';

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
export { useSessionLifecycle } from './hooks/useSessionLifecycle';
export { useSessionRouting } from './hooks/useSessionRouting';
export { useWorkflow } from './hooks/useWorkflow';
export { useSessionHistory } from './hooks/useSessionHistory';
export { useSessionMetadata } from './hooks/useSessionMetadata';
export { useHydrateStore } from './hooks/useHydrateStore';

// Configuration utilities
export { loadMcpConfig, saveMcpConfig, loadToolPreferences, saveToolPreferences, getDefaultMcpConfig } from './utils/mcp-config';
export { loadAgents, saveAgents, clearAgents, saveCurrentSessionId } from './utils/agent-storage';
