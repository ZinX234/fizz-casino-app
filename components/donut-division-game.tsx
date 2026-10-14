'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ArrowLeft, Check, ShieldCheck, TriangleAlert } from 'lucide-react'
import SymbolArt from '@/components/donut-division-symbol'
import type { GameRoundView, GameRtpSetting } from '@/lib/casino-game-types'
import { formatFizzcoins } from '@/lib/format-money'

type Props = {
  setting: GameRtpSetting
  initialRound: GameRoundView | null
  initialBalance: string
  currency: string
  playerName: string
}

const WAGER_OPTIONS = [400, 800, 2_000, 4_000, 8_000, 20_000, 40_000]
const SYMBOL_NAMES: Record<string, string> = {
  SPRINKLE: 'Sprinkle donut',
  PINK: 'Pink frosted donut',
  CHOC: 'Chocolate donut',
  CONE: 'Traffic cone',
  REDLIGHT: 'Red light',
  COFFEE: 'Coffee cup',
  DET_D: 'Rookie Reyes',
  DET_C: 'Sergeant Bloom',
  DET_B: 'Captain Nova',
  DET_A: 'Officer',
  WILD: 'Gooey Wild',
  SCATTER: 'Case File Scatter',
}

function SlotGrid({ grid, compact = false }: { grid: string[][]; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-5 gap-1 rounded-xl border border-[#151515] bg-[#151515] p-1.5 ${compact ? 'w-full max-w-[220px]' : 'w-full max-w-[560px]'}`}>
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, reel) => {
          const symbol = grid[reel]?.[row]
          return (
            <div key={`${reel}-${row}`} className="flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-md bg-[#fff6e2] p-1">
              {symbol ? <SymbolArt id={symbol} className="size-full" /> : null}
            </div>
          )
        }),
      )}
    </div>
  )
}

function VerifyFairness({ round }: { round: GameRoundView }) {
  const [message, setMessage] = useState('')
  if (!round.fairness) return null

  async function verify() {
    const bytes = new TextEncoder().encode(round.fairness!.serverSeed)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const calculated = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    setMessage(calculated === round.fairness!.commitment
      ? 'Verified: the revealed server seed matches the published commitment.'
      : 'Verification failed: the revealed seed does not match the commitment.')
  }

  return (
    <details className="rounded-xl border border-white/[0.08] bg-black/10 px-4 py-3">
      <summary className="cursor-pointer text-xs font-semibold text-white/65">Provably fair record · seed revealed</summary>
      <dl className="mt-3 grid gap-2 break-all text-[11px] text-white/45">
        <div><dt className="font-semibold text-white/65">SHA-256 commitment</dt><dd className="mt-1 font-mono">{round.fairness.commitment}</dd></div>
        <div><dt className="font-semibold text-white/65">Client seed</dt><dd className="mt-1 font-mono">{round.fairness.clientSeed}</dd></div>
        <div><dt className="font-semibold text-white/65">Revealed server seed</dt><dd className="mt-1 font-mono">{round.fairness.serverSeed}</dd></div>
      </dl>
      <button type="button" onClick={() => void verify()} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:text-white">Verify seed commitment</button>
      {message && <p role="status" className="mt-2 text-xs text-emerald-200/80">{message}</p>}
    </details>
  )
}

