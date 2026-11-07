import { auth } from '@/lib/auth/server'
import { NextRequest, NextResponse } from 'next/server'
import { consumeIpRateLimit } from '@/lib/db'
import { hasSuspiciousPath, shouldBlockUserAgent } from '@/lib/bot-protection'

const authMiddleware = auth.middleware({ loginUrl: '/auth/sign-in' })

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-forwarded-for')
    || request.headers.get('cf-connecting-ip')
  return forwarded?.split(',')[0]?.trim() || 'unknown'
}

export default async function proxy(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')
  if (shouldBlockUserAgent(userAgent) || hasSuspiciousPath(request.nextUrl)) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const method = request.method.toUpperCase()
  const pathname = request.nextUrl.pathname
  const isWebhook = pathname.startsWith('/api/webhooks/')
  const isAuth = pathname.startsWith('/api/auth/')
  const isApiMutation = pathname.startsWith('/api/') && !isWebhook && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const isApiRead = pathname.startsWith('/api/') && !isWebhook && ['GET', 'HEAD'].includes(method)
  if (!userAgent && isApiMutation && !isAuth) {
    return new NextResponse('User-Agent required', {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  if (!isWebhook && (isApiMutation || isApiRead || ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method))) {
    const ip = getClientIp(request)
    const isGameMutation = pathname.startsWith('/api/games/')
    const isSensitiveMutation = pathname.startsWith('/api/payments/')
      || pathname.startsWith('/api/admin/')
      || pathname.startsWith('/api/support/')
    const route = isAuth
      ? 'auth-api'
      : isGameMutation
        ? 'game-api'
        : isSensitiveMutation
          ? 'sensitive-api'
          : isApiMutation
            ? 'mutating-api'
            : isApiRead
              ? 'read-api'
              : 'mutating-page'
    const limits = isAuth
      ? [60, 60]
      : isGameMutation
        ? [300, 60]
        : isSensitiveMutation
          ? [30, 60]
          : isApiMutation
            ? [120, 60]
            : isApiRead
              ? [600, 60]
              : [120, 60]

    try {
      const allowed = await consumeIpRateLimit(ip, route, limits[0], limits[1])
      if (!allowed) {
        return new NextResponse('Too many requests', {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(limits[1]),
          },
        })
      }
    } catch (error) {
      console.error('[v0] IP rate limit unavailable; request allowed:', error instanceof Error ? error.message : 'unknown error')
    }
  }

  return authMiddleware(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2)).*)'],
}
