import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Auth routes that authenticated users should not access
  const authRoutes = ['/login', '/signup', '/'];
  
  const hasAccessToken = request.cookies.has('access_token');
  const hasRefreshToken = request.cookies.has('refresh_token');
  
  // The user considers them authenticated if both tokens exist
  const isAuthenticated =  hasRefreshToken;

  // If trying to access login/signup while authenticated, redirect to dashboard
  if (isAuthenticated && authRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // If trying to access dashboard/protected routes while NOT authenticated, redirect to login
  const protectedRoutes = ['/dashboard'];
  if (!isAuthenticated && protectedRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to all routes except api, static files, and images
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads).*)'],
};
