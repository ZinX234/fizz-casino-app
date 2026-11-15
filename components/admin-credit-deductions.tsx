'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Coins, ShieldAlert } from 'lucide-react'

type Deduction = {
  amount: string
  balance: string
  currency: string
  email: string
  playerName: string
}

export function AdminCreditDeductions() {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null)
  const idempotencyKey = useRef<string | null>(null)

  async function submitDeduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !window.confirm(`Deduct $${Number(amount).toFixed(2)} USD from ${recipientEmail}?`)) return

    setPending(true)
    setFeedback(null)
    idempotencyKey.current ??= crypto.randomUUID()

    try {
      const response = await fetch('/api/admin/credit-deductions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipientEmail, amount, reason, requestId: idempotencyKey.current }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'The wallet deduction could not be completed.')

      const deduction = payload.deduction as Deduction
      idempotencyKey.current = null
      setFeedback({
        message: `Deducted $${Number(deduction.amount).toFixed(2)} ${deduction.currency} from ${deduction.playerName} (${deduction.email}). New balance: $${Number(deduction.balance).toFixed(2)} ${deduction.currency}.`,
        error: false,
      })
      setRecipientEmail('')
      setAmount('')
      setReason('')
    } catch (cause) {
      setFeedback({ message: cause instanceof Error ? cause.message : 'The wallet deduction could not be completed.', error: true })
    } finally {
      setPending(false)
    }
  }

  function updateField(update: (value: string) => void, value: string) {
    idempotencyKey.current = null
    update(value)
  }

  return (
    <section className="mt-8 rounded-2xl border border-rose-200/15 bg-[#12141a] p-5 sm:p-6" aria-labelledby="credit-deduction-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-rose-200/15 bg-rose-100/[0.06] text-rose-100"><Coins aria-hidden="true" className="size-4" /></span>
        <div>
          <h2 id="credit-deduction-heading" className="text-base font-bold">Deduct wallet credit</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">Deduct from a player&apos;s existing USD wallet. The deduction is recorded in the append-only wallet ledger and admin audit log; a balance cannot go below zero.</p>
        </div>
      </div>
      <form onSubmit={submitDeduction} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(130px,.55fr)_minmax(0,1.4fr)_auto] lg:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deduction-recipient-email" className="text-[11px] font-semibold text-white/65">Player email</label>
          <input id="deduction-recipient-email" type="email" autoComplete="email" required maxLength={254} disabled={pending} value={recipientEmail} onChange={(event) => updateField(setRecipientEmail, event.target.value)} className="min-h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-rose-200/50" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deduction-amount" className="text-[11px] font-semibold text-white/65">Amount (USD)</label>
          <input id="deduction-amount" type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" required disabled={pending} value={amount} onChange={(event) => updateField(setAmount, event.target.value)} placeholder="25.00" className="min-h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-rose-200/50" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <label htmlFor="deduction-reason" className="text-[11px] font-semibold text-white/65">Reason for the ledger</label>
          <input id="deduction-reason" type="text" required minLength={5} maxLength={200} disabled={pending} value={reason} onChange={(event) => updateField(setReason, event.target.value)} placeholder="e.g. Duplicate credit correction" className="min-h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-rose-200/50" />
        </div>
        <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-rose-200 px-4 text-xs font-bold text-[#281012] transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60 sm:col-span-2 lg:col-span-1"><ShieldAlert aria-hidden="true" className="size-4" />{pending ? 'Deducting…' : 'Deduct credit'}</button>
      </form>
      <p className="mt-3 text-[10px] text-white/35">Limit: $1,000.00 per deduction. The player must have enough available wallet balance.</p>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-3 py-2 text-xs ${feedback.error ? 'border-rose-200/15 bg-rose-100/[0.04] text-rose-100/80' : 'border-emerald-200/15 bg-emerald-100/[0.04] text-emerald-100/80'}`}>{feedback.message}</p>}
    </section>
  )
}
