/**
 * Home Page — Server Component
 *
 * Verifies the JWT cookie and hydrates the client with user data.
 * Renders the agent playground (with inline auth gate when not authenticated).
 */

import { AgentHome } from './AgentHome';
import { verifyToken } from '@/features/authentication/lib/cookies';

export default async function Home() {
  const payload = await verifyToken();

  const initialUser = payload
    ? { id: payload.userId, username: payload.username }
    : null;

  return <AgentHome initialUser={initialUser} />;
}
