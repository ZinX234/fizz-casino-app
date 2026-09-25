import { redirect } from 'next/navigation'
import { Activity, CircleHelp, CreditCard, Gamepad2, LifeBuoy, Users, Wallet } from 'lucide-react'
import { CasinoHeaderForAccount } from '@/components/casino-home'
import { auth } from '@/lib/auth/server'
import { databasePool } from '@/lib/db'
import { getAdminCounts, getAdminPlayers } from '@/lib/casino-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin | Fizz Casino' }

async function hasAdminRole(userId: string) {
  const { rows } = await databasePool.query<{ authorized: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM public.user_roles ur
       JOIN public.roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.id = 'admin'
     ) AS authorized`, [userId],
  )
  return rows[0]?.authorized === true
}

export default async function AdminPage() {
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/auth/sign-in')
  if (!(await hasAdminRole(session.user.id))) {
    return <div className="min-h-screen bg-[#0b0c10] text-white"><CasinoHeaderForAccount /><main className="mx-auto max-w-3xl px-5 py-20"><div className="rounded-3xl border border-white/10 bg-[#12141a] p-8 text-center"><CircleHelp aria-hidden="true" className="mx-auto size-7 text-white/45" /><h1 className="mt-5 text-xl font-bold">Administrator access is not assigned.</h1><p className="mt-3 text-sm leading-6 text-white/45">This account does not have an administrator role in the database. Roles can only be granted through an authorized operations process.</p></div></main></div>
  }

  let counts: Awaited<ReturnType<typeof getAdminCounts>> | null = null
  let players: Awaited<ReturnType<typeof getAdminPlayers>> = []
  let failed = false
  try {
    ;[counts, players] = await Promise.all([getAdminCounts(), getAdminPlayers()])
  } catch (error) {
    failed = true
    console.error('[v0] Admin dashboard data load failed:', error instanceof Error ? error.message : 'unknown error')
  }

  const metrics = [
    { label: 'Players', value: counts?.players, icon: Users },
    { label: 'Available games', value: counts?.availableGames, icon: Gamepad2 },
    { label: 'Deposits', value: counts?.deposits, icon: CreditCard },
    { label: 'Pending withdrawals', value: counts?.pendingWithdrawals, icon: Wallet },
    { label: 'Ledger entries', value: counts?.transactions, icon: Activity },
    { label: 'Open support tickets', value: counts?.supportTickets, icon: LifeBuoy },
  ]

  return <div className="min-h-screen bg-[#0b0c10] text-white"><CasinoHeaderForAccount /><main className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-14"><p className="eyebrow">Operations</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Admin overview</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">Live database counts. No seeded users, financial activity or demo statistics.</p>
    {failed && <div role="alert" className="mt-7 rounded-xl border border-rose-200/10 bg-rose-100/[0.035] p-4 text-sm text-rose-100/75">Admin data could not be loaded from the database.</div>}
    <section aria-label="Database totals" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-white/45">{label}</p><Icon aria-hidden="true" className="size-4 text-white/35" /></div><p className="mt-4 text-3xl font-bold tabular-nums">{value ?? '—'}</p></article>)}</section>
    <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-6"><h2 className="text-base font-bold">Players</h2><p className="mt-1 text-xs text-white/40">Most recent database records. Email is only visible to administrators.</p>{players.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="text-white/35"><tr><th className="pb-3 font-medium">Player</th><th className="pb-3 font-medium">Email</th><th className="pb-3 font-medium">Status</th><th className="pb-3 text-right font-medium">Wallet</th><th className="pb-3 pl-5 font-medium">Registered</th></tr></thead><tbody>{players.map((player: any) => <tr key={player.id} className="border-t border-white/[0.06]"><td className="py-3 text-white/75">{player.name || '—'}</td><td className="py-3 text-white/45">{player.email}</td><td className="py-3 text-white/55">{player.suspended ? 'Suspended' : 'Active'}</td><td className="py-3 text-right font-semibold text-white">{player.balance === null ? 'No wallet' : new Intl.NumberFormat('en-US', { style: 'currency', currency: player.currency }).format(Number(player.balance))}</td><td className="py-3 pl-5 text-white/40">{new Date(player.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <div className="mt-5 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-white/45">{failed ? 'Player records are unavailable.' : 'No players yet.'}</div>}</section>
  </main></div>
}
