/**
 * Layer 3 (unit) — JWT cookie helpers.
 *
 * next/headers `cookies()` is request-scoped, so we substitute a stateful fake
 * cookie store. This verifies the security-relevant cookie options
 * (HttpOnly, SameSite, path, max-age) and the read/clear/has behavior.
 */
const mockStore = new Map<string, { value: string; opts?: Record<string, unknown> }>();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    set: (name: string, value: string, opts?: Record<string, unknown>) =>
      mockStore.set(name, { value, opts }),
    get: (name: string) =>
      mockStore.has(name) ? { value: mockStore.get(name)!.value } : undefined,
    delete: (name: string) => mockStore.delete(name),
  })),
}));

import {
  setTokenCookie,
  getTokenCookie,
  clearTokenCookie,
  hasTokenCookie,
  verifyToken,
} from './cookies';

const COOKIE_NAME = 'timeline_token';

beforeEach(() => mockStore.clear());

describe('setTokenCookie', () => {
  it('stores the token under the timeline_token name', async () => {
    await setTokenCookie('abc.def.ghi');
    expect(mockStore.get(COOKIE_NAME)?.value).toBe('abc.def.ghi');
  });

  it('uses secure cookie options (HttpOnly, SameSite=lax, path=/, 7-day max-age)', async () => {
    await setTokenCookie('abc.def.ghi');
    const opts = mockStore.get(COOKIE_NAME)?.opts ?? {};
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(7 * 24 * 60 * 60);
  });
});

describe('getTokenCookie / hasTokenCookie / clearTokenCookie', () => {
  it('reads back a set token', async () => {
    await setTokenCookie('tok');
    expect(await getTokenCookie()).toBe('tok');
    expect(await hasTokenCookie()).toBe(true);
  });

  it('returns null/false when no cookie is present', async () => {
    expect(await getTokenCookie()).toBeNull();
    expect(await hasTokenCookie()).toBe(false);
  });

  it('clears the cookie', async () => {
    await setTokenCookie('tok');
    await clearTokenCookie();
    expect(await getTokenCookie()).toBeNull();
    expect(await hasTokenCookie()).toBe(false);
  });
});

describe('verifyToken', () => {
  it('returns null when there is no token', async () => {
    expect(await verifyToken()).toBeNull();
  });

  it('returns null when JWT_SECRET is unset', async () => {
    const prev = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    await setTokenCookie('not-a-real-jwt');
    expect(await verifyToken()).toBeNull();
    if (prev !== undefined) process.env.JWT_SECRET = prev;
  });
});
