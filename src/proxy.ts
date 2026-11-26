import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/setup', '/unauthorized', '/forgot-password', '/reset-password']

/** Matches the path exactly or as a whole segment prefix: '/login' and '/login/x' match, '/loginfoo' does not. */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) return NextResponse.next()
  if (pathname === '/') return NextResponse.redirect(new URL('/dashboard', request.url))

  const session = request.cookies.get('tpt_session')
  if (!session) return NextResponse.redirect(new URL('/login', request.url))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
