/**
 * Next.js middleware — JWT cookie gate
 *
 * Protected routes require a `timeline_token` cookie.
 * Public routes (/, /api/auth/login, /api/auth/signup) are always accessible.
 * The cookie is forwarded automatically by Next.js rewrites to the backend.
 */

import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
]);

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Static assets, Next.js internals
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('timeline_token')?.value;
  if (!token) {
    // API routes → 401, pages → redirect to /
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Inject the JWT as an Authorization header so Next.js rewrites
  // carry auth to the backend (which only reads Bearer tokens).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Authorization', `Bearer ${token}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
