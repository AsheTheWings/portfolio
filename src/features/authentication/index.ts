/**
 * Authentication feature exports
 */

// Types
export * from './types';

// Context (legacy - will be deprecated)
export { useAuth, AuthProvider } from './contexts/AuthContext';

// Store (recommended)
export { useAuthStore } from './stores/authStore';

// Plugins
export { useAuthPlugin } from './hooks/useAuthPlugin';

// Command executor
export { authCommandExecutor } from './utils/command-executor';
