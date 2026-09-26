'use client'

import { useState } from 'react'
import { Check, CircleX, LoaderCircle, Wallet } from 'lucide-react'

export type AdminWithdrawal = {
  id: string
  userId: string
  playerName: string | null
  amount: string
  currency: string
  method: string
  destination: string | null
  status: string
  reviewNote: string | null
  createdAt: string
}

export function AdminWithdrawalReview({ initialRows }: { initialRows: AdminWithdrawal[] }) {
  const [rows, setRows] = useState(initialRows)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  async function review(withdrawalId: string, action: 'approve' | 'reject' | 'mark_paid') {
    const reviewNote = notes[withdrawalId]?.trim() ?? ''
    if (action === 'reject' && !reviewNote) {
      setError('Add a short reason before rejecting a request.')
      return
    }
    setBusyId(withdrawalId)
    setError('')
    try {
      const response = await fetch('/api/admin/withdrawal-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId, action, note: reviewNote || undefined }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'The review could not be saved.')
      if (action === 'reject' || action === 'mark_paid') {
        setRows((current) => current.filter((row) => row.id !== withdrawalId))
      } else {
          setRows((current) => current.map((row) => row.id === withdrawalId ? { ...row, status: 'approved', reviewNote: reviewNote || null } : row))
      }
      setNotes((current) => ({ ...current, [withdrawalId]: '' }))
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The review could not be saved.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-6">
      <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035]"><Wallet aria-hidden="true" className="size-4 text-amber-100/70" /></div><div><h2 className="text-base font-bold">Manual PayPal withdrawals</h2><p className="mt-1 text-xs text-white/40">Reserved balance, owner-reviewed. Mark paid only after completing the transfer in PayPal.</p></div></div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200/10 bg-rose-100/[0.04] p-3 text-xs text-rose-100/80">{error}</p>}
      {rows.length ? <div className="mt-5 flex flex-col gap-3">{rows.map((row) => <article key={row.id} className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-white">${Number(row.amount).toFixed(2)} <span className="text-xs font-medium text-white/40">{row.currency}</span></p><p className="mt-1 text-xs text-white/55">{row.playerName || 'Player'} · {row.destination || 'Payout email unavailable'}</p><p className="mt-1 text-[10px] text-white/35">Request {row.id} · {new Date(row.createdAt).toLocaleString()}</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold capitalize text-white/60">{row.status}</span></div>
        {row.status === 'pending' && <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"><label className="sr-only" htmlFor={`withdrawal-note-${row.id}`}>Optional withdrawal review note</label><input id={`withdrawal-note-${row.id}`} value={notes[row.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} maxLength={500} placeholder="Optional review note; required to reject" className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-amber-100/30" /><button type="button" disabled={busyId === row.id} onClick={() => review(row.id, 'approve')} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-emerald-400/15 px-3 text-xs font-bold text-emerald-100 hover:bg-emerald-400/25 disabled:opacity-50">{busyId === row.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}Approve</button><button type="button" disabled={busyId === row.id} onClick={() => review(row.id, 'reject')} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-rose-400/10 px-3 text-xs font-bold text-rose-100 hover:bg-rose-400/20 disabled:opacity-50"><CircleX className="size-3.5" />Reject and refund</button></div>}
        {['approved', 'processing'].includes(row.status) && <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"><label className="sr-only" htmlFor={`withdrawal-note-${row.id}`}>Optional withdrawal review note</label><input id={`withdrawal-note-${row.id}`} value={notes[row.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} maxLength={500} placeholder="Optional review note" className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-amber-100/30" /><button type="button" disabled={busyId === row.id} onClick={() => review(row.id, 'mark_paid')} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-amber-100/15 px-3 text-xs font-bold text-amber-100 hover:bg-amber-100/25 disabled:opacity-50">{busyId === row.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}Mark paid</button><button type="button" disabled={busyId === row.id} onClick={() => review(row.id, 'reject')} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-rose-400/10 px-3 text-xs font-bold text-rose-100 hover:bg-rose-400/20 disabled:opacity-50"><CircleX className="size-3.5" />Reject and refund</button></div>}
      </article>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-white/45">No withdrawals are awaiting review.</p>}
    </section>
  )
}
