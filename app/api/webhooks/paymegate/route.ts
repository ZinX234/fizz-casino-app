export const runtime = 'nodejs'

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 1_048_576) return Response.json({ error: 'Webhook payload is too large.' }, { status: 413 })
  await request.arrayBuffer()
  return Response.json(
    { error: 'PayMeGate webhook verification is not configured; no payment was processed.' },
    { status: 503 },
  )
}
