/**
 * Layer 3 — login route handler.
 *
 * Exercises the real handler with the upstream backend stubbed by MSW. The
 * cookie setter is mocked because it depends on the Next request-scoped
 * `cookies()` store, which isn't present in a unit context; cookie *options*
 * are covered separately in packages/auth/src/lib/cookies.test.ts.
 */
import { NextRequest } from 'next/server';
import { http, HttpResponse } from 'msw';
import { server } from '@test/msw/server';
import { POST } from './route';
import { setTokenCookie } from '@portfolio/auth/lib/cookies';

jest.mock('@portfolio/auth/lib/cookies', () => ({
  setTokenCookie: jest.fn(),
}));

const mockedSetTokenCookie = setTokenCookie as jest.MockedFunction<typeof setTokenCookie>;

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

function loginRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => mockedSetTokenCookie.mockClear());

describe('POST /api/auth/login', () => {
  it('on success sets the token cookie and returns only the user (no token)', async () => {
    const res = await POST(loginRequest({ username: 'tester', password: 'pw' }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ user: { id: 'u_1', username: 'tester' } });
    expect(json).not.toHaveProperty('token');
    expect(mockedSetTokenCookie).toHaveBeenCalledWith('test.jwt.token');
  });

  it('maps a backend auth failure to the same status and error, without setting a cookie', async () => {
    server.use(
      http.post(`${BACKEND_URL}/auth/login`, () =>
        HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 }),
      ),
    );

    const res = await POST(loginRequest({ username: 'tester', password: 'wrong' }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid credentials' });
    expect(mockedSetTokenCookie).not.toHaveBeenCalled();
  });

  it('returns 500 when the backend is unreachable', async () => {
    server.use(
      http.post(`${BACKEND_URL}/auth/login`, () => HttpResponse.error()),
    );

    const res = await POST(loginRequest({ username: 'tester', password: 'pw' }));

    expect(res.status).toBe(500);
    expect(await res.json()).toHaveProperty('error');
    expect(mockedSetTokenCookie).not.toHaveBeenCalled();
  });
});
