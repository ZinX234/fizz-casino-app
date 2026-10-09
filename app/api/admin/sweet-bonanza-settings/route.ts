import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { CasinoGameError, getSweetBonanzaConfiguration, updateSweetBonanzaConfiguration, getCasinoAdminAccess } from '@/lib/casino-games'
import { sanitizeSweetBonanzaConfig, type SweetBonanzaConfig } from '@/lib/sweet-bonanza-config'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  configuration: z.any(),
}).strict()

export async function POST(request: Request) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Sign in to access admin settings.' }, { status: 401 })

  const adminAccess = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!adminAccess.authorized) return Response.json({ error: 'You are not authorized to modify game settings.' }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: 'Invalid Sweet Bonanza configuration.' }, { status: 400 })

    const sanitized = sanitizeSweetBonanzaConfig(parsed.data.configuration)
    const saved = await updateSweetBonanzaConfiguration(session.user.id, sanitized)
    return Response.json({ configuration: saved })
  } catch (error) {
    if (error instanceof CasinoGameError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[admin] Sweet Bonanza settings update failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Sweet Bonanza settings could not be saved.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Sign in to access admin settings.' }, { status: 401 })

  const adminAccess = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!adminAccess.authorized) return Response.json({ error: 'You are not authorized to view game settings.' }, { status: 403 })

  try {
    const configuration = await getSweetBonanzaConfiguration()
    return Response.json({ configuration })
  } catch (error) {
    console.error('[admin] Sweet Bonanza settings fetch failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Sweet Bonanza settings could not be loaded.' }, { status: 500 })
  }
}
