'use client'

import { useState, type FormEvent } from 'react'
import { Check, Clipboard, LoaderCircle } from 'lucide-react'

export default function ManualDepositForm({ recipientEmail, currency }: { recipientEmail: string | null; currency: string }) {
  const [amount, setAmount] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [paymentEmail, setPaymentEmail] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function copyRecipient() {
    if (!recipientEmail) return
    try {
      await navigator.clipboard.writeText(recipientEmail)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Copy was blocked by the browser. Select the PayPal email and copy it manually.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !recipientEmail) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/payments/manual-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, firstName, lastName, paymentEmail, paymentReference }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Your deposit request could not be submitted.')
      setSuccess(`Request received for ${new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(payload.request.amount))}. The owner will verify the PayPal transfer before crediting your wallet.`)
      setAmount('')
      setPaymentReference('')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Your deposit request could not be submitted.')
    } finally {
      setBusy(false)
    }
  }

  if (!recipientEmail) return <p role="status" className="mt-3 rounded-lg border border-white/[0.06] bg-black/15 p-3 text-xs leading-5 text-white/45">Manual PayPal deposits are unavailable until a receiving account is configured.</p>

  return (
    <div className="mt-5 border-t border-white/[0.07] pt-5">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-white">Manual PayPal deposit</h3><p className="mt-1 text-xs leading-5 text-white/40">Send the payment first, then submit its PayPal transaction reference for manual review.</p></div><button type="button" onClick={() => void copyRecipient()} aria-label="Copy PayPal receiving email" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/60 hover:bg-white/[0.05] hover:text-white">{copied ? <Check aria-hidden="true" className="size-4" /> : <Clipboard aria-hidden="true" className="size-4" />}</button></div>
      <p className="mt-3 break-all rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 font-mono text-xs text-amber-100/80">{recipientEmail}</p>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-white/55">Amount ({currency})<input value={amount} onChange={(event) => setAmount(event.target.value)} type="text" inputMode="decimal" autoComplete="off" maxLength={8} pattern="[0-9]+(\.[0-9]{1,2})?" required placeholder="2.00" className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-100/40" /></label>
        <label className="text-xs font-semibold text-white/55">PayPal transaction reference<input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} maxLength={128} required placeholder="Transaction ID from PayPal" className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-100/40" /></label>
        <label className="text-xs font-semibold text-white/55">First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={80} required autoComplete="given-name" className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-amber-100/40" /></label>
        <label className="text-xs font-semibold text-white/55">Last name<input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={80} required autoComplete="family-name" className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-amber-100/40" /></label>
        <label className="text-xs font-semibold text-white/55 sm:col-span-2">PayPal sender email<input value={paymentEmail} onChange={(event) => setPaymentEmail(event.target.value)} type="email" maxLength={254} required autoComplete="email" className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-amber-100/40" /></label>
        <button type="submit" disabled={busy || !amount.trim() || !paymentReference.trim()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#f4bc63] px-4 text-xs font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">{busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}{busy ? 'Submitting request…' : 'Submit for manual review'}</button>
      </form>
      <p className="mt-3 text-[10px] leading-5 text-white/35">Minimum $2.00; maximum $10,000.00. Requests do not credit your wallet until an administrator verifies the matching PayPal transfer. Keep your transaction ID private.</p>
      <p role={error ? 'alert' : 'status'} aria-live="polite" className={error ? 'mt-2 text-xs text-rose-200' : success ? 'mt-2 text-xs leading-5 text-emerald-200' : 'sr-only'}>{error || success}</p>
    </div>
  )
}
