/**
 * Default MSW request handlers.
 *
 * These describe the "happy path" of the upstream Hono backend that the
 * Next.js route handlers proxy to (BACKEND_URL, default http://localhost:3001).
 * Individual tests override these with `server.use(...)`.
 */
import { http, HttpResponse } from 'msw';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

export const handlers = [
  http.post(`${BACKEND_URL}/auth/login`, async () => {
    return HttpResponse.json({
      token: 'test.jwt.token',
      user: { id: 'u_1', username: 'tester' },
    });
  }),
];
