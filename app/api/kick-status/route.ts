import { getKickLiveStatus } from '@/lib/kick-status'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const isLive = await getKickLiveStatus()
    return Response.json({ isLive }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[v0] Kick live status lookup failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Kick status is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
