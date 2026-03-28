/**
 * Agent Session Page — Server Component
 * Dynamic route for specific session IDs: /[sessionId]
 */

import { AgentHome } from '../AgentHome';
import { verifyToken, getTokenCookie } from '@/features/authentication/lib/cookies';
import { fetchAgentServerData } from '@/features/agent/lib/server-data';

export default async function AgentSessionPage() {
  const payload = await verifyToken();

  const initialUser = payload
    ? { id: payload.userId, username: payload.username }
    : null;

  const token = await getTokenCookie();
  const agentData = token ? await fetchAgentServerData(token) : { tools: [], workflows: [] };

  return <AgentHome initialUser={initialUser} initialTools={agentData.tools} initialWorkflows={agentData.workflows} />;
}
