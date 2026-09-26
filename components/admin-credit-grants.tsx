'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Coins, ShieldCheck } from 'lucide-react'

export function AdminCreditGrants({ ownerEmail }: { ownerEmail: string }) {
  const [recipientEmail, setRecipientEmail] = useState(ownerEmail)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null)
  const idempotencyKey = useRef<string | null>(null)

  async function submitGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setFeedback(null)
    idempotencyKey.current ??= crypto.randomUUID()

    try {
      const response = await fetch('/api/admin/credit-grants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipientEmail, amount, reason, requestId: idempotencyKey.current }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'The wallet credit could not be granted.')

      idempotencyKey.current = null
      setFeedback({
        message: `Granted $${Number(payload.grant.amount).toFixed(2)} USD to ${payload.grant.playerName} (${payload.grant.email}). New balance: $${Number(payload.grant.balance).toFixed(2)} USD.`,
        error: false,
      })
      setAmount('')
      setReason('')
    } catch (cause) {
      setFeedback({ message: cause instanceof Error ? cause.message : 'The wallet credit could not be granted.', error: true })
    } finally {
      setPending(false)
    }
  }

  function updateRecipient(value: string) {
    idempotencyKey.current = null
    setRecipientEmail(value)
  }

  function updateAmount(value: string) {
    idempotencyKey.current = null
    setAmount(value)
  }

  function updateReason(value: string) {
    idempotencyKey.current = null
    setReason(value)
  }

  return (
    <section className="mt-8 rounded-2xl border border-amber-200/15 bg-[#12141a] p-5 sm:p-6" aria-labelledby="credit-grant-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-100/[0.06] text-amber-100"><Coins aria-hidden="true" className="size-4" /></span>
        <div>
          <h2 id="credit-grant-heading" className="text-base font-bold">Grant wallet credit</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">Credit your own wallet or another player&apos;s by email. Every grant is written to the append-only wallet ledger and admin audit log.</p>
        </div>
      </div>
      <form onSubmit={submitGrant} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(130px,.55fr)_minmax(0,1.4fr)_auto] lg:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="credit-recipient-email" className="text-[11px] font-semibold text-white/65">Player email</label>
          <input id="credit-recipient-email" type="email" autoComplete="email" required maxLength={254} disabled={pending} value={recipientEmail} onChange={(event) => updateRecipient(event.target.value)} className="min-h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-amber-200/50" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="credit-amount" className="text-[11px] font-semibold text-white/65">Amount (USD)</label>
          <input id="credit-amount" type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" required disabled={pending} value={amount} onChange={(event) => updateAmount(event.target.value)} placeholder="25.00" className="min-h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-amber-200/50" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <label htmlFor="credit-reason" className="text-[11px] font-semibold text-white/65">Reason for the ledger</label>
          <input id="credit-reason" type="text" required minLength={5} maxLength={200} disabled={pending} value={reason} onChange={(event) => updateReason(event.target.value)} placeholder="e.g. Tournament prize" className="min-h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-amber-200/50" />
        </div>
        <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-200 px-4 text-xs font-bold text-[#241b0b] transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60 sm:col-span-2 lg:col-span-1"><ShieldCheck aria-hidden="true" className="size-4" />{pending ? 'Granting…' : 'Grant credit'}</button>
      </form>
      <p className="mt-3 text-[10px] text-white/35">Limit: $1,000.00 per grant. Enter your own email to credit your wallet.</p>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-3 py-2 text-xs ${feedback.error ? 'border-rose-200/15 bg-rose-100/[0.04] text-rose-100/80' : 'border-emerald-200/15 bg-emerald-100/[0.04] text-emerald-100/80'}`}>{feedback.message}</p>}
    </section>
  )
}
