/**
 * Home Page — Server Component
 *
 * Reads the `timeline_last_session` cookie and redirects to that session
 * if present (eliminates client-side redirect flash).
 * Otherwise verifies the JWT cookie and hydrates the client with user data + agent data.
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AgentHome } from './AgentHome';
import { verifyToken, getTokenCookie } from '@/features/authentication/lib/cookies';
import { fetchAgentServerData } from '@/features/agent/lib/server-data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Home() {
  const payload = await verifyToken();

  // Redirect to last session if authenticated and cookie is present
  if (payload) {
    const cookieStore = await cookies();
    const lastSessionId = cookieStore.get('timeline_last_session')?.value;
    if (lastSessionId && UUID_RE.test(lastSessionId)) {
      redirect(`/${lastSessionId}`);
    }
  }

  const initialUser = payload
    ? { id: payload.userId, username: payload.username }
    : null;

  // Fetch tools + workflows server-side (non-blocking — returns empty on failure)
  const token = await getTokenCookie();
  const agentData = token ? await fetchAgentServerData(token) : { tools: [], workflows: [] };

  return <AgentHome initialUser={initialUser} initialTools={agentData.tools} initialWorkflows={agentData.workflows} />;
}
