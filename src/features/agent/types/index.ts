/**
 * Agent domain types
 */


// Model capabilities
export enum ModelCapability {
  THINKING = 'thinking',
  VISION = 'vision',
  AUDIO = 'audio',
  VIDEO = 'video',
  IMAGE_GENERATION = 'imageGeneration',
  TOOL_CALLING = 'toolCalling',
}

// Native tool definition (Generic)
export interface NativeTool {
  id: string;
  name: string;
  provider: string;
  description?: string;
}

// Tool handler function type
export type ToolHandler = (
  args: Record<string, unknown>,
  context: { 
    agentConfig?: AgentConfig; 
    userFeedback?: unknown; 
    toolCallEventId?: string;
    metadata?: AgentMetadata;  // Read-only snapshot of turn metadata at call time
    turnId?: string;           // Turn ID from session context
    turnMetadata?: AgentMetadata;  // Turn-scoped metadata for job aggregation
  }
) => Promise<unknown>;

// MCP Tools definition
export interface Tool {
  server: string;
  tool: string; 
  description: string;
  inputSchema: Record<string, unknown>;
  source: 'builtin' | 'managed' | 'custom';
  handler?: ToolHandler;  // Built-in tools provide their own handler
}

// MCP host status (HTTP reachability of MCP host service)
export type McpHostStatus = 'notConnected' | 'connected' | 'error';

// MCP client status (status of individual MCP server connections)
export type McpClientStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'notConnected';

// MCP tool info (compact format from server)
export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// MCP server info from tools endpoint
export interface McpServerInfo {
  status: 'connected' | 'error';
  error: string | null;
  tools: McpToolInfo[];
}

// MCP server configuration
export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// MCP client configuration
export interface McpConfig {
  enabled: boolean;
  port: number;
  servers: McpServerConfig[];
}

// Workflow specification
export interface WorkflowSpec {
  id: string;           // Unique identifier
  name: string;         // Display name
  description: string;  // What the workflow does
}

// Model specification
export interface ModelSpec {
  id: string;
  provider: 'google' | 'openai' | 'anthropic' | 'fireworks';
  displayName?: string;
  name?: string; // Legacy, same as id? or internal name? keeping for compat if needed, but registry uses id/displayName
  capabilities: ModelCapability[];
  nativeTools?: NativeTool[];
  maxTokens?: number;
  supportsStreaming?: boolean;
}

// Saved agent record as returned by the REST API
export interface SavedAgent {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  avatarImage: string | null;
  color: string | null;
  agentConfig: AgentConfig;
  isPublic: boolean;
  isConfigurable: boolean;
  createdAt: string;
  updatedAt: string;
}

// Wire format for agents in events (no metadata, just config)
// This is the core agent identity: ID + execution config.
export interface Agent {
  agentId: string;        // 'none' (assistant) or saved agent UUID
  config: AgentConfig;
}

// Agent configuration (per-call settings)
export interface AgentConfig {
  // Provider and model selection
  provider: string;
  model: string;
  
  // System instructions
  systemInstructions?: string;
  
  // Streaming and output
  stream: boolean;
  maxOutputTokens?: number;
  
  // Generation parameters
  temperature: number;
  topP: number;
  
  // Native tools selection (available tools defined in ModelSpec)
  selectedNativeTools: NativeTool[];
  
  // Thinking mode
  enableThinking: boolean;
  thinkingBudget?: number;
  includeThoughtsInResponse: boolean;  // Controls Gemini API output format
  includeThoughtsInContext?: boolean;  // Controls whether thoughts are sent back to model
  
  // Iteration control
  maxModelCalls: number;
  
  // Tool configuration
  enableTools: boolean;       // Enable tool calling
  availableTools: Tool[];     // Tools selected from pool (original server/tool names)
  maxConcurrentTools: number; // Max concurrent tool executions
  
  // Workflow configuration
  enableWorkflows: boolean;   // Enable workflow orchestration
  selectedWorkflows: string[]; // IDs of active workflows
  
  // Structured output (optional, for JSON responses)
  responseSchema?: Record<string, unknown>;  // JSON schema for structured output
  responseMimeType?: string;             // e.g., 'application/json'
}

// Base interface for all native tool metadata
export interface BaseNativeToolMetadata {
  tool: string;
  callsCount: number;
}

