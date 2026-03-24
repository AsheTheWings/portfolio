/**
 * SessionsManager - Agent Session Lifecycle Manager
 * Factory and registry for Session instances
 * 
 * Responsibilities:
 * - Create new Session instances
 * - Track active sessions in memory
 * - Load sessions from database
 * - Manage session lifecycle
 */

import { Session, type SessionOptions } from './session';
import { McpClient } from './mcp-client';
import { AgentJobsManager } from './agent-jobs-manager';
import type { SessionMetadata, AgentConfig, Tool, McpConfig, McpHostStatus, McpClientStatus, SessionEvent, EditableComponentData } from '../types';

type McpStatusChangeCallback = (hostStatus: McpHostStatus, clientStatus: McpClientStatus) => void;

/**
 * Global singleton reference to SessionsManager
 * Allows direct access to singletons from other modules
 */
let globalManager: SessionsManager | null = null;

/**
 * Export singleton getters for use in other modules (e.g., tools.ts)
 */
export function getMcpClient(): McpClient | null {
  return globalManager?.mcpClient || null;
}

export function getJobsManager(): AgentJobsManager | undefined {
  return globalManager?.jobsManager;
}

/**
 * SessionsManager class
 * Manages multiple Session instances
 * Manages tool pool and MCP client connection
 */
export class SessionsManager {
  private sessions: Map<string, Session> = new Map();
  private toolsPool: Tool[] = [];
  public mcpClient: McpClient | null = null;  // Public for global access
  private onMcpStatusChange?: McpStatusChangeCallback;
  private mcpClientGeneration: number = 0;  // Track client instances to prevent stale callbacks

  // Job state management (delegated to AgentJobsManager)
  public readonly jobsManager: AgentJobsManager;

  constructor() {
    this.jobsManager = new AgentJobsManager();
    globalManager = this as SessionsManager;  // Register as global singleton // eslint-disable-line @typescript-eslint/no-this-alias
  }

