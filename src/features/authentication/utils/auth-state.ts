/**
 * Authentication state management
 * Handles token storage, refresh, and session management
 */

import type { AuthTokens, UserPublic } from '../types';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'timeline_access_token',
  REFRESH_TOKEN: 'timeline_refresh_token',
  USER: 'timeline_user',
  EXPIRES_AT: 'timeline_expires_at',
};

class AuthStateManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: UserPublic | null = null;
  private expiresAt: number | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    this.accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    this.refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    const expiresAtStr = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);

    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch {
        this.user = null;
      }
    }

    if (expiresAtStr) {
      this.expiresAt = parseInt(expiresAtStr, 10);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    if (this.accessToken) {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, this.accessToken);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    }

    if (this.refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, this.refreshToken);
    } else {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }

    if (this.user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(this.user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }

    if (this.expiresAt) {
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, this.expiresAt.toString());
    } else {
      localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    }
  }

  setAuth(tokens: AuthTokens): void {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    this.user = tokens.user;
    this.expiresAt = Date.now() + tokens.expires_in * 1000;
    this.saveToStorage();
  }

  /**
   * Set user from server session (cookie-based auth)
   * Used when syncing state from server without tokens
   */
  setUserFromSession(user: UserPublic, expiresIn: number = 3600): void {
    this.user = user;
    this.expiresAt = Date.now() + expiresIn * 1000;
    // Keep tokens as null for cookie-based auth
    this.accessToken = null;
    this.refreshToken = null;
    this.saveToStorage();
  }

  clearAuth(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.expiresAt = null;
    this.saveToStorage();
  }

  isAuthenticated(): boolean {
    // Check if we have a user and valid expiry
    // (supports both token-based and cookie-based auth)
    if (!this.user || !this.expiresAt) return false;
    return Date.now() < this.expiresAt;
  }

  getAccessToken(): string | null {
    // Returns null for cookie-based auth (which is fine - cookies are sent automatically)
    return this.isAuthenticated() ? this.accessToken : null;
  }

  getUser(): UserPublic | null {
    return this.isAuthenticated() ? this.user : null;
  }

  needsRefresh(): boolean {
    if (!this.expiresAt || !this.refreshToken) return false;
    // Refresh if within 5 minutes of expiry
    return Date.now() > this.expiresAt - 5 * 60 * 1000;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }
}

// Singleton instance
export const authState = new AuthStateManager();
