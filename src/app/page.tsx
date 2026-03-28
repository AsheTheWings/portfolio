/**
 * Home Page — Server Component
 *
 * Verifies the JWT cookie and hydrates the client with user data + agent data.
 * Renders the agent playground (with inline auth gate when not authenticated).
 */

import { AgentHome } from './AgentHome';
import { verifyToken, getTokenCookie } from '@/features/authentication/lib/cookies';
import { fetchAgentServerData } from '@/features/agent/lib/server-data';

export default async function Home() {
  const payload = await verifyToken();

  const initialUser = payload
    ? { id: payload.userId, username: payload.username }
    : null;

  // Fetch tools + workflows server-side (non-blocking — returns empty on failure)
  const token = await getTokenCookie();
  const agentData = token ? await fetchAgentServerData(token) : { tools: [], workflows: [] };

  return <AgentHome initialUser={initialUser} initialTools={agentData.tools} initialWorkflows={agentData.workflows} />;
}