export function DonutDivisionGame({ setting, initialRound, initialBalance, currency, playerName }: Props) {
  const [round, setRound] = useState(initialRound)
  const [balance, setBalance] = useState(initialBalance)
  const [wager, setWager] = useState(WAGER_OPTIONS[0])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const requestInFlight = useRef(false)
  const donut = round?.donutDivision
  const active = round?.status === 'active'
  const affordable = Number(balance) >= wager / 400
  const roundRtp = round?.rtpBps ?? setting.rtpBps
  const roundEdge = round?.houseEdgeBps ?? setting.houseEdgeBps
  const revealedPositions = new Set(round?.picks ?? [])
  const revealedCards = new Map(donut?.revealedCards.map((card) => [card.position, card.value]) ?? [])

  async function send(payload: Record<string, unknown>) {
    if (requestInFlight.current) return
    requestInFlight.current = true
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/games/donut-division/play', {
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
      requestInFlight.current = false
      setPending(false)
    }
  }

  function startRound() {
    if (!Number.isSafeInteger(wager) || wager < 400 || wager > 40_000 || wager % 4 !== 0) {
      setError('Choose a wager from 400 to 40,000 Fizzcoins in increments of 4.')
      return
    }
    if (!affordable) {
      setError('Your wallet balance is too low for that wager.')
      return
    }
    void send({
      action: 'start',
      requestId: crypto.randomUUID(),
      wagerCents: wager / 4,
      expectedRtpBps: setting.rtpBps,
    })
  }

  function selectBonus(choiceId: 'sticky' | 'pick' | 'surveillance') {
    if (!round) return
    void send({ action: 'bonus', sessionId: round.sessionId, requestId: crypto.randomUUID(), choiceId })
  }

  function pickCard(position: number) {
    if (!round) return
    void send({ action: 'pick', sessionId: round.sessionId, requestId: crypto.randomUUID(), position })
  }

  return (
    <main className="min-h-screen bg-[#0b0c10] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <Link href="/casino" className="inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"><ArrowLeft aria-hidden="true" className="size-4" /> Back to lobby</Link>
        <div className="mt-7 flex flex-col gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Fizz originals · {playerName}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Donut Division</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">Match symbols from the left across 25 fixed paylines. Three or more Case File Scatters unlock one bonus investigation.</p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 sm:self-auto">
            <ShieldCheck aria-hidden="true" className="size-4 text-emerald-200/75" />
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/35">Published settings</p><p className="mt-1 text-xs font-semibold text-white/80">RTP {(roundRtp / 100).toFixed(2)}% <span className="px-1 text-white/25">·</span> House edge {(roundEdge / 100).toFixed(2)}%</p></div>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Donut Division game" className="rounded-[24px] border border-white/[0.08] bg-[#12141a] p-4 sm:p-7">
            <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[19px] border border-white/[0.06] bg-[radial-gradient(ellipse_at_50%_35%,rgba(244,188,99,.14),rgba(13,14,19,.92)_75%)] p-4 sm:min-h-[450px] sm:p-8">
              {donut ? <SlotGrid grid={donut.grid} /> : <div className="max-w-sm text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100/60">Ready when you are</p><p className="mt-3 text-sm leading-6 text-white/45">Your first server-generated board will appear here after you place a wager.</p></div>}
              {donut && donut.lineWins.length > 0 && <div className="mt-4 flex flex-wrap justify-center gap-2">{donut.lineWins.map((win) => <span key={win.lineIndex} className="rounded-full border border-amber-100/15 bg-amber-100/[0.05] px-3 py-1 text-[11px] font-semibold text-amber-100/80">{win.count} × {SYMBOL_NAMES[win.symbol]} · {win.multiplier}× line bet</span>)}</div>}
              {donut && donut.scatterCount > 0 && <p className="mt-3 text-xs font-bold text-amber-100/70">{donut.scatterCount} Case File Scatter{donut.scatterCount === 1 ? '' : 's'}</p>}
              {donut?.feature === 'gooey' && <p className="mt-3 rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">Gooey Wild feature</p>}
              {donut?.feature === 'maxWin' && <p className="mt-3 rounded-full bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-100">Max Win feature</p>}
            </div>

            {active && donut?.bonusStage === 'choose' && (
              <div className="mt-5 rounded-2xl border border-amber-100/15 bg-amber-100/[0.035] p-4 sm:p-5">
                <h2 className="text-base font-bold text-amber-100">Bonus choice unlocked</h2>
                <p className="mt-1 text-xs leading-5 text-white/50">Each bonus path is normalized to the same expected bonus return. Your choice changes the feature, not the published long-run RTP.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <BonusButton title="Sticky Wild Free Spins" subtitle="10 spins · up to 3 sticky wilds" color="border-pink-200/20 bg-pink-200/[0.05]" disabled={pending} onClick={() => selectBonus('sticky')} />
                  <BonusButton title="Detective Pick" subtitle="Pick 3 of 12 case files" color="border-lime-200/20 bg-lime-200/[0.05]" disabled={pending} onClick={() => selectBonus('pick')} />
                  <BonusButton title="Mystery Surveillance" subtitle="5 spins · wild drops · 2×–5×" color="border-sky-200/20 bg-sky-200/[0.05]" disabled={pending} onClick={() => selectBonus('surveillance')} />
                </div>
              </div>
            )}

            {active && donut?.bonusStage === 'pick' && (
              <div className="mt-5 rounded-2xl border border-lime-200/15 bg-lime-200/[0.035] p-4 sm:p-5">
                <h2 className="text-base font-bold text-lime-100">Detective Pick</h2>
                <p className="mt-1 text-xs leading-5 text-white/50">Open {donut.picksRemaining} more case file{donut.picksRemaining === 1 ? '' : 's'} to complete the feature.</p>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {Array.from({ length: 12 }, (_, position) => {
                    const isRevealed = revealedPositions.has(position)
                    return (
                      <button key={position} type="button" disabled={pending || isRevealed} onClick={() => pickCard(position)} className={`flex aspect-[4/3] flex-col items-center justify-center rounded-xl border px-2 text-center transition disabled:cursor-default ${isRevealed ? 'border-amber-100/25 bg-amber-100/10 text-amber-100' : 'border-white/10 bg-white/[0.03] text-white/75 hover:border-lime-100/35 hover:bg-lime-100/[0.06]'}`}>
                        <span className="text-lg font-black">{isRevealed ? `${revealedCards.get(position)}×` : 'CASE'}</span>
                        <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em]">{position + 1}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {donut && donut.bonusGrids.length > 0 && (
              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/10 p-4">
                <h2 className="text-sm font-bold">{donut.feature === 'gooey' ? 'Gooey wild drop' : `${donut.bonusChoice === 'sticky' ? 'Sticky wild' : 'Surveillance'} bonus spins`}</h2>
                <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                  {donut.bonusGrids.map((grid, index) => (
                    <div key={index} className="flex w-[190px] shrink-0 flex-col items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{donut.feature === 'gooey' ? 'Wild drop' : `Free spin ${index + 1}`} {donut.bonusMultipliers[index] > 1 ? `· ${donut.bonusMultipliers[index]}×` : ''}</p>
                      <SlotGrid grid={grid} compact />
                      <p className="text-[10px] text-white/45">{donut.bonusSpinWins[index]?.lineWins.length ?? 0} winning line{donut.bonusSpinWins[index]?.lineWins.length === 1 ? '' : 's'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!active ? (
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-white/55">Wager in Fizzcoins
                  <select aria-label="Wager in Fizzcoins" value={wager} onChange={(event) => setWager(Number(event.target.value))} className="h-11 rounded-xl border border-white/10 bg-[#0b0c10] px-3 text-sm font-semibold text-white outline-none">
                    {WAGER_OPTIONS.map((amount) => <option key={amount} value={amount}>{amount.toLocaleString('en-US')} Fizzcoins</option>)}
                  </select>
                </label>
                <button type="button" disabled={pending || !affordable} onClick={startRound} className="min-h-11 rounded-xl bg-[#f4bc63] px-7 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-not-allowed disabled:opacity-50">
                  {pending ? 'Starting…' : !affordable ? 'Insufficient balance' : round?.status === 'settled' ? 'Spin again' : 'Spin'}
                </button>
              </div>
            ) : <p className="mt-5 rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3 text-xs text-white/55">{pending ? 'Processing your server-verified feature choice…' : donut?.bonusStage === 'choose' ? 'Choose one bonus path to resolve this round.' : 'Complete the bonus picks to settle this round.'}</p>}

            {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200/15 bg-rose-100/[0.04] px-4 py-3 text-sm text-rose-100/80">{error}</p>}
            {round?.status === 'settled' && <div className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${round.result === 'win' ? 'border-emerald-200/15 bg-emerald-100/[0.04]' : 'border-rose-200/15 bg-rose-100/[0.04]'}`}><span className="mt-0.5">{round.result === 'win' ? <Check aria-hidden="true" className="size-4 text-emerald-200" /> : <TriangleAlert aria-hidden="true" className="size-4 text-rose-200" />}</span><div><p className="text-sm font-semibold">{round.result === 'win' ? `Round paid ${formatFizzcoins(round.payout, currency)}.` : 'Round lost · no payout.'}</p><p className="mt-1 text-xs text-white/45">Wallet balance: {formatFizzcoins(balance, currency)}.</p></div></div>}
            {round && <div className="mt-5"><VerifyFairness round={round} /></div>}
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-[20px] border border-white/[0.08] bg-[#12141a] p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">Wallet balance</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatFizzcoins(balance, currency)}</p><p className="mt-2 text-xs leading-5 text-white/40">Maximum wager: 40,000 Fizzcoins. Every wager and payout is recorded in the casino wallet ledger.</p></section>
            <section className="rounded-[20px] border border-amber-100/10 bg-amber-100/[0.025] p-5"><div className="flex items-center gap-2 text-xs font-bold text-amber-100/75"><ShieldCheck aria-hidden="true" className="size-4" /> Odds disclosed</div><p className="mt-3 text-xs leading-5 text-white/45">RTP is the long-run expected return, not a promise for an individual spin. The displayed published RTP and house edge are enforced server-side for new rounds; active rounds keep the settings they started with.</p></section>
            <section className="rounded-[20px] border border-white/[0.08] bg-[#12141a] p-5"><h2 className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">How to play</h2><ul className="mt-3 space-y-2 text-xs leading-5 text-white/45"><li>Wins start from the left across 25 fixed paylines.</li><li>Gooey Wild substitutes for other symbols.</li><li>Three or more scatters pay and unlock a choice of one bonus feature.</li><li>The bonus paths are normalized so choosing a feature does not change the published expected RTP.</li></ul></section>
            <p className="px-1 text-[11px] leading-5 text-white/35">Only play where legal and if you meet the legal age. Set limits and never wager more than you can afford to lose.</p>
          </aside>
        </div>
      </div>
    </main>
  )
}

function BonusButton({ title, subtitle, color, disabled, onClick }: { title: string; subtitle: string; color: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`min-h-24 rounded-xl border p-4 text-left transition hover:bg-white/[0.04] disabled:cursor-wait disabled:opacity-50 ${color}`}><span className="block text-sm font-bold text-white">{title}</span><span className="mt-2 block text-[11px] leading-4 text-white/50">{subtitle}</span></button>
}
