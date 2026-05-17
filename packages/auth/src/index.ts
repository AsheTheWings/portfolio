/**
 * Authentication feature exports
 */

// Types
export * from './types';

// Context
export { useAuth, AuthProvider } from './contexts/AuthContext';

// Store
export { useAuthStore } from './stores/authStore';

// Components
export { AuthGate } from './components/AuthGate';

// Client-side API
export { logoutUser } from './lib/auth-client';

// Server-side cookie helpers (only import in server components / route handlers)
export {
  setTokenCookie,
  getTokenCookie,
  clearTokenCookie,
  verifyToken,
  hasTokenCookie,
} from './lib/cookies';
