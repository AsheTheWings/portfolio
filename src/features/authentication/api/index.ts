/**
 * Server-side authentication handlers
 * Contains the actual implementation called by API routes
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import type {
  UserSignup,
  UserLogin,
  TokenResponse,
  UserPublic,
  RefreshTokenRequest,
} from '../types';

export class AuthHandlers {
  /**
   * Handle user signup
   */
  static async signup(data: UserSignup): Promise<TokenResponse> {
    const { password, username, full_name } = data;
    const email = data.email || `${username}@ashewindow.dev`;

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const admin = createAdminClient();

    // Create user via admin API — auto-confirms email, bypasses verification
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name },
    });

    if (createError) {
      throw new Error(createError.message);
    }

    // Insert into public.users table (linked to auth.users via same ID)
    const { error: profileError } = await admin
      .from('users')
      .insert({
        id: newUser.user.id,
        username,
        email,
        full_name: full_name || null,
        hashed_password: 'managed_by_supabase_auth',
        is_active: true,
        is_superuser: false,
      });

    if (profileError) {
      // Rollback auth user if profile creation fails
      await admin.auth.admin.deleteUser(newUser.user.id);
      throw new Error(profileError.message);
    }

    // Sign in immediately to obtain a session
    const supabase = await createClient();
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !authData.session) {
      throw new Error('Account created but sign-in failed. Try logging in.');
    }

    return {
      access_token: authData.session.access_token,
      token_type: 'bearer',
      expires_in: authData.session.expires_in || 3600,
      refresh_token: authData.session.refresh_token,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        username,
        full_name,
        is_active: true,
        created_at: newUser.user.created_at,
      },
    };
  }

  /**
   * Handle user login
   * Supports both email and username
   */
  static async login(data: UserLogin): Promise<TokenResponse> {
    let { email } = data;
    const { password } = data;

    // Validation
    if (!email || !password) {
      throw new Error('Email/username and password are required');
    }

    const supabase = await createClient();

    // Check if input is email or username
    const isEmail = email.includes('@');
    
    if (!isEmail) {
      // Input is username - need to find the email from users table
      const { data: user, error: lookupError } = await supabase
        .from('users')
        .select('email')
        .eq('username', email)
        .single();

      if (lookupError || !user || !user.email) {
        throw new Error('Invalid username or password');
      }

      email = user.email;
    }

    // Sign in with Supabase using email
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(`Invalid ${isEmail ? 'email' : 'username'} or password`);
    }

    if (!authData.user || !authData.session) {
      throw new Error('Login failed');
    }

    // Format response to match TokenResponse
    return {
      access_token: authData.session.access_token,
      token_type: 'bearer',
      expires_in: authData.session.expires_in || 3600,
      refresh_token: authData.session.refresh_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: authData.user.user_metadata?.username,
        full_name: authData.user.user_metadata?.full_name,
        is_active: true,
        created_at: authData.user.created_at,
        last_login: authData.user.last_sign_in_at,
      },
    };
  }

  /**
   * Handle user logout
   */
  static async logout(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  /**
   * Get current authenticated user
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

    return {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username,
      full_name: user.user_metadata?.full_name,
      is_active: true,
      created_at: user.created_at,
      last_login: user.last_sign_in_at,
    };
  }

  /**
   * Refresh access token
   */
  static async refreshToken(data: RefreshTokenRequest): Promise<TokenResponse> {
    const { refresh_token } = data;

    if (!refresh_token) {
      throw new Error('Refresh token is required');
    }

    const supabase = await createClient();

    const { data: authData, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error || !authData.session || !authData.user) {
      throw new Error('Invalid or expired refresh token');
    }

    return {
      access_token: authData.session.access_token,
      token_type: 'bearer',
      expires_in: authData.session.expires_in || 3600,
      refresh_token: authData.session.refresh_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: authData.user.user_metadata?.username,
        full_name: authData.user.user_metadata?.full_name,
        is_active: true,
        created_at: authData.user.created_at,
        last_login: authData.user.last_sign_in_at,
      },
    };
  }
}
