import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const publicPath = pathname === '/login' || pathname.startsWith('/auth') || pathname === '/about' || pathname.startsWith('/founder')
  const isApi = pathname.startsWith('/api/')

  // API handlers own their JSON 401 responses. Page requests are redirected here.
  if (!user && !publicPath && !isApi) {
    const redirect = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie.name, cookie.value, cookie))
    return redirect
  }

  if (user && pathname === '/login') {
    const redirect = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie.name, cookie.value, cookie))
    return redirect
  }

  return response
}
