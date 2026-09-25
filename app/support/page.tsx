import { redirect } from 'next/navigation'
import { AccountNavigation, CasinoHeaderForAccount, CasinoPageHeader, EmptyDataState } from '@/components/casino-home'
import { SupportForm } from '@/components/support-form'
import { auth } from '@/lib/auth/server'
import { getSupportSnapshot } from '@/lib/casino-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Support | Fizz Casino' }

export default async function SupportPage() {
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/auth/sign-in')
  let tickets: Awaited<ReturnType<typeof getSupportSnapshot>> = []
  let dataError = false
  try {
    tickets = await getSupportSnapshot(session.user.id)
  } catch (error) {
    dataError = true
    console.error('[v0] Support tickets unavailable:', error instanceof Error ? error.message : 'unknown error')
  }

  return <div className="min-h-screen bg-[#0b0c10] text-white"><CasinoHeaderForAccount /><main className="mx-auto max-w-5xl px-5 py-9 sm:px-8 sm:py-14"><CasinoPageHeader eyebrow="Help center" title="Support" detail="Create a ticket and follow replies from the support team." /><AccountNavigation active="support" />
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><section className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-6"><h2 className="mb-5 text-sm font-bold">Open a support ticket</h2><SupportForm /></section><section className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-6"><h2 className="text-sm font-bold">Your tickets</h2><p className="mb-5 mt-1 text-xs text-white/40">Only tickets belonging to your account are shown.</p>{dataError ? <p role="alert" className="text-sm text-rose-100/75">Support data is unavailable.</p> : tickets.length ? <div className="flex flex-col gap-3">{tickets.map((ticket: any) => <article key={ticket.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">{ticket.subject}</h3><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] capitalize text-white/50">{ticket.status}</span></div><p className="mt-2 text-[11px] text-white/35">Opened {new Date(ticket.created_at).toLocaleDateString()}</p><div className="mt-4 flex flex-col gap-2">{ticket.messages.map((item: any) => <p key={item.id} className={`rounded-lg px-3 py-2 text-xs leading-5 ${item.fromSupport ? 'bg-amber-100/[0.05] text-amber-50/75' : 'bg-white/[0.04] text-white/55'}`}>{item.body}</p>)}</div></article>)}</div> : <EmptyDataState title="No support tickets yet." detail="Create a ticket if you need help." />}</section></div>
  </main></div>
}
