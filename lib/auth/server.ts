import { createNeonAuth } from '@neondatabase/auth/next/server'

const cookieSecret = [process.env.NEON_AUTH_COOKIE_SECRET, process.env.BETTER_AUTH_SECRET]
  .find((secret) => secret && secret.length >= 32)

// Skip validation during build
if (!cookieSecret && process.env.NODE_ENV !== 'production') {
  // During development/build, use a fallback if environment is not set
  // This allows builds to succeed without environment variables
}

const authInstance = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL ?? 'http://localhost:3000',
  cookies: {
    secret: cookieSecret ?? 'fallback-secret-for-build-only-min-32-chars-long',
    ...(process.env.NODE_ENV === 'development' ? { sameSite: 'none' as const } : {}),
  },
})

export const auth = authInstance
