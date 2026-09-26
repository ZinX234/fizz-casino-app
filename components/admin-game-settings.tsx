'use client'

import { useState } from 'react'
import { Save, ShieldCheck } from 'lucide-react'
import type { GameRtpSetting } from '@/lib/casino-game-types'

export function AdminGameSettings({ initialSettings }: { initialSettings: GameRtpSetting[] }) {
  const [settings, setSettings] = useState(initialSettings)
  const [savingSlug, setSavingSlug] = useState<string | null>(null)
  const [message, setMessage] = useState<{ slug: string; text: string; error: boolean } | null>(null)

  async function save(slug: GameRtpSetting['slug']) {
    const setting = settings.find((item) => item.slug === slug)
    if (!setting) return
    setSavingSlug(slug)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/game-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, houseEdgeBps: setting.houseEdgeBps }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Could not save game settings.')
      setSettings((current) => current.map((item) => item.slug === slug ? result.settings : item))
      setMessage({ slug, text: 'Published settings updated for new rounds.', error: false })
    } catch (error) {
      setMessage({ slug, text: error instanceof Error ? error.message : 'Could not save game settings.', error: true })
    } finally {
      setSavingSlug(null)
    }
  }

  return (
    <section className="mt-8 rounded-[24px] border border-amber-100/10 bg-[#12141a] p-5 sm:p-7" aria-labelledby="game-settings-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="eyebrow">Published odds</p><h2 id="game-settings-heading" className="mt-2 text-xl font-bold">Game RTP &amp; house edge</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Changes are global, disclosed on each game, logged, and apply only to rounds started after the save. Active rounds keep their original settings. RTP affects gameplay directly: Crash uses it in its crash-point distribution, Mines and Towers calculate cash-out multipliers from it, and Vault Heist scales payouts without changing door odds.</p></div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/10 bg-emerald-200/[0.04] px-3 py-2 text-[11px] font-semibold text-emerald-100/70"><ShieldCheck aria-hidden="true" className="size-4" /> Server-enforced</div>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {settings.map((setting) => (
          <article key={setting.slug} className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:p-5">
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{setting.name}</h3><span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">{setting.slug}</span></div>
            <label htmlFor={`${setting.slug}-edge`} className="mt-5 flex items-center justify-between text-xs text-white/50"><span>House edge</span><span className="font-bold text-white">{(setting.houseEdgeBps / 100).toFixed(1)}%</span></label>
            <input id={`${setting.slug}-edge`} type="range" min="100" max="1000" step="10" value={setting.houseEdgeBps} onChange={(event) => setSettings((current) => current.map((item) => item.slug === setting.slug ? { ...item, houseEdgeBps: Number(event.target.value), rtpBps: 10_000 - Number(event.target.value) } : item))} className="mt-3 h-2 w-full cursor-pointer accent-[#f4bc63]" />
            <div className="mt-2 flex justify-between text-[10px] text-white/35"><span>1% minimum</span><span>10% maximum</span></div>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"><span className="text-xs text-white/45">Published RTP</span><span className="text-lg font-bold tabular-nums text-amber-100">{(setting.rtpBps / 100).toFixed(1)}%</span></div>
            <button type="button" disabled={savingSlug !== null} onClick={() => void save(setting.slug)} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#f4bc63] px-4 text-xs font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-not-allowed disabled:opacity-50"> <Save aria-hidden="true" className="size-3.5" />{savingSlug === setting.slug ? 'Saving…' : 'Save settings'}</button>
            {message?.slug === setting.slug && <p role={message.error ? 'alert' : 'status'} className={`mt-3 text-xs ${message.error ? 'text-rose-200/80' : 'text-emerald-200/80'}`}>{message.text}</p>}
          </article>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-white/35">House edge is bounded to 1.0%–10.0%. RTP is derived as 100% minus the selected edge; individual players and in-progress rounds cannot be targeted.</p>
    </section>
  )
}

export function AdminGameSettingsHistory({ rows }: { rows: Array<{ id: string; details: Record<string, unknown>; created_at: string }> }) {
  return <section className="mt-5 rounded-[20px] border border-white/[0.08] bg-[#12141a] p-5"><h2 className="text-sm font-bold">Recent odds changes</h2>{rows.length ? <ul className="mt-3 divide-y divide-white/[0.06]">{rows.map((row) => <li key={row.id} className="flex flex-col gap-1 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="text-white/70">{String(row.details.game ?? 'Game')} · {(Number(row.details.previousRtpBps) / 100).toFixed(1)}% to {(Number(row.details.rtpBps) / 100).toFixed(1)}% RTP</span><time dateTime={row.created_at} className="text-white/35">{new Date(row.created_at).toLocaleString()}</time></li>)}</ul> : <p className="mt-3 text-xs text-white/40">No settings changes recorded yet.</p>}</section>
}
