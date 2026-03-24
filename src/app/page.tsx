/**
 * Home Page - Server Component
 * 
 * Reads user data from HTTP-only cookie (cached, no Supabase call).
 * This enables instant rendering with correct auth state (no loading flash).
 * 
 * IMPORTANT: Validates both user data AND auth tokens exist to prevent
 * stale user data from showing when tokens have expired.
 */

import { TerminalClient } from './TerminalClient';
import { getUserData, hasAuthCookies } from '@/lib/supabase/cookies';

export default async function Home() {
  // Server-side: Read cached user data from cookie (fast!)
  const user = await getUserData();
  
  // Verify auth tokens exist (not just user data)
  // This prevents showing stale username when tokens have expired
  const hasValidTokens = await hasAuthCookies();
  
  // Only consider authenticated if BOTH user data AND tokens exist
  const isAuthenticated = !!user && hasValidTokens;

  return (
    <TerminalClient 
      initialUser={isAuthenticated ? user : null} 
      initialIsAuthenticated={isAuthenticated}
    />
  );
}
