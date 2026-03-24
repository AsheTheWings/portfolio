/**
 * Agent domain types
 */

import type { SessionsManager } from '../core/sessions-manager';
import type { AgentJobsManager } from '../core/agent-jobs-manager';


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
    componentId?: string;
    jobsManager?: AgentJobsManager;
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
  source: 'builtIn' | 'localMCPHost';
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
  id: string;           // Unique identifier (e.g., 'agentJob')
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
export interface SessionMetadata {
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
  setBackgroundMode?: { active: boolean };
  setActiveJob?: { job: { jobId: string; title: string } | null };
  appendTurnInstructions?: string;
  
  // Workflow activation (silently ignored if workflow not enabled)
  activateWorkflow?: {
    type: string;               // Workflow type ID
    data?: unknown;                 // Workflow-specific data
  };
  
  // UI-handled effects
  updateConfig?: Partial<AgentConfig>;
  sessionComponents?: (Omit<SessionComponent, 'data'> & { data: SessionComponent['data'] })[];
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
  isBackground?: boolean;       // Event was emitted in background mode
  jobId?: string;               // Associated job ID (if any)
}

// Tool effects event data (effects produced by tool execution)
export interface ToolEffectsData {
  server: string;
  tool: string;
  toolEffects: ToolEffects;     // Effects to apply (session + UI)
  metadata: AgentMetadata;
  isBackground?: boolean;       // Event was emitted in background mode
  jobId?: string;               // Associated job ID (if any)
}

// Tool call event data (generated by call-model.ts)
export interface ToolCallData {
  server: string;
  tool: string;
  arguments?: Record<string, any>;
  metadata: AgentMetadata;
  isBackground?: boolean;       // Event was emitted in background mode
  jobId?: string;               // Associated job ID (if any)
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
  agentConfig: AgentConfig;     // User's requested configuration for this turn
  metadata: AgentMetadata;
  libraryItemIds?: string[];    // Library item IDs (assets or folders) attached to this turn
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
// Links to tool-call via componentId (same as tool-call.eventId)
export interface UserFeedbackResultData {
  server: string;                                   // Tool server (e.g., 'system-call')
  tool: string;                                     // Tool name (e.g., 'update_state')
  arguments: Record<string, unknown>;                                   // Original tool arguments for display
  result: unknown;                  // User's feedback data (action, text, etc.)
  metadata: AgentMetadata;
}

// Session component types
export type SessionComponentType = 
| 'message' 
  | 'agent-thoughts' 
  | 'tool-result'
  | 'tool-call' 
  | 'system-call'
  | 'user-feedback'
  // Agent job components
  | 'agent-job-creation'
  | 'agent-job-dashboard'
  | 'agent-job-summary'
  | 'agent-job-operation'
  // system components
  | 'config-panel' 
  | 'history-panel'
  | 'settings-panel'
  | 'asset-picker-panel';

// Session component controls (explicit button visibility)
export interface SessionComponentControls {
  debug?: boolean;      // Show debug/events panel button
  edit?: boolean;       // Show edit button
  revert?: boolean;     // Show revert/branch button
  branch?: boolean;     // Show branch navigation
  translate?: boolean;  // Show translate button (message components only)
}

// Session component (UI display)
export interface SessionComponent {
  id: string;
  role: 'user' | 'agent' | 'system';
  type: SessionComponentType;
  isStreaming?: boolean;      // True for chunk events, false/undefined otherwise
  hideComponent?: boolean;    // UI visibility: hide from foreground chat
  controls?: SessionComponentControls;  // Explicit button visibility
  data: {
    message?: string;
    thoughts?: string;
    metadata?: AgentMetadata;
    turnId?: string;          // Turn ID for relating component to its origin turn
    isBackground?: boolean;
    jobId?: string;
    server?: string;
    tool?: string;
    arguments?: Record<string, unknown>;
    result?: unknown;
    error?: string;
    isError?: boolean;
    // Event history (append-only)
    sessionEvents?: SessionEvent[];
    // Accept additional fields from events
    [key: string]: unknown;
  };
}

// Render context for component resolver
export interface RenderContext {
  mode: 'chat' | 'sideBySide' | 'backgroundJob-dashboard' | 'backgroundJob-actions';
  includeThoughtsInResponse?: boolean;
}

// Session event base fields
interface SessionEventBase {
  eventId: string;              // Unique per event
  componentId: string;          // Linking ID for related events
  turnId: string;               // Turn ID - shared between user turn and all subsequent agent events
  role: 'user' | 'agent' | 'system'; // Event owner role
  sequence: number;
  timestamp: Date;              // When event was created
}

// Individual typed event interfaces
export interface ModelThoughtChunkEvent extends SessionEventBase {
  type: 'model-thought-chunk';
  data: ThoughtChunkData;
}

export interface ModelThoughtCompletedEvent extends SessionEventBase {
  type: 'model-thought-completed';
  data: ThoughtCompletedData;
}

export interface ModelMessageChunkEvent extends SessionEventBase {
  type: 'model-message-chunk';
  data: MessageChunkData;
}

export interface ModelMessageCompletedEvent extends SessionEventBase {
  type: 'model-message-completed';
  data: MessageCompletedData;
}

export interface ToolCallEvent extends SessionEventBase {
  type: 'tool-call';
  data: ToolCallData;
}

export interface ToolEffectsEvent extends SessionEventBase {
  type: 'tool-effects';
  data: ToolEffectsData;
}

export interface ToolResultEvent extends SessionEventBase {
  type: 'tool-result';
  data: ToolResultData;
}

export interface AgentTurnCompletedEvent extends SessionEventBase {
  type: 'agent-turn-completed';
  data: AgentTurnCompletedData;
}

export interface UserFeedbackResultEvent extends SessionEventBase {
  type: 'user-feedback-result';
  data: UserFeedbackResultData;
}

export interface UserTurnCompletedEvent extends SessionEventBase {
  type: 'user-turn-completed';
  data: UserTurnCompletedData;
}

export interface BranchEvent extends SessionEventBase {
  type: 'branch';
  data: BranchEventData;
}

// Union of all event types
export type SessionEvent =
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
  componentId: string;
  type: 'user-message' | 'agent-message' | 'tool-call';
  fields: {
    message?: string;
    tool?: string;
    arguments?: Record<string, unknown>;
  };
}

