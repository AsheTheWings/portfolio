'use client';

/**
 * Authentication command executor
 * Handles: login, signup, logout, whoami
 * 
 * Note: Uses HTTP-only cookies for persistence (server-side).
 * Returns user data in result.data for reactive UI updates.
 */

import type { ParsedCommand, CommandResult, CommandExecutor, CommandContext } from '@/features/terminal/types';
import { textOutput } from '@/features/terminal/types';
import { httpClient } from '@/features/shared/utils/http-client';
import { useAuthStore } from '../stores/authStore';
import type { UserPublic } from '../types';

const AUTH_COMMANDS = ['login', 'signup', 'logout', 'whoami'];

export class AuthCommandExecutor implements CommandExecutor {
  canHandle(command: string, entity?: string): boolean {
    return AUTH_COMMANDS.includes(command);
  }

  async execute(
    parsed: ParsedCommand, 
    timestamp: Date,
    context?: CommandContext
  ): Promise<CommandResult> {
    switch (parsed.command) {
      case 'login':
        return await this.login(parsed, timestamp, context);
      
      case 'signup':
        return await this.signup(parsed, timestamp, context);
      
      case 'logout':
        return await this.logout(timestamp, context);
      
      case 'whoami':
        return await this.whoami(timestamp, context);
      
      default:
        return {
          success: false,
          output: textOutput(`Unknown auth command: ${parsed.command}`),
          timestamp,
        };
    }
  }

  private async login(parsed: ParsedCommand, timestamp: Date, context?: CommandContext): Promise<CommandResult> {
    const [emailOrUsername, password] = parsed.args;
    
    if (!emailOrUsername || !password) {
      return {
        success: false,
        output: textOutput('Usage: login <email/username> <password>'),
        timestamp,
      };
    }

    try {
      // API sets HTTP-only cookies and returns only user data
      const response = await httpClient.post<{ user: UserPublic }>('/auth/login', { 
        email: emailOrUsername,
        password 
      });
      
      // Update auth store
      useAuthStore.getState().setUser(response.user);
      
      return {
        success: true,
        output: textOutput(`✓ Logged in as ${response.user.username || response.user.email}`),
        timestamp,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Handle "already logged in" error
      if (errorMessage.toLowerCase().includes('already logged in')) {
        return {
          success: false,
          output: textOutput('Already logged in. Use "logout" first.'),
          timestamp,
        };
      }
      
      return {
        success: false,
        output: textOutput(`Login failed: ${errorMessage}`),
        timestamp,
      };
    }
  }

  private async signup(parsed: ParsedCommand, timestamp: Date, context?: CommandContext): Promise<CommandResult> {
    const [username, password] = parsed.args;
    const email = parsed.flags.email as string | undefined;
    
    if (!username || !password) {
      return {
        success: false,
        output: textOutput('Usage: signup <username> <password> [--email <email>]'),
        timestamp,
      };
    }

    try {
      // API sets HTTP-only cookies and returns only user data
      const response = await httpClient.post<{ user: UserPublic }>('/auth/signup', {
        username,
        password,
        ...(email && { email }),
      });
      
      // Update auth store
      useAuthStore.getState().setUser(response.user);
      
      return {
        success: true,
        output: textOutput(`✓ Account created and logged in as ${response.user.username || response.user.email}`),
        timestamp,
      };
    } catch (error: unknown) {
      return {
        success: false,
        output: textOutput(`Signup failed: ${error instanceof Error ? error.message : 'Unknown error'}`),
        timestamp,
      };
    }
  }

  private async logout(timestamp: Date, context?: CommandContext): Promise<CommandResult> {
    try {
      // Call server logout (clears cookies)
      await httpClient.post('/auth/logout');
      
      // Update auth store
      useAuthStore.getState().logout();
      
      return {
        success: true,
        output: textOutput('✓ Logged out successfully'),
        timestamp,
      };
    } catch (_error: unknown) {
      // Logout even on error (user might already be logged out)
      useAuthStore.getState().logout();
      
      return {
        success: true,
        output: textOutput('✓ Logged out'),
        timestamp,
      };
    }
  }

  private async whoami(timestamp: Date, context?: CommandContext): Promise<CommandResult> {
    try {
      // Fetch current user from server (source of truth via HTTP-only cookies)
      const user = await httpClient.get<UserPublic>('/auth/me');

      const info = `
User: ${user.username || 'N/A'}
Email: ${user.email || 'N/A'}
ID: ${user.id}
Status: ${user.is_active ? 'Active' : 'Inactive'}
      `.trim();

      // Update auth store
      useAuthStore.getState().setUser(user);
      
      return {
        success: true,
        output: textOutput(info),
        timestamp,
      };
    } catch (_error: unknown) {
      return {
        success: false,
        output: textOutput('Not authenticated'),
        timestamp,
      };
    }
  }
}

// Export singleton instance
export const authCommandExecutor = new AuthCommandExecutor();
