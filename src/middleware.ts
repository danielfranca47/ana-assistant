import { NextRequest, NextResponse } from 'next/server'

const EXEMPT = ['/setup', '/settings', '/api/setup', '/_next', '/favicon.ico']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (EXEMPT.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const hasEnv =
    !!process.env.ANTHROPIC_API_KEY && !!process.env.OPENAI_API_KEY

  if (!hasEnv) {
    return NextResponse.redirect(new URL('/setup', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
