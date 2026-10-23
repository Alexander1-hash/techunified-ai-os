import { updateSession } from '@/lib/supabase/proxy'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  response.headers.set('Permissions-Policy', 'geolocation=(), browsing-topics=()')

  // Only advertise HTTPS enforcement when the incoming request is HTTPS.
  // This avoids breaking local development while protecting production sessions.
  if (request.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)
  return applySecurityHeaders(response, request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