  /**
   * Create new session
   * Server generates sessionId and persists session metadata
   * Creates Session instance and tracks it in registry
   * The persist flag controls whether events are saved to database
   * (Events are always stored in memory for conversation context)
   */
  async createSession(
    metadata: Partial<SessionMetadata>,
    options: SessionOptions = { persist: true, ephemeral: false }
  ): Promise<Session> {
    // Persist session metadata (server generates and returns sessionId)
    const sessionId = await this.persistSessionMetadata(metadata);

    // Build full metadata with server-provided ID
    const fullMetadata: SessionMetadata = {
      sessionId,
      agentName: metadata.agentName || 'assistant',
      title: metadata.title,
      rootSessionId: metadata.rootSessionId,
    };

    // Create session instance with configuration
    const session = new Session(fullMetadata, options);

    // Track in registry
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get existing session
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Load session from database
   * Returns cached session if already in memory, otherwise fetches from DB
   * Fetches session + events, extracts config, creates Session, hydrates state
   * @returns { session: Session, restoredConfig: AgentConfig | undefined, events: SessionEvent[] }
   */
  async loadSession(
    sessionId: string,
    options: SessionOptions = { persist: true, ephemeral: false }
  ): Promise<{ session: Session; restoredConfig: AgentConfig | undefined; events: SessionEvent[] }> {
    // Return cached session if already in memory
    const cachedSession = this.getSession(sessionId);
    if (cachedSession) {
      return {
        session: cachedSession,
        restoredConfig: undefined, // Already loaded
        events: cachedSession.getEvents(),
      };
    }

    // Fetch from API
    const response = await fetch(`/api/agent/sessions/${sessionId}/events`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load session');
    }

    const { session: sessionData, events } = await response.json();

    // Build metadata
    const metadata: SessionMetadata = {
      sessionId: sessionData.id,
      title: sessionData.title,
      agentName: sessionData.agent_name,
      rootSessionId: sessionData.root_session_id,
    };

    // Create session instance and hydrate events
    const session = new Session(metadata, options);
    session.loadEvents(events);

    // Track in registry
    this.sessions.set(sessionId, session);

    // Extract config from last user-turn-completed event (ignore system role)
    const lastUserTurnEvent = session.getEvents().findLast(e =>
      e.type === 'user-turn-completed' && e.role !== 'system'
    );
    const restoredConfig = (lastUserTurnEvent?.data as { agentConfig?: AgentConfig })?.agentConfig;

    // Rehydrate tool handlers from current tool pool
    if (restoredConfig && restoredConfig.availableTools) {
      restoredConfig.availableTools = restoredConfig.availableTools.map((tool: Tool) => {
        const toolWithHandler = this.toolsPool.find(
          t => t.server === tool.server && t.tool === tool.tool
        );
        return toolWithHandler || tool;
      });
    }

    return { session, restoredConfig, events };
  }

  /**
   * Link parent and branch sessions with bidirectional branch events
   * Adds branch event to both sessions atomically
   * Uses modelCallIndex from branch session's last event
   */
  private linkBranchSessions(
    parentSession: Session,
    branchSession: Session,
    breakpointComponentId: string
  ): void {
    const parentSessionId = parentSession.metadata.sessionId!;
    const branchSessionId = branchSession.metadata.sessionId!;

    // Get modelCallIndex from branch session's last event
    const branchEvents = branchSession.getEvents();
    let modelCallIndex = 0;

    if (branchEvents.length > 0) {
      const lastEvent = branchEvents[branchEvents.length - 1];
      modelCallIndex = (lastEvent.data as { modelCallIndex?: number }).modelCallIndex || 0;
    }

    // Add event to branch pointing to parent
    branchSession.addBranchEvent(
      breakpointComponentId,
      parentSessionId,
      true  // isParent = true
    );

    // Add event to parent pointing to branch
    parentSession.addBranchEvent(
      breakpointComponentId,
      branchSessionId,
      false  // isParent = false
    );
  }

  /**
   * Check if modifications would actually change any data
   */
  private hasDataChanges(
    events: SessionEvent[],
    componentId: string,
    updatedData: Record<string, unknown>
  ): boolean {
    const componentEvents = events.filter(e => e.componentId === componentId);

    for (const event of componentEvents) {
      if (event.type === 'user-turn-completed' && updatedData.message !== undefined) {
        if ((event.data as { message?: string }).message !== updatedData.message) return true;
      }
      if (event.type === 'model-message-completed' && updatedData.message !== undefined) {
        if ((event.data as { message?: string }).message !== updatedData.message) return true;
      }
      if (event.type === 'tool-call' && updatedData.arguments !== undefined) {
        if (JSON.stringify((event.data as { arguments?: unknown }).arguments) !== JSON.stringify(updatedData.arguments)) return true;
      }
      if (event.type === 'tool-result' && updatedData.result !== undefined) {
        if (JSON.stringify((event.data as { result?: unknown }).result) !== JSON.stringify(updatedData.result)) return true;
      }
    }

    return false;
  }

  /**
   * Create branch from parent session at a specific component
   * Edit is implemented as: revert to component[index] + apply modifications to events
   * Returns current session if no changes detected
   * @param parentSessionId - ID of parent session
   * @param breakpointComponentId - Component to branch from
   * @param updatedData - Optional data containing fields to update (e.g., { message: '...', arguments: {...}, result: {...} })
   * @param configOverride - Optional AgentConfig to use instead of the one in user-turn-completed event
   * @returns New branched session or current session if no changes
   */
  async createBranch(
    parentSessionId: string,
    breakpointComponentId: string,
    updatedData?: Record<string, unknown>,
    configOverride?: AgentConfig
  ): Promise<Session> {
    const parentSession = this.getSession(parentSessionId);
    if (!parentSession) {
      throw new Error('Parent session not found');
    }

    // Get events from parent
    const parentEvents = parentSession.getEvents();

    // Find the breakpoint component and its sequence range
    const breakpointEvents = parentEvents.filter(e => e.componentId === breakpointComponentId);
    if (breakpointEvents.length === 0) {
      throw new Error('Breakpoint component not found in parent session');
    }

    // Check if there are actual changes
    if (updatedData && Object.keys(updatedData).length > 0) {
      if (!this.hasDataChanges(parentEvents, breakpointComponentId, updatedData)) {
        console.log('No data changes detected, returning current session');
        return parentSession;
      }
    }

    // Get the last sequence number of the breakpoint component
    // This ensures tool-call and tool-result events (same component) stay together
    const lastBreakpointSequence = Math.max(...breakpointEvents.map(e => e.sequence));

    // Copy all events up to and including the breakpoint component
    // Exclude all branch events
    let branchEvents = parentEvents.filter((e: SessionEvent) =>
      e.sequence <= lastBreakpointSequence && e.type !== 'branch'
    );

    // Apply modifications if updatedData provided
    if (updatedData && Object.keys(updatedData).length > 0) {
      branchEvents = this.applyModifications(branchEvents, breakpointComponentId, updatedData);
    }

    // Create new session with same title and lock state as parent
    // Set root_session_id during creation so trigger fires correctly
    const rootSessionId = parentSession.metadata.rootSessionId || parentSessionId;
    const sessionMetadata: Partial<SessionMetadata> = {
      title: parentSession.metadata.title || 'Untitled',
      titleLocked: parentSession.metadata.titleLocked,
      agentName: parentSession.metadata.agentName,
      rootSessionId,
    };

    const newSession = await this.createSession(sessionMetadata, parentSession.sessionOptions);

    // Load copied events with new event IDs and optional config override
    const eventsWithNewIds = branchEvents.map((e) => {
      const newEvent = {
        ...e,
        eventId: crypto.randomUUID(),
      };

      // Override agentConfig in user-turn-completed events if configOverride provided
      if (configOverride && e.type === 'user-turn-completed') {
        return {
          ...newEvent,
          data: {
            ...newEvent.data,
            agentConfig: configOverride,
          },
        };
      }

      return newEvent;
    });

    newSession.loadEvents(eventsWithNewIds as SessionEvent[]);

    // Create bidirectional branch link
    this.linkBranchSessions(parentSession, newSession, breakpointComponentId);
    return newSession;
  }

  /**
   * Apply modifications to all events for a component
   * Finds and modifies matching events based on updatedData fields
   */
  private applyModifications(
    events: SessionEvent[],
    componentId: string,
    updatedData: Record<string, unknown>
  ): SessionEvent[] {
    return events.map(event => {
      if (event.componentId !== componentId) {
        return event;
      }
      // Reuse single-event modification logic
      return this.applyModification(event, updatedData);
    }).map((event) => {
      // After all modifications, clear agent-turn-completed metadata if any message was edited
      const hasMessageEdit = updatedData.message !== undefined;
      if (hasMessageEdit && event.type === 'agent-turn-completed') {
        return {
          ...event,
          data: {
            ...event.data,
            metadata: {},  // Clear metadata since conversation flow changed
          },
        };
      }
      return event;
    });
  }

  /**
   * Apply modification to a single event (for edit operation)
   * Modifies event data based on type and returns new event
   */
  public applyModification(
    event: SessionEvent,
    modifiedData: {
      message?: string;
      arguments?: Record<string, unknown>;
      result?: unknown;
    }
  ): SessionEvent {
    const newData: Record<string, unknown> = { ...event.data };
    let modified = false;

    // Message updates (User & Model)
    if (modifiedData.message !== undefined) {
      if (event.type === 'user-turn-completed' || event.type === 'model-message-completed') {
        newData.message = modifiedData.message;
        modified = true;

        // Special handling for model messages: clear metadata
        if (event.type === 'model-message-completed') {
          newData.metadata = {};
        }
      }
    }

    // Tool arguments updates
    if (modifiedData.arguments !== undefined && event.type === 'tool-call') {
      newData.arguments = modifiedData.arguments;
      modified = true;
    }

    // Tool result updates
    if (modifiedData.result !== undefined && event.type === 'tool-result') {
      newData.result = modifiedData.result;
      modified = true;
    }

    if (modified) {
      return { ...event, data: newData } as unknown as SessionEvent;
    }

    return event;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Delete all sessions from registry
   */
  deleteAllSessions(): void {
    this.sessions.clear();
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  // ============================================================
  // Tool Pool Management
  // ============================================================

  /**
   * Initialize tool pool (load builtIn tools from registry + auto-connect MCP if enabled)
   */
  async initializeToolsPool(): Promise<void> {
    // Load builtIn tools from registry
    const { BUILT_IN_TOOLS_REGISTRY } = await import('../types');
    const builtInTools = Object.values(BUILT_IN_TOOLS_REGISTRY);

    // Start with builtIn tools
    this.toolsPool = builtInTools;

    // Auto-connect to MCP if enabled in config
    const { loadMcpConfig } = await import('../utils/mcp-config');
    const mcpConfig = loadMcpConfig();

    if (mcpConfig.enabled) {
      try {
        await this.connectMcp(mcpConfig);
      } catch (err: any) {
        // Don't throw - allow app to continue without MCP
      }
    }
  }

  /**
   * Connect to MCP host and merge MCP tools into pool
   */
  async connectMcp(config: McpConfig): Promise<void> {
    // Disconnect existing client if any
    if (this.mcpClient) {
      await this.disconnectMcp();
    }

    // Increment generation to invalidate old callbacks
    this.mcpClientGeneration++;
    const currentGeneration = this.mcpClientGeneration;

    // Create and connect new client (with guarded status change callback)
    this.mcpClient = new McpClient(config, async (hostStatus, clientStatus) => {
      // Only fire callback if this is still the current client instance
      if (currentGeneration === this.mcpClientGeneration) {
        // Only refresh tools when client reaches a final state (not intermediate states like 'connecting')
        if (clientStatus === 'connected' || clientStatus === 'idle' || clientStatus === 'error' || clientStatus === 'notConnected') {
          await this.refreshToolsPool();

          // Get current statuses after refresh (may have changed during async refresh)
          const currentHostStatus = this.mcpClient?.getHostStatus() || 'notConnected';
          const currentClientStatus = this.mcpClient?.getClientStatus() || 'notConnected';
          this.onMcpStatusChange?.(currentHostStatus, currentClientStatus);
        } else {
          // Notify store immediately for intermediate states
          this.onMcpStatusChange?.(hostStatus, clientStatus);
        }
      }
    });
    await this.mcpClient.connect();
  }

  /**
   * Disconnect from MCP host
   */
  async disconnectMcp(): Promise<void> {
    if (this.mcpClient) {
      // Stop health check before disconnect
      this.mcpClient.setEnabled(false);
      await this.mcpClient.disconnect();
      this.mcpClient = null;

      // Rebuild pool with builtIn tools only
      await this.refreshToolsPool();
    }
  }

  /**
   * Refresh tool pool (builtIn from registry + MCP if connected)
   */
  async refreshToolsPool(): Promise<void> {
    // Load builtIn tools from registry
    const { BUILT_IN_TOOLS_REGISTRY } = await import('../types');
    const builtInTools = Object.values(BUILT_IN_TOOLS_REGISTRY);

    // Merge with MCP tools if connected
    const mcpTools = this.mcpClient ? this.mcpClient.getTools() : [];

    // Check for collisions (builtIn takes precedence)
    const builtInKeys = new Set(builtInTools.map(t => `${t.server}:${t.tool}`));
    const filteredMcpTools = mcpTools.filter(t => {
      const key = `${t.server}:${t.tool}`;
      if (builtInKeys.has(key)) {
        return false;
      }
      return true;
    });

    this.toolsPool = [...builtInTools, ...filteredMcpTools];
  }

  /**
   * Get all available tools
   */
  getToolsPool(): Tool[] {
    return [...this.toolsPool];
  }

  /**
   * Get server info from MCP client
   */
  getServerInfo(): Record<string, unknown> {
    if (!this.mcpClient) {
      return {};
    }
    return this.mcpClient.getServerInfo();
  }

  /**
   * Get tool by server and tool name
   */
  getTool(server: string, tool: string): Tool | null {
    return this.toolsPool.find(t => t.server === server && t.tool === tool) || null;
  }

  /**
   * Get MCP host status (HTTP reachability)
   */
  getMcpHostStatus(): McpHostStatus {
    return this.mcpClient ? this.mcpClient.getHostStatus() : 'notConnected';
  }

  /**
   * Get MCP client status (server connections)
   */
  getMcpClientStatus(): McpClientStatus {
    return this.mcpClient ? this.mcpClient.getClientStatus() : 'idle';
  }

  /**
   * Get MCP client (for direct access if needed)
   */
  getMcpClient(): McpClient | null {
    return this.mcpClient;
  }

  /**
   * Set callback for MCP status changes
   */
  setMcpStatusChangeCallback(callback: McpStatusChangeCallback): void {
    this.onMcpStatusChange = callback;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Persist session metadata and return server-generated session ID
   * (blocking - must succeed before session creation completes)
   */
  private async persistSessionMetadata(metadata: Partial<SessionMetadata>): Promise<string> {
    const response = await fetch('/api/agent/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentName: metadata.agentName,
        title: metadata.title,
        root_session_id: metadata.rootSessionId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to persist session metadata: ${error.message || error.error}`);
    }

    const result = await response.json();
    if (!result.success || !result.sessionId) {
      throw new Error('Invalid session creation response from server');
    }

    return result.sessionId;
  }
}