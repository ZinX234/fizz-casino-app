'use client'

import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { AdminGameVisibilityRecord } from '@/lib/casino-data'

export function AdminGameVisibility({
  initialGames,
  loadError = false,
}: {
  initialGames: AdminGameVisibilityRecord[]
  loadError?: boolean
}) {
  const [games, setGames] = useState(initialGames)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ gameId: string; text: string; error: boolean } | null>(null)

  async function toggle(game: AdminGameVisibilityRecord) {
    if (savingId) return
    const lobbyEnabled = !game.lobbyEnabled
    setSavingId(game.id)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/game-visibility', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, lobbyEnabled }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Game visibility could not be saved.')
      if (payload?.game?.id !== game.id || payload?.game?.lobbyEnabled !== lobbyEnabled) {
        throw new Error('The server did not confirm the visibility change. Refresh and try again.')
      }

      setGames((current) => current.map((item) => item.id === game.id
        ? { ...item, lobbyEnabled: payload.game.lobbyEnabled }
        : item))
      setMessage({
        gameId: game.id,
        text: lobbyEnabled ? `${game.name} is enabled in the lobby listing.` : `${game.name} is disabled in the lobby listing.`,
        error: false,
      })
    } catch (issue) {
      setMessage({
        gameId: game.id,
        text: issue instanceof Error ? issue.message : 'Game visibility could not be saved.',
        error: true,
      })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-6" aria-labelledby="game-visibility-heading">
      <div>
        <p className="eyebrow">Casino floor</p>
        <h2 id="game-visibility-heading" className="mt-2 text-base font-bold">Game visibility</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-white/40">
          Hide or restore games in the casino lobby at any time. This does not change game availability, RTP settings, or active rounds.
        </p>
      </div>
      {loadError ? (
        <p role="alert" className="mt-5 rounded-lg border border-rose-200/10 bg-rose-100/[0.04] p-3 text-xs text-rose-100/80">
          Game visibility settings could not be loaded. Other admin controls are still available.
        </p>
      ) : games.length ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <article key={game.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/[0.07] bg-black/10 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white/85">{game.name}</p>
                <p className="mt-1 truncate text-[10px] text-white/35">{game.slug} · game status: {game.status}</p>
                <p className={`mt-1 text-[11px] font-medium ${game.lobbyEnabled ? 'text-emerald-200/70' : 'text-white/40'}`}>
                  {game.lobbyEnabled ? 'Lobby listing enabled' : 'Lobby listing disabled'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={game.lobbyEnabled}
                aria-label={`${game.lobbyEnabled ? 'Hide' : 'Show'} ${game.name} on the casino floor`}
                disabled={savingId !== null}
                onClick={() => void toggle(game)}
                className={`relative inline-flex h-7 w-[50px] shrink-0 items-center rounded-full border transition disabled:cursor-wait disabled:opacity-60 ${game.lobbyEnabled ? 'border-emerald-300/70 bg-emerald-300/80' : 'border-white/15 bg-white/10'}`}
              >
                {savingId === game.id
                  ? <LoaderCircle aria-hidden="true" className="absolute left-1/2 size-4 -translate-x-1/2 animate-spin text-white" />
                  : <span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${game.lobbyEnabled ? 'translate-x-[26px]' : 'translate-x-1'}`} />}
                <span className="sr-only">{game.lobbyEnabled ? 'On' : 'Off'}</span>
              </button>
              {message?.gameId === game.id && (
                <p role={message.error ? 'alert' : 'status'} className={`col-span-2 text-[11px] ${message.error ? 'text-rose-200/80' : 'text-emerald-200/80'}`}>
                  {message.text}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-white/45">No games are available to configure.</p>
      )}
    </section>
  )
}