export interface BranchRequest {
  parentSessionId: string;
  componentId: string;          // Component that triggers the branch
  modifiedData?: {              // If provided, creates edit branch; otherwise revert branch
    message?: string;
    tool?: string;
    arguments?: Record<string, unknown>;
  };
}

export interface BranchResponse {
  newSessionId: string;
  events: SessionEvent[];
  metadata: SessionMetadata;
}



// Default session metadata factory
export function createDefaultSessionMetadata(): SessionMetadata {
  return {
    agentName: 'assistant',
  };
}

// Built-in tools registry (re-exported from tools/registry)
export { BUILT_IN_TOOLS_REGISTRY } from '../core/tools/registry';

// Agent Store State
export interface AgentState {
  // sessionsManager (singleton)
  sessionsManager: SessionsManager;
  
  // Current session
  currentSessionId: string | null;
  agentConfig: AgentConfig | null;
  
  // Internal state (prevents re-showing config panel on route changes)
  _hasShownInitialConfig: boolean;
  
  // UI state
  uiMode: 'chat' | 'side-by-side';
  sessionComponents: SessionComponent[];
  persistSession: boolean;
  ephemeral: boolean;
  userMessagesHistory: string[];  // Last N user messages for input navigation (most recent first)
  
  // Tool state
  toolsPool: Tool[];
  mcpServerStatus: Record<string, unknown>;
  mcpHostStatus: McpHostStatus;
  mcpClientStatus: McpClientStatus;
  mcpError: string | null;
  
  // Scroll state
  scrollToComponentId: string | null;
  error: string | null;
  submitTrigger: number;
  
  // Editing state
  editingComponentId: string | null;
  editingData: EditingData | null;
  
  // Branching state
  showingBranchesForComponent: string | null;
  
  // Tool-based interaction state (feedback mode)
  activeFeedbackRequest: {
    componentId: string;
    userActions: Record<string, FeedbackAction[]>;
  } | null;
  
