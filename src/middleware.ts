/**
 * ZBS Middleware — Route Protection
 * - Protects all /api/ routes (except public ones)
 * - Validates JWT tokens
 * - Adds user context to request headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify',
  '/api/seed',
  '/api/contact',
  '/api/health',
];

// Routes that only super admins can access
const PLATFORM_ROUTES = [
  '/api/platform/',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes and static files
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for JWT token
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
      { status: 401 }
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or expired token', code: 'TOKEN_INVALID' },
      { status: 401 }
    );
  }

  // Check platform route access
  if (PLATFORM_ROUTES.some(route => pathname.startsWith(route))) {
    if (!payload.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin access required', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
  }

  // Add user context to headers for downstream handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-user-email', payload.email);
  requestHeaders.set('x-user-role', payload.role);
  requestHeaders.set('x-user-is-super-admin', String(!!payload.isSuperAdmin));
  if (payload.tenantId) {
    requestHeaders.set('x-tenant-id', payload.tenantId);
  }
  if (payload.tenantRole) {
    requestHeaders.set('x-tenant-role', payload.tenantRole);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    '/api/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
