'use client';

/**
 * Theme context and provider
 * Supports dark, light, and system themes
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const COOKIE_KEY = 'portfolio_theme';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

function setCookie(key: string, value: string) {
  document.cookie = `${key}=${value};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}

function readCookie(key: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]*)`));
  return match ? match[1] : null;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    // Initialize from cookie or DOM class to match SSR
    if (typeof document !== 'undefined') {
      if (document.documentElement.classList.contains('light')) return 'light';
      if (document.documentElement.classList.contains('dark')) return 'dark';
    }
    return 'dark';
  });

  // Load the user's preference from the cookie on mount.
  useEffect(() => {
    const stored = readCookie(COOKIE_KEY) as Theme | null;
    const nextTheme: Theme = stored && ['dark', 'light', 'system'].includes(stored) ? stored : 'system';
    setThemeState(nextTheme);
    setResolvedTheme(resolveTheme(nextTheme));
    setCookie(COOKIE_KEY, nextTheme);
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    setResolvedTheme(resolveTheme(newTheme));
    setCookie(COOKIE_KEY, newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
