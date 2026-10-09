'use client'

import { useState } from 'react'
import { Clock, Zap } from 'lucide-react'
import { formatFizzcoins } from '@/lib/format-money'
import type { SweetBonanzaConfig, SweetBonanzaProfile, SweetBonanzaSymbol } from '@/lib/sweet-bonanza-config'
import type { GameRoundView } from '@/lib/casino-game-types'

const SYMBOL_NAMES: Record<SweetBonanzaSymbol, string> = {
  a: 'Apple',
  b: 'Banana',
  c: 'Coconut',
  g: 'Grape',
  h: 'Heart',
  m: 'Melon',
  p: 'Peach',
  s: 'Plum',
  z: 'Watermelon',
  scatter: 'Scatter',
}

const SYMBOL_IMAGES: Record<SweetBonanzaSymbol, string> = {
  a: '/games/sweet-bonanza/img/aple.png',
  b: '/games/sweet-bonanza/img/banana.png',
  c: '/games/sweet-bonanza/img/konFIL.png',
  g: '/games/sweet-bonanza/img/vinog.png',
  h: '/games/sweet-bonanza/img/heart.png',
  m: '/games/sweet-bonanza/img/melon.png',
  p: '/games/sweet-bonanza/img/persik.png',
  s: '/games/sweet-bonanza/img/konSIN.png',
  z: '/games/sweet-bonanza/img/konZEL.png',
  scatter: '/games/sweet-bonanza/img/aple.png',
}

export function SweetBonanzaGame({
  round,
  balance,
  currency,
  profiles,
  error,
  sendAction,
}: {
  round: GameRoundView | null
  balance: string
  currency: string
  profiles: SweetBonanzaProfile[]
  error: string | null
  sendAction: (action: any) => Promise<any>
}) {
  const [wager, setWager] = useState('400')
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? 'standard')
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0]
  const sweetBonanza = round?.sweetBonanza ?? null
  const grid = sweetBonanza?.grid ?? Array(5).fill(Array(6).fill('a'))
  const isSpinning = round?.status === 'active'

  async function spin() {
    const wagerAmount = Number(wager)
    if (!Number.isSafeInteger(wagerAmount) || wagerAmount < 400 || wagerAmount > 40_000 || wagerAmount % 4 !== 0) {
      alert('Choose a wager from 400 to 40,000 Fizzcoins in increments of 4.')
      return
    }
    const data = await sendAction({
      action: 'start',
      requestId: crypto.randomUUID(),
      wagerCents: wagerAmount / 4,
      mineCount: 0,
      expectedRtpBps: profile.rtpBps,
      profileId: profile.id,
    })
    if (data.error) {
      alert(data.error || 'Spin failed')
    }
  }

  return (
    <div className="flex min-h-[400px] flex-col gap-4 bg-[#0f0f13] rounded-xl border border-white/[0.08] p-4">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-white/50">
          {round?.status === 'settled' ? (
            <span className="flex items-center gap-1.5">
              <Clock aria-hidden="true" className="size-3" />
              {new Date(round.startedAt).toLocaleTimeString()}
            </span>
          ) : (
            'RTP: 96%'
          )}
        </span>
        <span className="text-white/50">Balance: {formatFizzcoins(balance, currency)}</span>
      </div>

      <div className="relative aspect-[6/5] w-full max-w-[600px] mx-auto rounded-lg border border-white/[0.06] bg-[#1a1a20] p-2">
        <div className="grid grid-cols-6 grid-rows-5 gap-1 h-full">
          {grid.map((row: string[], rowIndex: number) =>
            row.map((symbol: string, colIndex: number) => {
              const symbolKey = symbol as SweetBonanzaSymbol
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="relative flex items-center justify-center bg-[#22222a] rounded-md overflow-hidden"
                >
                  <img
                    src={SYMBOL_IMAGES[symbolKey]}
                    alt={SYMBOL_NAMES[symbolKey]}
                    className="w-full h-full object-contain"
                  />
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-white/10 p-4">
        <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-white/60">
          Difficulty profile
          <select
            aria-label="Difficulty profile"
            disabled={isSpinning}
            value={profileId}
            onChange={(event) => setProfileId(event.target.value)}
            className="h-11 rounded-xl border border-white/10 bg-[#0b0d14] px-3 text-sm text-white outline-none focus:border-pink-200/50"
          >
            {profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {(item.rtpBps / 100).toFixed(2)}% RTP
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-white/60">
          Wager in Fizzcoins
          <input
            aria-label="Wager in Fizzcoins"
            type="number"
            min="400"
            max="40000"
            step="4"
            value={wager}
            onChange={(event) => setWager(event.target.value)}
            className="h-11 rounded-xl border border-white/10 bg-[#0b0d14] px-3 text-sm font-bold text-white outline-none focus:border-pink-200/50"
          />
        </label>
        <button
          type="button"
          disabled={isSpinning}
          onClick={spin}
          className="min-h-11 rounded-xl bg-pink-400 px-7 text-sm font-black transition hover:bg-pink-300 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSpinning ? 'Spinning…' : 'Spin'}
        </button>
      </div>

      {round?.status === 'settled' && sweetBonanza && (
        <div className="absolute top-4 left-4 right-4 z-10 rounded-xl border px-4 py-3 text-center">
          <div className={`flex items-center justify-center gap-2 ${
            round.payout !== '0.00' ? 'border-emerald-200/20 bg-emerald-100/[0.04] text-emerald-100' : 'border-rose-200/20 bg-rose-100/[0.04] text-rose-100'
          }`}>
            {round.payout !== '0.00' ? (
              <>
                <Zap aria-hidden="true" className="size-5" />
                <div>
                  <p className="text-sm font-bold">Win! {formatFizzcoins(round.payout, currency)}</p>
                  <p className="text-xs text-white/70">
                    {sweetBonanza.winningSymbol ? `${SYMBOL_NAMES[sweetBonanza.winningSymbol as SweetBonanzaSymbol]} ×${sweetBonanza.symbolCount}` : 'No match'}
                    {sweetBonanza.finalMultiplier > 0 && ` · ${sweetBonanza.finalMultiplier.toFixed(2)}× multiplier`}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm font-bold">No win this spin</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SweetBonanzaGame
