/**
 * Timeline Home Page — Server Component
 *
 * Reads the `timeline_last_session` cookie and redirects to that session when
 * available. Otherwise it renders the authenticated agent workspace shell.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Home } from '@portfolio/timeline/components/Home';
import { getTokenCookie, verifyToken } from '@portfolio/auth/lib/cookies';
import { fetchAgentServerData } from '@portfolio/timeline/agent/lib/server-data';

const SESSION_ID_RE = /^[A-Za-z0-9_-]{16,36}$/;

/**
 * Render the Timeline home route under the Portfolio shell.
 *
 * @returns Authenticated Timeline workspace or redirects to the last session.
 */
export default async function TimelineHome() {
  const payload = await verifyToken();

  if (payload) {
    const cookieStore = await cookies();
    const lastSessionId = cookieStore.get('timeline_last_session')?.value;
    if (lastSessionId && SESSION_ID_RE.test(lastSessionId)) {
      redirect(`/apps/timeline/${lastSessionId}`);
    }
  }

  const initialUser = payload
    ? { id: payload.userId, username: payload.username }
    : null;

  const token = await getTokenCookie();
  const agentData = token
    ? await fetchAgentServerData(token)
    : { tools: [], workflows: [], llmRegistry: null, configuredProviders: [] };

  return <Home initialUser={initialUser} initialAgentData={agentData} />;
}
