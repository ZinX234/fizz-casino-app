'use client'

import { useState } from 'react'
import { Save, ShieldCheck } from 'lucide-react'
import type { GameRtpSetting } from '@/lib/casino-game-types'

export function AdminGameSettings({ initialSettings }: { initialSettings: GameRtpSetting[] }) {
  const [settings, setSettings] = useState(initialSettings)
  const [publishedSettings, setPublishedSettings] = useState(initialSettings)
  const [savingSlug, setSavingSlug] = useState<string | null>(null)
  const [message, setMessage] = useState<{ slug: string; text: string; error: boolean } | null>(null)

  function updateHouseEdge(slug: GameRtpSetting['slug'], houseEdgeBps: number) {
    if (!Number.isFinite(houseEdgeBps)) return
    const boundedEdge = Math.min(9900, Math.max(100, Math.round(houseEdgeBps / 10) * 10))
    setSettings((current) => current.map((item) => item.slug === slug
      ? { ...item, houseEdgeBps: boundedEdge, rtpBps: 10_000 - boundedEdge }
      : item))
    setMessage((current) => current?.slug === slug ? null : current)
  }

  async function save(slug: GameRtpSetting['slug']) {
    const setting = settings.find((item) => item.slug === slug)
    if (!setting) return
    setSavingSlug(slug)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/game-settings', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, houseEdgeBps: setting.houseEdgeBps }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Could not save game settings.')
      const saved = result?.settings as GameRtpSetting | undefined
      if (!saved || saved.slug !== slug || !Number.isInteger(saved.houseEdgeBps) || !Number.isInteger(saved.rtpBps)) {
        throw new Error('The server did not confirm the saved odds. Refresh and try again.')
      }
      setSettings((current) => current.map((item) => item.slug === slug ? saved : item))
      setPublishedSettings((current) => current.map((item) => item.slug === slug ? saved : item))
      setMessage({
        slug,
        text: `Saved for new rounds: ${(saved.houseEdgeBps / 100).toFixed(1)}% house edge · ${(saved.rtpBps / 100).toFixed(1)}% RTP.`,
        error: false,
      })
    } catch (error) {
      setMessage({ slug, text: error instanceof Error ? error.message : 'Could not save game settings.', error: true })
    } finally {
      setSavingSlug(null)
    }
  }

  return (
    <section className="mt-8 rounded-[24px] border border-amber-100/10 bg-[#12141a] p-5 sm:p-7" aria-labelledby="game-settings-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="eyebrow">Published odds</p><h2 id="game-settings-heading" className="mt-2 text-xl font-bold">Game RTP &amp; house edge</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Set either value per game; changing one updates the other. RTP sets long-run expected return, while house edge is its complement—not a separate volatility target. Saved odds apply only to new rounds; active rounds keep their original settings. Crash uses RTP in its crash-point distribution, Mines and Towers scale cash-out payouts using their actual safe-pick probabilities, Vault Heist scales rewards without changing door odds, and Donut Division calibrates its reel, scatter, wild-drop, and bonus-path payouts to the selected target.</p></div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/10 bg-emerald-200/[0.04] px-3 py-2 text-[11px] font-semibold text-emerald-100/70"><ShieldCheck aria-hidden="true" className="size-4" /> Server-enforced</div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {settings.map((setting) => {
          const published = publishedSettings.find((item) => item.slug === setting.slug) ?? setting
          const hasUnsavedChanges = published.houseEdgeBps !== setting.houseEdgeBps
          return (
            <article key={setting.slug} className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:p-5">
              <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{setting.name}</h3><span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">{setting.slug}</span></div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${setting.slug}-edge`} className="text-xs text-white/50">House edge</label>
                  <div className="mt-2 flex items-center rounded-lg border border-white/10 bg-black/20 px-2.5 focus-within:border-amber-200/40">
                    <input id={`${setting.slug}-edge`} type="number" min="1" max="99" step="0.1" value={(setting.houseEdgeBps / 100).toFixed(1)} onChange={(event) => updateHouseEdge(setting.slug, Number.parseFloat(event.target.value) * 100)} aria-label={`${setting.name} house edge percentage`} className="w-full bg-transparent py-2 text-sm font-bold tabular-nums text-white outline-none" />
                    <span className="text-xs text-white/40">%</span>
                  </div>
                </div>
                <div>
                  <label htmlFor={`${setting.slug}-rtp`} className="text-xs text-white/50">RTP</label>
                  <div className="mt-2 flex items-center rounded-lg border border-white/10 bg-black/20 px-2.5 focus-within:border-amber-200/40">
                    <input id={`${setting.slug}-rtp`} type="number" min="1" max="99" step="0.1" value={(setting.rtpBps / 100).toFixed(1)} onChange={(event) => updateHouseEdge(setting.slug, 10_000 - Number.parseFloat(event.target.value) * 100)} aria-label={`${setting.name} RTP percentage`} className="w-full bg-transparent py-2 text-sm font-bold tabular-nums text-white outline-none" />
                    <span className="text-xs text-white/40">%</span>
                  </div>
                </div>
              </div>
              <input id={`${setting.slug}-edge-slider`} type="range" min="100" max="9900" step="10" value={setting.houseEdgeBps} aria-label={`${setting.name} house edge slider`} aria-valuetext={`${(setting.houseEdgeBps / 100).toFixed(1)}% house edge`} onChange={(event) => updateHouseEdge(setting.slug, Number(event.target.value))} className="mt-4 h-2 w-full cursor-pointer accent-[#f4bc63]" />
              <div className="mt-2 flex justify-between text-[10px] text-white/35"><span>1% edge · 99% RTP</span><span>99% edge · 1% RTP</span></div>
              <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <div className="flex items-center justify-between"><span className="text-xs text-white/45">Currently published</span><span className="text-sm font-bold tabular-nums text-white">{(published.houseEdgeBps / 100).toFixed(1)}% edge</span></div>
                <p className="mt-1 text-xs tabular-nums text-amber-100/80">{(published.rtpBps / 100).toFixed(1)}% RTP</p>
              </div>
              {hasUnsavedChanges && <p className="mt-3 text-xs font-medium text-amber-100/80">Unsaved draft: {(setting.houseEdgeBps / 100).toFixed(1)}% edge · {(setting.rtpBps / 100).toFixed(1)}% RTP</p>}
              <button type="button" disabled={savingSlug !== null || !hasUnsavedChanges} onClick={() => void save(setting.slug)} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#f4bc63] px-4 text-xs font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-not-allowed disabled:opacity-50"><Save aria-hidden="true" className="size-3.5" />{savingSlug === setting.slug ? 'Saving…' : hasUnsavedChanges ? 'Save RTP & house edge' : 'Settings saved'}</button>
              {message?.slug === setting.slug && <p role={message.error ? 'alert' : 'status'} aria-live="polite" className={`mt-3 text-xs ${message.error ? 'text-rose-200/80' : 'text-emerald-200/80'}`}>{message.text}</p>}
            </article>
          )
        })}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-white/35">House edge is bounded to 1.0%–99.0% in 0.1% increments. RTP can be set as low as 1.0% and is the complement of house edge. Changes apply globally to new rounds only; no player-specific or active-round targeting.</p>
    </section>
  )
}

export function AdminGameSettingsHistory({ rows }: { rows: Array<{ id: string; details: Record<string, unknown>; created_at: string }> }) {
  return <section className="mt-5 rounded-[20px] border border-white/[0.08] bg-[#12141a] p-5"><h2 className="text-sm font-bold">Recent odds changes</h2>{rows.length ? <ul className="mt-3 divide-y divide-white/[0.06]">{rows.map((row) => <li key={row.id} className="flex flex-col gap-1 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="text-white/70">{String(row.details.game ?? 'Game')} · {(Number(row.details.previousRtpBps) / 100).toFixed(1)}% to {(Number(row.details.rtpBps) / 100).toFixed(1)}% RTP</span><time dateTime={row.created_at} className="text-white/35">{new Date(row.created_at).toLocaleString()}</time></li>)}</ul> : <p className="mt-3 text-xs text-white/40">No settings changes recorded yet.</p>}</section>
}
