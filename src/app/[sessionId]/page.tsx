/**
 * Agent Session Page — Server Component
 * Dynamic route for specific session IDs: /[sessionId]
 */

import { AgentHome } from '../AgentHome';
import { verifyToken } from '@/features/authentication/lib/cookies';

export default async function AgentSessionPage() {
  const payload = await verifyToken();

  const initialUser = payload
    ? { id: payload.userId, username: payload.username }
    : null;

  return <AgentHome initialUser={initialUser} />;
}
