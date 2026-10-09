'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, RotateCcw, Wallet, Zap } from 'lucide-react'
import type { GameRoundView } from '@/lib/casino-game-types'
import { formatFizzcoins } from '@/lib/format-money'
import type { SweetBonanzaProfile, SweetBonanzaSymbol } from '@/lib/sweet-bonanza-config'

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
  a: '/games/sweet-bonanza/apple.png',
  b: '/games/sweet-bonanza/banana.png',
  c: '/games/sweet-bonanza/coconut.png',
  g: '/games/sweet-bonanza/grape.png',
  h: '/games/sweet-bonanza/heart.png',
  m: '/games/sweet-bonanza/melon.png',
  p: '/games/sweet-bonanza/peach.png',
  s: '/games/sweet-bonanza/plum.png',
  z: '/games/sweet-bonanza/watermelon.png',
  scatter: '/games/sweet-bonanza/apple.png', // Using apple as placeholder for scatter
}

type Props = {
  profiles: SweetBonanzaProfile[]
  initialProfileId: string
  initialRound: GameRoundView | null
  initialBalance: string
  currency: string
  playerName: string
}

export function SweetBonanzaGame({ profiles, initialProfileId, initialRound, initialBalance, currency, playerName }: Props) {
  const [round, setRound] = useState(initialRound)
  const [balance, setBalance] = useState(initialBalance)
  const [wager, setWager] = useState('400')
  const [profileId, setProfileId] = useState(initialRound?.sweetBonanza?.profileId ?? initialProfileId)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState('')

  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0]
  const sweetBonanza = round?.sweetBonanza
  const roundActive = round?.status === 'active'
  const isBonusRound = sweetBonanza?.isBonusRound === true
  const bonusSpinsRemaining = sweetBonanza?.bonusSpinsRemaining ?? 0
  const currentBonusSpin = sweetBonanza?.currentBonusSpin ?? 0
  const bonusTotalPayout = sweetBonanza?.bonusTotalPayout ?? 0
  const wagerAmount = Number(wager)
  const insufficientBalance = Math.floor(Number(balance) * 400) < 400
  const insufficientBonusBalance = Number(balance) < profile.buyBonusCost

  async function sendAction(payload: Record<string, unknown>) {
    setPending(true)
    setError('')
    setVerified('')
    try {
      const response = await fetch('/api/games/sweet-bonanza/play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'The game request could not be completed.')
      setRound(result.round ?? null)
      if (result.wallet?.balance) setBalance(result.wallet.balance)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The game request could not be completed.')
    } finally {
      setPending(false)
    }
  }

  function spin() {
    if (!Number.isSafeInteger(wagerAmount) || wagerAmount < 400 || wagerAmount > 40_000 || wagerAmount % 4 !== 0) {
      setError('Choose a wager from 400 to 40,000 Fizzcoins in increments of 4.')
      return
    }
    if (wagerAmount > Math.floor(Number(balance) * 400)) {
      setError('Your Fizzcoin balance is too low for that wager.')
      return
    }
    void sendAction({
      action: 'start',
      requestId: crypto.randomUUID(),
      wagerCents: wagerAmount / 4,
      mineCount: 0,
      expectedRtpBps: profile.rtpBps,
      profileId: profile.id,
    })
  }

  function buyBonus() {
    if (!round) {
      setError('Start a normal spin first.')
      return
    }
    if (insufficientBonusBalance) {
      setError(`Need ${profile.buyBonusCost} Fizzcoins to buy bonus.`)
      return
    }
    void sendAction({
      action: 'buy-bonus',
      sessionId: round.sessionId,
    })
  }

  function nextBonusSpin() {
    if (!round || !isBonusRound) return
    void sendAction({
      action: 'next-bonus-spin',
      sessionId: round.sessionId,
    })
  }

  async function verifyCommitment() {
    if (!round?.fairness) return
    const bytes = new TextEncoder().encode(round.fairness.serverSeed)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const calculated = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    setVerified(calculated === round.fairness.commitment ? 'Verified: the revealed seed matches the published commitment.' : 'Verification failed: the seed does not match the published commitment.')
  }

  function renderGrid() {
    if (!sweetBonanza?.grid || sweetBonanza.grid.length === 0) {
      return (
        <div className="grid grid-cols-5 gap-2 p-6">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-white/5" />
          ))}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-5 gap-2 p-6">
        {sweetBonanza.grid.map((row, rowIndex) =>
          row.map((symbol, colIndex) => {
            const isWinning = sweetBonanza.winningSymbol === symbol
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`aspect-square flex items-center justify-center rounded-lg overflow-hidden transition-all ${
                  isWinning ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#12141a] scale-105' : ''
                }`}
              >
                <img
                  src={SYMBOL_IMAGES[symbol as SweetBonanzaSymbol]}
                  alt={SYMBOL_NAMES[symbol as SweetBonanzaSymbol]}
                  className="w-full h-full object-cover"
                />
              </div>
            )
          })
        )}
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#090b12] px-4 py-5 text-white sm:px-7 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/casino" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to lobby
        </Link>
        <header className="mt-5 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-200/70">Fizz original · {playerName}</p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl">
              <Zap aria-hidden="true" className="size-8 text-pink-200" /> Sweet Bonanza
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/50">
              Match 8+ symbols across the 6x5 grid to win. Weighted symbol frequencies with RTP-controlled payouts.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <Wallet aria-hidden="true" className="size-5 text-emerald-200" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Wallet</p>
              <p className="text-sm font-bold">{formatFizzcoins(balance, currency)}</p>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Sweet Bonanza game" className="overflow-hidden rounded-3xl border border-white/10 bg-[#11131a]">
            <div className="relative isolate min-h-[400px] bg-gradient-to-b from-pink-950/20 to-purple-950/20">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_40%,rgba(236,72,153,.18),transparent_60%)]" />

              {round?.status === 'settled' && sweetBonanza && (
                <div className="absolute top-4 left-4 right-4 z-10 rounded-xl border px-4 py-3 text-center">
                  <div className={`flex items-center justify-center gap-2 ${
                    round.result === 'win' ? 'border-emerald-200/20 bg-emerald-100/[0.04] text-emerald-100' : 'border-rose-200/20 bg-rose-100/[0.04] text-rose-100'
                  }`}>
                    {round.result === 'win' ? (
                      <>
                        <Zap aria-hidden="true" className="size-5" />
                        <div>
                          <p className="text-sm font-bold">Win! {formatFizzcoins(round.payout, currency)}</p>
                          <p className="text-xs text-white/70">
                            {sweetBonanza.winningSymbol ? `${SYMBOL_NAMES[sweetBonanza.winningSymbol]} ×${sweetBonanza.symbolCount}` : 'No match'}
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

              {isBonusRound && (
                <div className="absolute top-4 left-4 right-4 z-10 rounded-xl border border-pink-200/20 bg-pink-100/[0.04] px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-pink-100">
                    <Zap aria-hidden="true" className="size-5 animate-pulse" />
                    <div>
                      <p className="text-sm font-bold">BONUS ROUND</p>
                      <p className="text-xs text-white/70">
                        Spin {currentBonusSpin + 1}/{profile.bonusFreeSpins} · {bonusSpinsRemaining} remaining
                        {bonusTotalPayout > 0 && ` · Total: ${formatFizzcoins(bonusTotalPayout.toFixed(2), currency)}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {renderGrid()}
            </div>

            <div className="flex flex-col gap-4 border-t border-white/10 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
              {isBonusRound ? (
                <div className="flex items-center justify-between w-full">
                  <div className="text-xs text-white/50">
                    Bonus spins remaining: {bonusSpinsRemaining}
                  </div>
                  <button
                    type="button"
                    disabled={pending || bonusSpinsRemaining <= 0}
                    onClick={nextBonusSpin}
                    className="min-h-11 rounded-xl bg-pink-400 px-7 text-sm font-black text-[#211807] transition hover:bg-pink-300 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {pending ? 'Processing…' : bonusSpinsRemaining > 0 ? 'Next bonus spin' : 'End bonus'}
                  </button>
                </div>
              ) : roundActive ? (
                <div className="text-xs text-white/50">
                  Processing spin...
                </div>
              ) : (
                <>
                  <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-white/60">
                    Difficulty profile
                    <select
                      aria-label="Difficulty profile"
                      disabled={pending}
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending || insufficientBalance}
                      onClick={spin}
                      className="min-h-11 rounded-xl bg-pink-400 px-7 text-sm font-black text-[#211807] transition hover:bg-pink-300 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {pending ? 'Spinning…' : insufficientBalance ? 'Need 400 FC' : round?.status === 'settled' ? 'Spin again' : 'Spin'}
                    </button>
                    {round && (
                      <button
                        type="button"
                        disabled={pending || insufficientBonusBalance}
                        onClick={buyBonus}
                        className="min-h-11 rounded-xl border-2 border-pink-400 bg-transparent px-4 text-sm font-bold text-pink-400 transition hover:bg-pink-400 hover:text-[#211807] disabled:cursor-not-allowed disabled:opacity-45"
                        title={`Buy bonus for ${profile.buyBonusCost} Fizzcoins`}
                      >
                        Buy Bonus
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {error && (
              <p role="alert" className="mx-4 mb-4 rounded-xl border border-rose-200/15 bg-rose-100/[0.04] px-4 py-3 text-sm text-rose-100/85 sm:mx-6">
                {error}
              </p>
            )}
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-2xl border border-white/10 bg-[#11131a] p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50">
                <Zap aria-hidden="true" className="size-4 text-pink-200" /> Fair play
              </div>
              <p className="mt-3 text-xs leading-5 text-white/55">
                Every spin is generated server-side using weighted symbol probabilities and the configured RTP. Changing symbol weights or RTP in the admin panel immediately affects new spins. Outcomes are cryptographically committed before the spin and can be verified afterward.
              </p>
              {round && (
                <details className="mt-4 border-t border-white/10 pt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-white/70">Round fairness record</summary>
                  <dl className="mt-3 grid gap-2 break-all text-[10px] text-white/45">
                    <div>
                      <dt className="font-semibold text-white/65">SHA-256 commitment</dt>
                      <dd className="mt-1 font-mono">{round.commitment}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-white/65">Client seed</dt>
                      <dd className="mt-1 font-mono">{round.clientSeed}</dd>
                    </div>
                    {round.fairness && (
                      <div>
                        <dt className="font-semibold text-white/65">Revealed server seed</dt>
                        <dd className="mt-1 font-mono">{round.fairness.serverSeed}</dd>
                      </div>
                    )}
                  </dl>
                  {round.fairness && (
                    <button
                      type="button"
                      onClick={verifyCommitment}
                      className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:text-white"
                    >
                      Verify commitment
                    </button>
                  )}
                  {verified && <p role="status" className="mt-2 text-xs text-emerald-200/80">{verified}</p>}
                </details>
              )}
            </section>
            <section className="rounded-2xl border border-white/10 bg-[#11131a] p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Symbol payouts</h2>
              <div className="mt-4 space-y-2 text-xs">
                {Object.entries(SYMBOL_NAMES).map(([symbol, name]) => (
                  <div key={symbol} className="flex items-center justify-between">
                    <span className="text-white/70">{name}</span>
                    <span className="font-semibold text-white/85">
                      {profile.symbols[symbol as SweetBonanzaSymbol].payoutMultiplier}× (8+)
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <p className="px-1 text-[11px] leading-5 text-white/35">
              Wagers and payouts use your verified Fizz wallet. Only play where legal and never wager more than you can afford to lose.
            </p>
          </aside>
        </div>
      </div>
    </main>
  )
}
