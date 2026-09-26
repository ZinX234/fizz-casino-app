'use client'

import { useState, type FormEvent } from 'react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'

export function DepositForm({ enabled, currency }: { enabled: boolean; currency: string }) {
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !enabled) return

    if (!Number.isFinite(Number(amount)) || Number(amount) < 2) {
      setError('The minimum PayMeGate deposit is $2.00.')
      return
    }

    setError(null)
    setIsSubmitting(true)
    const checkoutWindow = window.open('about:blank', '_blank')
    if (checkoutWindow) checkoutWindow.opener = null
    try {
      const response = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || typeof result?.checkoutUrl !== 'string') {
        checkoutWindow?.close()
        setError(result?.error ?? 'Could not start checkout. Please try again later.')
        return
      }

      if (checkoutWindow) checkoutWindow.location.replace(result.checkoutUrl)
      else window.location.assign(result.checkoutUrl)
    } catch {
      checkoutWindow?.close()
      setError('Could not connect to PayMeGate. Please try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!enabled) {
    return (
      <div role="status" className="mt-5 rounded-xl border border-amber-100/10 bg-amber-100/[0.035] p-4">
        <p className="text-sm font-semibold text-white/80">Secure deposits are not configured yet.</p>
        <p className="mt-2 text-xs leading-5 text-white/55">Checkout stays disabled until the PayMeGate API key and webhook signing secret are configured on the server. Payments are credited only after a valid signed confirmation.</p>
        <p className="mt-3 text-xs text-white/45">Configure this exact HTTPS webhook URL in PayMeGate:</p>
        <p className="mt-2 break-all font-mono text-[11px] text-amber-100/65">https://v0-playfizz.vercel.app/api/webhooks/paymegate</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
      <label htmlFor="deposit-amount" className="text-xs font-semibold text-white/60">
        Deposit amount ({currency})
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="deposit-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          required
          pattern="[0-9]+(\.[0-9]{1,2})?"
          maxLength={8}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="e.g. 2.00"
          aria-describedby="deposit-help deposit-error"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-100/40 focus:ring-2 focus:ring-amber-100/10"
        />
        <button
          type="submit"
          disabled={isSubmitting || amount.trim().length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f4bc63] px-5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ArrowUpRight aria-hidden="true" className="size-4" />}
          {isSubmitting ? 'Connecting…' : 'Continue to PayMeGate'}
        </button>
      </div>
      <p id="deposit-help" className="text-xs leading-5 text-white/40">Minimum deposit $2.00; maximum $10,000.00. Your balance changes only after a verified payment webhook.</p>
      <p id="deposit-error" aria-live="polite" role={error ? 'alert' : undefined} className={error ? 'text-xs leading-5 text-rose-200' : 'sr-only'}>{error ?? ''}</p>
    </form>
  )
}

export default DepositForm
