import { createNeonAuth } from '@neondatabase/auth/next/server'

const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET ?? process.env.BETTER_AUTH_SECRET

if (!cookieSecret || cookieSecret.length < 32) {
  throw new Error('Neon Auth requires a cookie-signing secret with at least 32 characters')
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: cookieSecret },
})
