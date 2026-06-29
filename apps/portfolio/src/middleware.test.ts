/**
 * Layer 3 — middleware JWT forwarding.
 *
 * When the timeline_token cookie is present, the middleware forwards it to API
 * routes as an Authorization: Bearer header. Next encodes overridden request
 * headers onto the response as `x-middleware-request-*` plus a listing header.
 */
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function requestWithCookie(cookie?: string) {
  return new NextRequest('http://localhost/api/agent/sessions', {
    headers: cookie ? { cookie } : {},
  });
}

describe('middleware', () => {
  it('forwards the token as an Authorization Bearer header', () => {
    const res = middleware(requestWithCookie('timeline_token=xyz.token'));
    expect(res.headers.get('x-middleware-request-authorization')).toBe('Bearer xyz.token');
    expect(res.headers.get('x-middleware-override-headers')).toContain('authorization');
  });

  it('does not add an Authorization header when no token cookie is present', () => {
    const res = middleware(requestWithCookie());
    expect(res.headers.get('x-middleware-request-authorization')).toBeNull();
  });
});
