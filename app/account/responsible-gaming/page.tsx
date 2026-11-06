'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CasinoHeaderForAccount, CasinoPageHeader, AccountNavigation } from '@/components/casino-home'
import { authClient } from '@/lib/auth/client'

export default function ResponsibleGamingPage() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [limitType, setLimitType] = useState<'deposit' | 'loss' | 'session_time'>('deposit')
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'per_session'>('week')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function saveLimit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/account/responsible-gaming', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ limitType, period, amount }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Your limit could not be saved.')
      setAmount('')
      setMessage(result.startsAt ? `Saved. This limit takes effect ${new Date(result.startsAt).toLocaleString()}.` : 'Your limit is active.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Your limit could not be saved.')
    } finally {
      setPending(false)
    }
  }

  if (isPending) return <div className="min-h-screen bg-[#0b0c10]" aria-label="Loading account" />
  if (!session?.user) return <main className="mx-auto max-w-xl px-5 py-20 text-white"><p>Please sign in to manage your limits.</p><a href="/auth/sign-in" className="mt-3 inline-block text-amber-100">Sign in</a></main>

  return <div className="min-h-screen bg-[#0b0c10] text-white"><CasinoHeaderForAccount /><main className="mx-auto max-w-4xl px-5 py-9 sm:px-8 sm:py-14"><CasinoPageHeader eyebrow="Your account" title="Responsible gaming" detail="Set a limit that works for you. Decreasing a limit takes effect now; increases are delayed for safety." /><AccountNavigation active="responsible" />
    <section className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-7"><h2 className="text-base font-bold">Set a limit</h2><p className="mt-2 text-sm leading-6 text-white/45">Limits are enforced by the server and saved to your account. They do not affect your wallet balance.</p>
      <form onSubmit={saveLimit} className="mt-6 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3"><div className="flex flex-col gap-2"><label htmlFor="limitType" className="text-xs font-semibold text-white/65">Limit type</label><select id="limitType" value={limitType} onChange={(event) => setLimitType(event.target.value as typeof limitType)} className="form-input"><option value="deposit">Deposit amount</option><option value="loss">Loss amount</option><option value="session_time">Session time (minutes)</option></select></div>
          <div className="flex flex-col gap-2"><label htmlFor="period" className="text-xs font-semibold text-white/65">Period</label><select id="period" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="form-input"><option value="day">Per day</option><option value="week">Per week</option><option value="month">Per month</option><option value="per_session">Per session</option></select></div>
          <div className="flex flex-col gap-2"><label htmlFor="amount" className="text-xs font-semibold text-white/65">{limitType === 'session_time' ? 'Minutes' : 'Amount (USD)'}</label><input id="amount" type="number" min="0.01" max="100000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required className="form-input" placeholder="Enter a limit" /></div></div>
        {message && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">{message}</p>}
        <button type="submit" disabled={pending} className="min-h-11 self-start rounded-full bg-[#f4bc63] px-5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:opacity-50">{pending ? 'Saving…' : 'Save limit'}</button>
      </form>
    </section>
    <section className="mt-6 rounded-2xl border border-emerald-100/10 bg-emerald-100/[0.025] p-5"><h2 className="text-sm font-semibold text-white">Take a break</h2><p className="mt-2 text-xs leading-5 text-white/45">Cooling-off and self-exclusion controls are not yet available. Contact support for help; do not continue playing if you need a break.</p><a href="/support" className="mt-4 inline-block text-xs font-semibold text-emerald-100/75 hover:text-emerald-100">Contact support</a></section>
  </main></div>
}
