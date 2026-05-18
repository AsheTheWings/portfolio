/**
 * Next.js middleware — API JWT forwarding.
 *
 * Page routes render their own auth gates so deep links such as `/apps/chess`
 * remain stable. API routes still receive the JWT as a Bearer token when the
 * `timeline_token` cookie is present.
 */

import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('timeline_token')?.value;
  if (!token) return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Authorization', `Bearer ${token}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/api/:path*'],
};
