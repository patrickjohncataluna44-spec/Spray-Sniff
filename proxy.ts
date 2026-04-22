import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Get auth user from cookie or session
  // For demo purposes, we're checking localStorage which is client-side only
  // In a real app, you'd check a secure session/JWT token from cookies

  // Admin routes - these will be protected on the client side since we can't access
  // localStorage in proxy. The ProtectedRoute component handles this.
  // Proxy for admin routes would need backend auth tokens.

  // For now, allow all routes to load. Client-side ProtectedRoute component
  // will handle redirects for protected pages.

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match only page/API routes. Explicitly skip:
     * - _next/static  (JS/CSS bundles)
     * - _next/image   (image optimiser)
     * - favicon.ico
     * - sw.js         (service-worker – served from /public)
     * - public assets (images, icons, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sw\.js|.*\.(?:jpg|jpeg|png|gif|svg|webp|ico|woff2?|ttf|otf|css|js\.map)).*)',
  ],
}