  // Background job UI state
  selectedJobId: string | null;  // Job selected for viewing in BackgroundJobInterface
  activeJob: { jobId: string; title: string } | null;  // Currently active job context
  
  // Translation state
  preferredTranslationLanguage: string | null;  // Last used translation language for shift+click
  translationCache: Record<string, Record<string, string>>;  // componentId → language → translated text
  activeTranslations: Record<string, string | null>;  // componentId → active language (null = original)
  
  // Pending library items (asset or folder IDs) for message attachment
  pendingLibraryItemIds: string[];
  
  // Conversation status (single source of truth for all states)
  conversationStatus: 'healthy' | 'processing' | 'thinking' | 'toolCalling' | 'responding' | 'waitingFeedback' | 'hangingInput' | 'interrupted';
  abortController: AbortController | null;

  // Session management
  getCurrentSession: () => ReturnType<SessionsManager['getSession']>;
  setCurrentSessionId: (sessionId: string | null) => void;
  setAgentConfig: (config: AgentConfig | null) => void;
  
  // Tool management
  initializeToolsPool: () => Promise<void>;
  refreshToolsPool: () => Promise<void>;
  connectMcp: (config: McpConfig) => Promise<void>;
  disconnectMcp: () => Promise<void>;
  setMcpHostStatus: (status: McpHostStatus) => void;
  setMcpClientStatus: (status: McpClientStatus) => void;
  setMcpError: (mcpError: string | null) => void;
  
  // UI component actions
  setSessionComponents: (components: SessionComponent[] | ((prev: SessionComponent[]) => SessionComponent[])) => void;
  upsertComponent: (input: SessionComponent | SessionComponent[]) => void;
  clearComponents: () => void;
  markInitialConfigShown: () => void;
  removeComponent: (id: string) => void;
  removeComponentsByType: (type: SessionComponent['type']) => void;
  removeComponentsByRole: (role: SessionComponent['role']) => void;
  
  // Control actions
  setUiMode: (mode: 'chat' | 'side-by-side') => void;
  setPersistSession: (persist: boolean) => void;
  setEphemeral: (ephemeral: boolean) => void;
  
  // User messages history actions
  setUserMessagesHistory: (history: string[]) => void;
  appendToUserMessagesHistory: (message: string) => void;
  clearUserMessagesHistory: () => void;
  
  // State actions
  setConversationStatus: (status: 'healthy' | 'processing' | 'thinking' | 'toolCalling' | 'responding' | 'waitingFeedback' | 'hangingInput' | 'interrupted') => void;
  setAbortController: (abortController: AbortController | null) => void;
  stopAgent: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setScrollToComponentId: (componentId: string | null) => void;
  clearScrollToComponentId: () => void;
  triggerSubmit: () => void;
  
  // Editing actions
  startEdit: (componentId: string, initialData: string | EditingData) => void;
  updateEditingData: (data: EditingData) => void;
  cancelEdit: () => void;
  
  // Branching UI state actions
  showBranches: (componentId: string) => void;
  hideBranches: () => void;
  scrollToComponent: (componentId: string) => void;
  
  // Feedback mode actions
  submitFeedback: (feedbackData: Record<string, unknown>) => void;
  setActiveFeedbackRequest: (request: { componentId: string; userActions: Record<string, FeedbackAction[]> } | null) => void;
  
  // Background job UI actions
  selectJob: (jobId: string | null) => void;
  cancelJob: (jobId: string) => void;
  setActiveJob: (job: { jobId: string; title: string } | null) => void;
  getLastComponentByJob: () => Record<string, string>;  // jobId -> componentId
  
  // Translation actions
  setPreferredTranslationLanguage: (language: string | null) => void;
  cacheTranslation: (componentId: string, language: string, text: string) => void;
  setActiveTranslation: (componentId: string, language: string | null) => void;
  resetAllTranslations: () => void;
  
  // Pending library items actions
  addPendingLibraryItems: (ids: string[]) => void;
  removePendingLibraryItem: (id: string) => void;
  clearPendingLibraryItems: () => void;
  
  // Reset entire store
  reset: () => void;
}
