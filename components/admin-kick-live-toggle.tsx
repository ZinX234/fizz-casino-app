'use client'

import { useState } from 'react'
import { Radio } from 'lucide-react'

export function AdminKickLiveToggle({ initialIsLive }: { initialIsLive: boolean }) {
  const [isLive, setIsLive] = useState(initialIsLive)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function updateStatus(nextIsLive: boolean) {
    setSaving(true)
    setMessage(null)
    setError(false)

    try {
      const response = await fetch('/api/admin/kick-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isLive: nextIsLive }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Kick status could not be saved.')

      setIsLive(result.isLive === true)
      setMessage(result.isLive ? 'Your lobby now shows you live on Kick.' : 'Your lobby now shows you are offline.')
    } catch (cause) {
      setError(true)
      setMessage(cause instanceof Error ? cause.message : 'Kick status could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-[#53fc18]/15 bg-[#12141a] p-5 sm:p-6" aria-labelledby="kick-status-heading">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#53fc18]/15 bg-[#53fc18]/[0.06] text-[#8aff65]"><Radio aria-hidden="true" className="size-4" /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8aff65]">Kick channel</p>
            <h2 id="kick-status-heading" className="mt-1 text-base font-bold">Livestream status</h2>
            <p className="mt-1 text-sm text-white/45">Control the status shown beside your Kick link in the casino lobby. This does not detect or start a stream.</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3 sm:min-w-64">
          <div>
            <p className={`text-sm font-bold ${isLive ? 'text-[#8aff65]' : 'text-white/75'}`}>{isLive ? 'Live on Kick' : 'Not live'}</p>
            <p className="mt-0.5 text-[11px] text-white/40">{isLive ? 'Visitors will see you are live.' : 'Visitors will see you are offline.'}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isLive}
            aria-label="Show my Kick channel as live"
            disabled={saving}
            onClick={() => void updateStatus(!isLive)}
            className={`relative inline-flex h-7 w-[50px] shrink-0 items-center rounded-full border transition disabled:cursor-wait disabled:opacity-60 ${isLive ? 'border-[#53fc18]/70 bg-[#53fc18]' : 'border-white/15 bg-white/10'}`}
          >
            <span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${isLive ? 'translate-x-[26px]' : 'translate-x-1'}`} />
            <span className="sr-only">{isLive ? 'Live status on' : 'Live status off'}</span>
          </button>
        </div>
      </div>
      {message && <p role={error ? 'alert' : 'status'} className={`mt-4 text-xs ${error ? 'text-rose-200/80' : 'text-emerald-200/80'}`}>{message}</p>}
      {saving && <p role="status" className="sr-only">Saving Kick status…</p>}
    </section>
  )
}
