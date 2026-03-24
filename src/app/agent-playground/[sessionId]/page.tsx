/**
 * Agent Playground Session Page - Server Component
 * Dynamic route for specific session IDs: /agent-playground/[sessionId]
 * 
 * Layout handles rendering AgentPlayground directly.
 * This page handles auth state hydration from server cookies.
 */

import { AuthHydration } from '../AuthHydration';
import { getUserData, hasAuthCookies } from '@/lib/supabase/cookies';

export default async function AgentPlaygroundSessionPage() {
  const user = await getUserData();
  const hasValidTokens = await hasAuthCookies();
  const isAuthenticated = !!user && hasValidTokens;

  return <AuthHydration initialUser={isAuthenticated ? user : null} />;
}