// Generic native tool metadata (Provider-agnostic)
export interface NativeToolMetadata extends BaseNativeToolMetadata {
  provider?: string;
  data?: Record<string, unknown>; // Flexible bag for specific metadata
  [key: string]: unknown;         // Allow extensions
}

// Metadata for MCP tools
export interface McpToolMetadata {
  tool: string;
  server: string;
  callsCount: number;
  totalExecutionTime: number;
}

// Normalized usage metrics (all models should output this format)
export interface UsageMetrics {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  thinkingTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  maxTokens?: number;  // Model's max context window (from model spec)
}

// Agent metadata
export interface AgentMetadata {
  usage?: UsageMetrics;
  nativeTools?: NativeToolMetadata[];
  mcpTools?: McpToolMetadata[];
  modelCallsCount?: number;
  
  // Per-call metrics (tracked by models.ts)
  modelCallDuration?: number;        // Total API call duration
  
  // Turn-scoped aggregated metrics
  totalModelCallDuration?: number;
  totalToolsExecutionDuration?: number;
  agentTurnDuration?: number;        // Running turn duration (updated on each event)
  
  // Tool-specific metrics (in tool-result events)
  toolExecutionDuration?: number;    // Single tool execution time
}

// Feedback action button configuration
export interface FeedbackAction {
  id: string;                   // Action identifier (e.g., 'approve', 'cancel')
  label: string;                // Button text
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost';
  
  // Icon configuration
  icon?: string;                // Lucide icon name (e.g., 'Check', 'X', 'ThumbsUp')
  iconPosition?: 'left' | 'right';
  
  // Additional metadata
  description?: string;         // Tooltip or subtitle text
  shortcut?: string;            // Keyboard shortcut hint (e.g., 'Enter', 'Esc')
  
  // Visual emphasis
  primary?: boolean;            // Highlight as primary action
  dangerous?: boolean;          // Show warning state
  
  data?: unknown;                   // Optional data to include in response
}

// Session metadata (persistent identity)
export interface AgentSessionMetadata {
  sessionId?: string;
  title?: string;
  titleLocked?: boolean;
  agentName: string;
  rootSessionId?: string;  // NULL for roots, points to root for branches
}

// Tool effects (applied after tool execution)
// Tools can return effects to be processed by Session or UI
// Each key is an effect type, value is the effect data
export interface ToolEffects {
  // Session-handled effects
  appendTurnInstructions?: string;
  
  // Workflow activation (silently ignored if workflow not enabled)
  activateWorkflow?: {
    type: string;               // Workflow type ID
    data?: unknown;                 // Workflow-specific data
  };
  
  // UI-handled effects
  updateConfig?: Partial<AgentConfig>;
  sessionComponents?: (Omit<AgentSessionComponent, 'data'> & { data: AgentSessionComponent['data'] })[];
  userActions?: {
    prompt: string;
    actions: FeedbackAction[];
  };
}

// Tool result event data (generated by agent-session.ts)
export interface ToolResultData {
  server: string;
  tool: string;
  arguments?: Record<string, unknown>;
  result: unknown;           
  metadata: AgentMetadata;
}

// Tool effects event data (effects produced by tool execution)
export interface ToolEffectsData {
  server: string;
  tool: string;
  toolEffects: ToolEffects;     // Effects to apply (session + UI)
  metadata: AgentMetadata;
}

// Tool call event data (generated by call-model.ts)
export interface ToolCallData {
  server: string;
  tool: string;
  arguments?: Record<string, unknown>;
  metadata: AgentMetadata;
  thoughtSignature?: string;    // Gemini 3+ thinking signature (must be sent back)
}

// Granular event data types (generated by call-model.ts)
export interface ThoughtChunkData {
  thoughts: string;  // Incremental thought text
  metadata: AgentMetadata;  // Accumulated metadata at chunk time
}

export interface ThoughtCompletedData {
  thoughts: string;             // Complete accumulated thoughts
  metadata: AgentMetadata;
}

export interface MessageChunkData {
  message: string;  // Incremental message text
  metadata: AgentMetadata;  // Accumulated metadata at chunk time
}

export interface MessageCompletedData {
  message: string;              // Complete accumulated message
  metadata: AgentMetadata;
  libraryItemIds?: string[];    // Generated image asset IDs (for image generation models)
}

