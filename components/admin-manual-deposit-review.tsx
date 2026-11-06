'use client'

import { useState } from 'react'
import { Check, CircleX, CreditCard, LoaderCircle } from 'lucide-react'

export type ManualDepositRequest = {
  id: string
  depositId: string
  userId: string
  playerName: string
  amount: string
  currency: string
  paymentReference: string
  firstName: string
  lastName: string
  paymentEmail: string
  fizzUsername: string
  fizzEmail: string
  createdAt: string
}

export function AdminManualDepositReview({ initialRows }: { initialRows: ManualDepositRequest[] }) {
  const [rows, setRows] = useState(initialRows)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function review(requestId: string, action: 'approve' | 'reject') {
    const note = notes[requestId]?.trim() ?? ''
    if (action === 'reject' && !note) {
      setError('Add a reason before rejecting a deposit request.')
      return
    }
    setBusyId(requestId)
    setError('')
    try {
      const response = await fetch('/api/admin/manual-deposit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, note: note || undefined }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'The deposit review could not be saved.')
      setRows((current) => current.filter((row) => row.id !== requestId))
      setNotes((current) => ({ ...current, [requestId]: '' }))
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The deposit review could not be saved.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-6">
      <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035]"><CreditCard aria-hidden="true" className="size-4 text-amber-100/70" /></div><div><h2 className="text-base font-bold">Manual PayPal deposits</h2><p className="mt-1 text-xs text-white/40">Match each payment in PayPal before approving. Approval credits the wallet exactly once.</p></div></div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200/10 bg-rose-100/[0.04] p-3 text-xs text-rose-100/80">{error}</p>}
      {rows.length ? <div className="mt-5 flex flex-col gap-3">{rows.map((row) => <article key={row.id} className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-white">${Number(row.amount).toFixed(2)} <span className="text-xs font-medium text-white/40">{row.currency}</span> · {row.playerName}</p><p className="mt-1 text-xs text-white/55">PayPal sender: {row.firstName} {row.lastName} · {row.paymentEmail}</p><p className="mt-1 break-all font-mono text-[10px] text-amber-100/60">Transaction: {row.paymentReference.replace(/^manual-paypal:/, '')}</p><p className="mt-1 text-[10px] text-white/35">Fizz account: {row.fizzUsername} · {row.fizzEmail} · {new Date(row.createdAt).toLocaleString()}</p></div></div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"><label className="sr-only" htmlFor={`manual-deposit-note-${row.id}`}>Deposit review note</label><input id={`manual-deposit-note-${row.id}`} value={notes[row.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} maxLength={500} placeholder="Optional note; required to reject" className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-amber-100/30" /><button type="button" disabled={busyId === row.id} onClick={() => review(row.id, 'approve')} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-emerald-400/15 px-3 text-xs font-bold text-emerald-100 hover:bg-emerald-400/25 disabled:opacity-50">{busyId === row.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}Verify and credit</button><button type="button" disabled={busyId === row.id} onClick={() => review(row.id, 'reject')} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-rose-400/10 px-3 text-xs font-bold text-rose-100 hover:bg-rose-400/20 disabled:opacity-50"><CircleX className="size-3.5" />Reject</button></div>
      </article>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-white/45">No manual PayPal deposits are awaiting review.</p>}
    </section>
  )
}
