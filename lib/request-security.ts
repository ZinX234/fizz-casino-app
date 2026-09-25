export function isAllowedRequestOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  let normalizedOrigin: string
  try {
    normalizedOrigin = new URL(origin).origin
  } catch {
    return false
  }

  const allowedOrigins = new Set<string>()
  const addOrigin = (value: string | undefined) => {
    if (!value) return
    try {
      allowedOrigins.add(new URL(value.includes('://') ? value : `https://${value}`).origin)
    } catch {
      return
    }
  }

  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.add('http://localhost:3000')
    for (const value of [process.env.V0_RUNTIME_URL, process.env.V0_DEV_APP_URL, process.env.V0_BUILD_URL, process.env.V0_SANDBOX_URL]) {
      addOrigin(value)
    }
  } else {
    addOrigin(new URL(request.url).origin)
    addOrigin(process.env.VERCEL_URL)
    addOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  }

  return allowedOrigins.has(normalizedOrigin)
}