// User turn completion (generated by session.ts after building user turn)
export interface UserTurnCompletedData {
  message?: string;             // User message text
  agents: Agent[];              // Ordered agent configs for this turn ([0] = active)
  metadata: AgentMetadata;
  libraryItemIds?: string[];    // Library item IDs (assets or folders) attached to this turn
  encodedImages?: Array<{ mimeType: string; data: string }>;  // Base64 images attached to this turn
}

// Agent turn completion (generated by session.ts after orchestration)
export interface AgentTurnCompletedData {
  metadata: AgentMetadata;            // Execution metadata (usage, grounding, etc.)
}

// Branch event data (generated when creating a new session branch)
// In parent session: branchSessionId points to child
// In branch session: parentSessionId points to parent
export interface BranchEventData {
  parentSessionId?: string;     // Parent session (only in branch session)
  branchSessionId?: string;     // Child session (only in parent session)
  metadata: AgentMetadata;
}

// User feedback result event data (generated when user provides feedback)
// Links to tool-call via toolCallEventId (same as tool-call.eventId)
export interface UserFeedbackResultData {
  server: string;                                   // Tool server (e.g., 'system-call')
  tool: string;                                     // Tool name (e.g., 'update_state')
  arguments: Record<string, unknown>;                                   // Original tool arguments for display
  result: unknown;                  // User's feedback data (action, text, etc.)
  metadata: AgentMetadata;
}

// Session component types
export type AgentSessionComponentType = 
  | 'message' 
  | 'user-message'
  | 'agent-message'
  | 'agent-thoughts' 
  | 'tool-result'
  | 'tool-call' 
  | 'system-call'
  | 'user-feedback'
  // system components
  | 'config-panel' 
  | 'history-panel'
  | 'settings-panel'
  | 'asset-picker-panel';

// Session component controls (explicit button visibility)
export interface AgentSessionComponentControls {
  debug?: boolean;      // Show debug/events panel button
  edit?: boolean;       // Show edit button
  revert?: boolean;     // Show revert/branch button
  branch?: boolean;     // Show branch navigation
  translate?: boolean;  // Show translate button (message components only)
}

// Session component data — all fields explicitly declared.
// Standard fields come from event.data spreads in the mapper.
// Tool-owned fields (job, proposal, etc.) come from toolEffects.sessionComponents.
export interface AgentSessionComponentData {
  // Text content (streaming append or completion replace)
  message?: string;
  thoughts?: string;

  // Event metadata
  metadata?: AgentMetadata;
  turnId?: string;
  agentId?: string;

  // Tool identity
  server?: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  isError?: boolean;

  // Event history (append-only, deduplicated by eventId)
  sessionEvents?: AgentSessionEvent[];

  // User turn data (spread from UserTurnCompletedData)
  agents?: Agent[];
  libraryItemIds?: string[];
  encodedImages?: Array<{ mimeType: string; data: string }>;

  // Tool call data (spread from ToolCallData)
  thoughtSignature?: string;

  // Tool effects data (spread from ToolEffectsData)
  toolEffects?: ToolEffects;

  // Composite data (agent-message type in chat mode)
  items?: AgentSessionComponent[];
  hasResponse?: boolean;
}

// Session component (UI display)
export interface AgentSessionComponent {
  id: string;
  role: 'user' | 'agent' | 'system';
  type: AgentSessionComponentType;
  isStreaming?: boolean;      // True for chunk events, false/undefined otherwise
  hideComponent?: boolean;    // UI visibility: hide from foreground chat
  controls?: AgentSessionComponentControls;  // Explicit button visibility
  data: AgentSessionComponentData;
}

// UI interface mode — determines component derivation strategy
export type UIInterface = 'chat' | 'flat';

// Session event base fields
interface AgentSessionEventBase {
  eventId: string;              // Unique per event
  turnId: string;               // Turn ID - shared between user turn and all subsequent agent events
  agentId?: string;             // Which agent produced this event ('none' = assistant, UUID = saved agent)
  toolCallEventId?: string;     // Links tool-result/tool-effects/user-feedback-result to originating tool-call's eventId
  role: 'user' | 'agent' | 'system'; // Event owner role
  sequence: number;
  timestamp: Date;              // When event was created
}

