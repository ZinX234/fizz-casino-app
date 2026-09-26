'use client'

import { useState, type FormEvent } from 'react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'

export default function WithdrawalForm({ currency }: { currency: string }) {
  const [amount, setAmount] = useState('')
  const [paypalEmail, setPaypalEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/payments/withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, paypalEmail, requestId: crypto.randomUUID() }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Your request could not be submitted.')
      setSuccess('Your request is queued for manual review. The amount is reserved while it is pending.')
      setAmount('')
      setPaypalEmail('')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Your request could not be submitted.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <label htmlFor="withdrawal-amount" className="text-xs font-semibold text-white/60">Amount ({currency})</label>
      <input id="withdrawal-amount" type="text" inputMode="decimal" autoComplete="off" required minLength={1} maxLength={8} pattern="[0-9]+(\.[0-9]{1,2})?" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="10.00" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-100/40 focus:ring-2 focus:ring-amber-100/10" />
      <label htmlFor="withdrawal-paypal-email" className="text-xs font-semibold text-white/60">PayPal email</label>
      <input id="withdrawal-paypal-email" type="email" autoComplete="email" required maxLength={254} value={paypalEmail} onChange={(event) => setPaypalEmail(event.target.value)} placeholder="you@example.com" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-100/40 focus:ring-2 focus:ring-amber-100/10" />
      <button type="submit" disabled={isSubmitting || !amount.trim() || !paypalEmail.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f4bc63] px-5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-not-allowed disabled:opacity-50">
        {isSubmitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ArrowUpRight aria-hidden="true" className="size-4" />}
        {isSubmitting ? 'Submitting…' : 'Request withdrawal'}
      </button>
      <p className="text-xs leading-5 text-white/40">Minimum $10.00. Requests reserve your balance immediately and are reviewed manually. Rejected requests return to your wallet. Only mark an approved request paid after the PayPal transfer has completed.</p>
      <p role={error ? 'alert' : 'status'} aria-live="polite" className={error ? 'text-xs leading-5 text-rose-200' : success ? 'text-xs leading-5 text-emerald-200' : 'sr-only'}>{error ?? success ?? ''}</p>
    </form>
  )
}
