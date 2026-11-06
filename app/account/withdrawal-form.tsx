'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'

export default function WithdrawalForm({ currency, paypalEmail }: { currency: string; paypalEmail: string | null }) {
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !paypalEmail) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/payments/withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, requestId: crypto.randomUUID() }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Your request could not be submitted.')
      setSuccess('Your request is queued for manual review. The amount is reserved while it is pending.')
      setAmount('')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Your request could not be submitted.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-4">
      {paypalEmail ? <p className="mb-3 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2 text-xs text-white/55">Payout destination: <span className="font-medium text-white/75">{paypalEmail}</span> · <Link href="/account/profile" className="font-semibold text-amber-100/75 hover:text-amber-100">Edit</Link></p> : <p className="mb-3 rounded-lg border border-amber-100/10 bg-amber-100/[0.035] p-3 text-xs leading-5 text-amber-50/75">Complete your PayPal details before requesting a withdrawal. <Link href="/account/profile" className="font-semibold underline underline-offset-2">Open profile settings</Link>.</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="withdrawal-amount" className="text-xs font-semibold text-white/60">Amount ({currency})</label>
        <input id="withdrawal-amount" type="text" inputMode="decimal" autoComplete="off" required minLength={1} maxLength={8} pattern="[0-9]+(\.[0-9]{1,2})?" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="10.00" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-100/40 focus:ring-2 focus:ring-amber-100/10" />
        <button type="submit" disabled={isSubmitting || !paypalEmail || !amount.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f4bc63] px-5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-not-allowed disabled:opacity-50">
          {isSubmitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ArrowUpRight aria-hidden="true" className="size-4" />}
          {isSubmitting ? 'Submitting…' : 'Request withdrawal'}
        </button>
        <p className="text-xs leading-5 text-white/40">Minimum $10.00. Requests reserve your balance immediately and are reviewed manually. Rejected requests return to your wallet.</p>
        <p role={error ? 'alert' : 'status'} aria-live="polite" className={error ? 'text-xs leading-5 text-rose-200' : success ? 'text-xs leading-5 text-emerald-200' : 'sr-only'}>{error ?? success ?? ''}</p>
      </form>
    </div>
  )
}
