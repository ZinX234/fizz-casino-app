import { CasinoHome } from '@/components/casino-home'
import { auth } from '@/lib/auth/server'
import { getAvailableGames, getLivePromotions, getWalletSnapshot, type GameRecord } from '@/lib/casino-data'
import { databasePool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { data: session } = await auth.getSession()
  let games: GameRecord[] = []
  let promotions: Awaited<ReturnType<typeof getLivePromotions>> = []
  let dataError = false

  try {
    ;[games, promotions] = await Promise.all([getAvailableGames(), getLivePromotions()])
  } catch (error) {
    dataError = true
    console.error('[v0] Casino home data load failed:', error instanceof Error ? error.message : 'unknown error')
  }

  let currentPlayer: { id: string; name: string; email: string; balance: string | null; currency: string | null } | null = null
  let vipLevel: string | null = null
  if (session?.user) {
    currentPlayer = {
      id: session.user.id,
      name: session.user.name || '',
      email: session.user.email || '',
      balance: null,
      currency: null,
    }
    try {
      const [wallet, vip] = await Promise.all([
        getWalletSnapshot(session.user.id),
        databasePool.query<{ name: string | null }>(
          `SELECT vl.name FROM public.vip_memberships vm
           LEFT JOIN public.vip_levels vl ON vl.id = vm.vip_level_id
           WHERE vm.user_id = $1`, [session.user.id],
        ),
      ])
      currentPlayer.balance = wallet?.balance ?? null
      currentPlayer.currency = wallet?.currency ?? null
      vipLevel = vip.rows[0]?.name ?? null
    } catch (error) {
      console.error('[v0] Player summary load failed:', error instanceof Error ? error.message : 'unknown error')
    }
  }

  return <CasinoHome games={games} promotions={promotions} currentPlayer={currentPlayer} vipLevel={vipLevel} dataError={dataError} />
}
