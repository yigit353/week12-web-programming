// Vercel Edge Middleware for the ByteBooks Vite + React frontend.
//
// 1. Inject `x-request-id: <UUIDv4>` on every response so a single page-load
//    can be correlated across CDN logs, browser DevTools, and the Railway
//    backend.
// 2. Return 401 for any /admin/* path that lacks a `bb_session` cookie. The
//    React app does not yet have an /admin route; the gate exists so any
//    future admin shell is protected by default at the edge.
//
// We use `@vercel/edge` (framework-agnostic) instead of `next/server` because
// this is plain Vite, not Next.js. The runtime hands middleware a standard
// Web `Request` — there is no `.cookies` accessor; we read the Cookie header.

import { next } from '@vercel/edge';

export const config = {
  // Run middleware on every path EXCEPT Vite's bundled assets and the static
  // files served from public/. Each excluded path saves an Edge invocation.
  matcher: '/((?!assets/|favicon\\.ico|vite\\.svg).*)',
};

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function middleware(request) {
  const url = new URL(request.url);
  const requestId = crypto.randomUUID();

  if (url.pathname.startsWith('/admin')) {
    const session = readCookie(request.headers.get('cookie'), 'bb_session');
    if (!session) {
      return new Response('unauthorized', {
        status: 401,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-request-id': requestId,
        },
      });
    }
  }

  return next({
    headers: {
      'x-request-id': requestId,
    },
  });
}
