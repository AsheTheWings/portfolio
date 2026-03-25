/**
 * Server-side authentication handlers (LEGACY — Supabase)
 *
 * Still used by productivity API routes.  Will be removed once those
 * routes are migrated to the Hono backend.
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { UserPublic } from '../types';

/** @deprecated Supabase-specific — kept for productivity routes */
interface LegacyTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserPublic;
}

/** Supabase User → UserPublic mapper */
function toUserPublic(u: { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at?: string; last_sign_in_at?: string | null }): UserPublic {
  return {
    id: u.id,
    username: (u.user_metadata?.username as string) ?? '',
    email: u.email ?? null,
    fullName: (u.user_metadata?.full_name as string) ?? null,
    isActive: true,
    createdAt: u.created_at,
    lastLogin: u.last_sign_in_at ?? null,
  };
}

export class AuthHandlers {
  /**
   * Get current authenticated user (via Supabase session cookies)
   * Used by productivity routes and library SSR page.
   */
  static async getCurrentUser(): Promise<UserPublic> {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error('Unauthorized');
    }

    return toUserPublic(user);
  }

  /** @deprecated */
  static async logout(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
}