// Individual typed event interfaces
export interface ModelThoughtChunkEvent extends AgentSessionEventBase {
  type: 'model-thought-chunk';
  data: ThoughtChunkData;
}

export interface ModelThoughtCompletedEvent extends AgentSessionEventBase {
  type: 'model-thought-completed';
  data: ThoughtCompletedData;
}

export interface ModelMessageChunkEvent extends AgentSessionEventBase {
  type: 'model-message-chunk';
  data: MessageChunkData;
}

export interface ModelMessageCompletedEvent extends AgentSessionEventBase {
  type: 'model-message-completed';
  data: MessageCompletedData;
}

export interface ToolCallEvent extends AgentSessionEventBase {
  type: 'tool-call';
  data: ToolCallData;
}

export interface ToolEffectsEvent extends AgentSessionEventBase {
  type: 'tool-effects';
  data: ToolEffectsData;
}

export interface ToolResultEvent extends AgentSessionEventBase {
  type: 'tool-result';
  data: ToolResultData;
}

export interface AgentTurnCompletedEvent extends AgentSessionEventBase {
  type: 'agent-turn-completed';
  data: AgentTurnCompletedData;
}

export interface UserFeedbackResultEvent extends AgentSessionEventBase {
  type: 'user-feedback-result';
  data: UserFeedbackResultData;
}

export interface UserTurnCompletedEvent extends AgentSessionEventBase {
  type: 'user-turn-completed';
  data: UserTurnCompletedData;
}

export interface BranchEvent extends AgentSessionEventBase {
  type: 'branch';
  breakpointEventId?: string;   // Links branch to the event it was created from
  data: BranchEventData;
}

// Union of all event types
export type AgentSessionEvent =
  | ModelThoughtChunkEvent
  | ModelThoughtCompletedEvent
  | ModelMessageChunkEvent
  | ModelMessageCompletedEvent
  | ToolCallEvent
  | ToolEffectsEvent
  | ToolResultEvent
  | AgentTurnCompletedEvent
  | UserFeedbackResultEvent
  | UserTurnCompletedEvent
  | BranchEvent;

// Editing state types
export type EditingData = {
  message?: string;
  arguments?: Record<string, unknown> | string; // String for JSON editing, parsed on submit
  result?: unknown; // For editing tool-call results
};

export interface EditableComponentData {
  eventId: string;
  type: 'user-message' | 'agent-message' | 'tool-call';
  fields: {
    message?: string;
    tool?: string;
    arguments?: Record<string, unknown>;
  };
}

export interface BranchRequest {
  parentSessionId: string;
  breakpointEventId: string;    // Event that triggers the branch
  modifiedData?: {              // If provided, creates edit branch; otherwise revert branch
    message?: string;
    tool?: string;
    arguments?: Record<string, unknown>;
  };
}

export interface BranchResponse {
  newSessionId: string;
  events: AgentSessionEvent[];
  metadata: AgentSessionMetadata;
}



// Default session metadata factory
export function createDefaultAgentSessionMetadata(): AgentSessionMetadata {
  return {
    agentName: 'assistant',
  };
}

// Agent Store State
export interface AgentState {
  // Current session
  currentSessionId: string | null;
  
  // Multi-agent: ordered list, [0] = front/active agent
  agents: Agent[];
  
  // Acquired agents library (owned + explicitly acquired), keyed by agent ID
  acquiredAgents: Record<string, SavedAgent>;
  
  // Internal state (prevents re-showing config panel on route changes)
  _hasShownInitialConfig: boolean;
  
  // Hydration state
  _hydrated: boolean;
  
  // UI state
  uiInterface: UIInterface;
  sessionComponents: AgentSessionComponent[];
  agentSessionEvents: AgentSessionEvent[];
  activePanels: Map<string, AgentSessionComponentType>;
  persistAgentSession: boolean;
  ephemeral: boolean;
  userMessagesHistory: string[];  // Last N user messages for input navigation (most recent first)
  
  // Tool state
  toolsPool: Tool[];
  workflowsPool: WorkflowSpec[];
  
  // Scroll state
  scrollToComponentId: string | null;
  preserveScrollOnSessionChange: boolean;
  error: string | null;
  submitTrigger: number;
  
  // Editing state
  editingEventId: string | null;
  editingData: EditingData | null;
  
