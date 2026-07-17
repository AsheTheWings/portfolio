import { AgentimeHttpClient } from '@agentime/client';
import type {
  ModelRegistry,
  ToolDescriptor,
  WireSessionEvent,
  WorkflowDescriptor,
} from '@agentime/protocol';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

export interface AgentServerData {
  tools: ToolDescriptor[];
  workflows: WorkflowDescriptor[];
  llmRegistry: ModelRegistry | null;
  configuredProviders: string[];
}

function serverClient(token: string): AgentimeHttpClient {
  return new AgentimeHttpClient({
    baseUrl: `${BACKEND_URL}/agent`,
    headers: { Authorization: `Bearer ${token}` },
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  });
}

export async function fetchAgentServerData(token: string): Promise<AgentServerData> {
  const client = serverClient(token);
  const empty: AgentServerData = {
    tools: [],
    workflows: [],
    llmRegistry: null,
    configuredProviders: [],
  };

  try {
    const [tools, workflows, llmRegistry, credentials] = await Promise.all([
      client.getToolCatalog(),
      client.getWorkflowCatalog(),
      client.getModelRegistry(),
      client.listCredentials(),
    ]);
    return {
      tools,
      workflows,
      llmRegistry,
      configuredProviders: credentials.map((credential) => credential.provider),
    };
  } catch (error) {
    console.error('[agent/server-data] Failed to fetch:', error instanceof Error ? error.message : String(error));
    return empty;
  }
}

export async function fetchSessionEventsSSR(
  token: string,
  sessionId: string,
): Promise<WireSessionEvent[] | null> {
  try {
    return (await serverClient(token).getSession(sessionId)).events;
  } catch (error) {
    console.error('[agent/server-data] Failed to fetch session:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
