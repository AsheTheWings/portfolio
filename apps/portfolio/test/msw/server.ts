/**
 * MSW server for tests — see ../../../docs/testing.md (Layer 3).
 *
 * Use in a test to override behavior per-case:
 *   server.use(http.post('http://localhost:3001/auth/login', () => ...));
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