  // Branching state
  showingBranchesForComponent: string | null;
  
  // Tool-based interaction state (feedback mode)
  activeFeedbackRequest: {
    toolCallEventId: string;
    userActions: Record<string, FeedbackAction[]>;
  } | null;
  
  // Translation state
  preferredTranslationLanguage: string | null;
  translationCache: Record<string, Record<string, string>>;
  activeTranslations: Record<string, string | null>;
  translatingComponents: Set<string>;
  
  // Pending library items (asset or folder IDs) for message attachment
  pendingLibraryItemIds: string[];
  
  // Conversation status
  conversationStatus: 'healthy' | 'processing' | 'thinking' | 'toolCalling' | 'responding' | 'waitingFeedback' | 'interrupted';

  // Session management
  setCurrentAgentSessionId: (sessionId: string | null) => void;
  
  // Multi-agent management
  setAgents: (agents: Agent[]) => void;
  addAgent: (agentId: string, config: AgentConfig) => void;
  removeAgent: (agentId: string) => void;
  toggleAgent: (agentId: string, config: AgentConfig) => void;
  updateFrontAgentConfig: (config: AgentConfig | ((prev: AgentConfig) => AgentConfig)) => void;
  setFrontAgent: (agentId: string) => void;  // Move agent to [0]
  
  // Acquired agents management
  setAcquiredAgents: (agents: SavedAgent[]) => void;
  getAcquiredAgent: (id: string) => SavedAgent | undefined;
  
  /** @deprecated Use agents[0].config / updateFrontAgentConfig instead */
  setAgentConfig: (config: AgentConfig | null | ((prev: AgentConfig | null) => AgentConfig | null)) => void;
  
  // Tool management
  setToolsPool: (tools: Tool[]) => void;
  setWorkflowsPool: (workflows: WorkflowSpec[]) => void;
  
  // UI component actions
  setAgentSessionComponents: (components: AgentSessionComponent[] | ((prev: AgentSessionComponent[]) => AgentSessionComponent[])) => void;
  appendEvent: (event: AgentSessionEvent) => void;
  hydrateFromEvents: (events: AgentSessionEvent[]) => void;
  clearEvents: () => void;
  markInitialConfigShown: () => void;
  removeComponent: (id: string) => void;
  upsertSystemPanel: (panelId: string, panelType: AgentSessionComponentType) => void;
  removeSystemPanel: (panelId: string) => void;
  clearSystemPanels: () => void;
  
  // Control actions
  setUiInterface: (uiInterface: UIInterface) => void;
  setPersistAgentSession: (persist: boolean) => void;
  setEphemeral: (ephemeral: boolean) => void;
  
  // User messages history actions
  setUserMessagesHistory: (history: string[]) => void;
  appendToUserMessagesHistory: (message: string) => void;
  clearUserMessagesHistory: () => void;
  
  // State actions
  setConversationStatus: (status: AgentState['conversationStatus']) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setScrollToComponentId: (componentId: string | null) => void;
  clearScrollToComponentId: () => void;
  setPreserveScrollOnSessionChange: (preserve: boolean) => void;
  triggerSubmit: () => void;
  
  // Editing actions
  startEdit: (eventId: string, initialData: string | EditingData) => void;
  updateEditingData: (data: EditingData) => void;
  cancelEdit: () => void;
  
  // Branching UI state actions
  showBranches: (componentId: string) => void;
  hideBranches: () => void;
  scrollToComponent: (componentId: string) => void;
  
  // Feedback mode actions
  setActiveFeedbackRequest: (request: { toolCallEventId: string; userActions: Record<string, FeedbackAction[]> } | null) => void;
  clearActiveFeedbackRequest: () => void;
  
  // Translation actions
  setPreferredTranslationLanguage: (language: string | null) => void;
  cacheTranslation: (componentId: string, language: string, text: string) => void;
  setActiveTranslation: (componentId: string, language: string | null) => void;
  resetAllTranslations: () => void;
  setComponentTranslating: (componentId: string, translating: boolean) => void;
  
  // Pending library items actions
  addPendingLibraryItems: (ids: string[]) => void;
  removePendingLibraryItem: (id: string) => void;
  clearPendingLibraryItems: () => void;
  
  // Reset entire store
  reset: () => void;
}
