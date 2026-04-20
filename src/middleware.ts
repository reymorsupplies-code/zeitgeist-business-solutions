/**
 * ZBS Middleware — Route Protection & Security Headers
 * - Protects all /api/ routes (except public ones)
 * - Validates JWT tokens using jose (Edge Runtime compatible)
 * - Adds user context to request headers
 * - Adds security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - Super-admin check: ONLY isSuperAdmin === true
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify',
  '/api/contact',
  '/api/health',
  // /api/db-init, /api/seed, /api/debug REMOVED — no longer public
];

// Routes that only super admins can access
const PLATFORM_ROUTES = [
  '/api/platform/',
];

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || 'https://zbs-app.vercel.app',
  'https://zeitgeist.business',
];

async function verifyTokenEdge(token: string): Promise<any | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[MIDDLEWARE] JWT_SECRET is not configured');
      return null;
    }
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Security Headers (applied to ALL responses) ───
  const responseHeaders = new Headers();

  // Content Security Policy — restrict resource loading
  responseHeaders.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "connect-src 'self' https://*.supabase.co https://api.resend.com https://api.stripe.com wss://*.supabase.co",
      "frame-src https://js.stripe.com",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // HTTP Strict Transport Security — force HTTPS for 1 year
  responseHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Prevent clickjacking
  responseHeaders.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  responseHeaders.set('X-Content-Type-Options', 'nosniff');

  // XSS Protection (legacy, but still useful)
  responseHeaders.set('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy — restrict browser features
  responseHeaders.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), interest-cohort=()'
  );

  // ─── Non-API routes: just add security headers ───
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next({
      headers: responseHeaders,
    });
  }

  // ─── Block dangerous routes entirely (db-init temporarily allowed for first deploy) ───
  if (
    pathname === '/api/seed' ||
    pathname === '/api/debug'
  ) {
    return NextResponse.json(
      { error: 'This endpoint has been disabled', code: 'ENDPOINT_DISABLED' },
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(responseHeaders),
        },
      }
    );
  }

  // ─── Allow public API routes ───
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next({
      headers: responseHeaders,
    });
  }

  // ─── JWT Authentication ───
  const authHeader = request.headers.get('authorization');
  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Also check query param for SSE/websocket compatibility
  if (!token) {
    const url = request.nextUrl;
    token = url.searchParams.get('token');
  }

  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(responseHeaders),
        },
      }
    );
  }

  const payload = await verifyTokenEdge(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or expired token', code: 'TOKEN_INVALID' },
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(responseHeaders),
        },
      }
    );
  }

  // ─── Platform route access: ONLY isSuperAdmin === true ───
  if (PLATFORM_ROUTES.some(route => pathname.startsWith(route))) {
    if (payload.isSuperAdmin !== true) {
      return NextResponse.json(
        { error: 'Super admin access required', code: 'FORBIDDEN' },
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(responseHeaders),
          },
        }
      );
    }
  }

  // ─── Add user context to headers for downstream handlers ───
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId as string);
  requestHeaders.set('x-user-email', payload.email as string);
  requestHeaders.set('x-user-role', payload.role as string);
  requestHeaders.set('x-user-is-super-admin', String(payload.isSuperAdmin === true));
  if (payload.tenantId) {
    requestHeaders.set('x-tenant-id', payload.tenantId as string);
  }
  if (payload.tenantRole) {
    requestHeaders.set('x-tenant-role', payload.tenantRole as string);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
    headers: responseHeaders,
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
