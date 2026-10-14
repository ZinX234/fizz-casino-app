'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, CircleHelp, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { GameRoundView, GameRtpSetting } from '@/lib/casino-game-types'
import { crashMultiplierAtElapsed } from '@/lib/crash-math'
import { payoutMultiplierForSafePicks } from '@/lib/casino-payout-math'
import { formatFizzcoins } from '@/lib/format-money'

const gameNames = { crash: 'Crash', towers: 'Towers', mines: 'Mines', 'vault-heist': 'Vault Heist', 'donut-division': 'Donut Division' } as const

type Props = {
  setting: GameRtpSetting
  initialRound: GameRoundView | null
  initialBalance: string
  currency: string
  playerName: string
}

export function CasinoGameBoard({ setting, initialRound, initialBalance, currency, playerName }: Props) {
  const [round, setRound] = useState(initialRound)
  const [balance, setBalance] = useState(initialBalance)
  const [wager, setWager] = useState('400')
  const [mineCount, setMineCount] = useState(initialRound?.mineCount ?? 3)
  const [currentMultiplier, setCurrentMultiplier] = useState(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState('')
  const requestInFlight = useRef(false)
  const syncInFlight = useRef(false)

  useEffect(() => {
    if (setting.slug !== 'crash' || round?.status !== 'active') return
    const updateMultiplier = () => {
      const elapsedSeconds = (Date.now() - new Date(round.startedAt).getTime()) / 1000
      setCurrentMultiplier(crashMultiplierAtElapsed(elapsedSeconds))
    }
    updateMultiplier()
    const interval = window.setInterval(updateMultiplier, 50)
    return () => window.clearInterval(interval)
  }, [round, setting.slug])

  useEffect(() => {
    if (setting.slug !== 'crash' || round?.status !== 'active') return
    let active = true

    const syncRound = async () => {
      if (syncInFlight.current || requestInFlight.current) return
      syncInFlight.current = true
      try {
        const response = await fetch(`/api/games/${setting.slug}/play`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'sync', sessionId: round.sessionId }),
        })
        if (!response.ok) return
        const result = await response.json()
        if (active && result.round?.status === 'settled') {
          setRound(result.round)
          if (result.wallet?.balance) setBalance(result.wallet.balance)
        }
      } catch {
        return
      } finally {
        syncInFlight.current = false
      }
    }

    void syncRound()
    const interval = window.setInterval(() => void syncRound(), 1000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [round?.sessionId, round?.status, setting.slug])

  async function sendAction(payload: Record<string, unknown>) {
    if (requestInFlight.current) return
    requestInFlight.current = true
    setPending(true)
    setError('')
    setVerified('')
    try {
      const response = await fetch(`/api/games/${setting.slug}/play`, {
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
    const amount = Number(wager)
    if (!Number.isSafeInteger(amount) || amount < 400 || amount > 40_000 || amount % 4 !== 0) {
      setError('Choose a wager from 400 to 40,000 Fizzcoins in increments of 4.')
      return
    }
    if (amount > Math.floor(Number(balance) * 400)) {
      setError('Your Fizzcoin balance is too low for that wager.')
      return
    }
    void sendAction({
      action: 'start',
      requestId: crypto.randomUUID(),
      wagerCents: amount / 4,
      mineCount: setting.slug === 'mines' ? mineCount : undefined,
      expectedRtpBps: setting.rtpBps,
    })
  }

  function pick(position: number) {
    if (!round || round.status !== 'active') return
    void sendAction({ action: 'pick', sessionId: round.sessionId, position })
  }

  function cashout() {
    if (!round || round.status !== 'active') return
    void sendAction({ action: 'cashout', sessionId: round.sessionId })
  }

  async function verifyCommitment() {
    if (!round?.fairness) return
    const bytes = new TextEncoder().encode(round.fairness.serverSeed)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const calculated = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    setVerified(calculated === round.fairness.commitment ? 'Verified: the revealed seed matches the published commitment.' : 'Verification failed: the seed does not match the published commitment.')
  }

  const roundActive = round?.status === 'active'
  const insufficientBalance = Math.floor(Number(balance) * 400) < 400
  const mineMultiplier = round?.picks.length && round.mineCount
    ? payoutMultiplier('mines', round.picks.length, round.mineCount, round.rtpBps)
    : 1
  const towerMultiplier = round?.picks.length ? payoutMultiplier('towers', round.picks.length, 0, round.rtpBps) : 1
  const canCashout = roundActive && (setting.slug === 'crash' || Boolean(round?.picks.length))

  return (
    <main className="min-h-screen bg-[#0b0c10] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/casino" className="inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"><ArrowLeft aria-hidden="true" className="size-4" /> Back to lobby</Link>
        <div className="mt-7 flex flex-col gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow">Fizz originals · {playerName}</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{gameNames[setting.slug]}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/45">{gameDescription(setting.slug)}</p></div>
          <div className="flex items-center gap-3 self-start rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 sm:self-auto"><ShieldCheck aria-hidden="true" className="size-4 text-emerald-200/75" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/35">Published settings</p><p className="mt-1 text-xs font-semibold text-white/80">RTP {((round?.rtpBps ?? setting.rtpBps) / 100).toFixed(2)}% <span className="px-1 text-white/25">·</span> House edge {((round?.houseEdgeBps ?? setting.houseEdgeBps) / 100).toFixed(2)}%</p></div></div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label={`${gameNames[setting.slug]} game`} className="rounded-[24px] border border-white/[0.08] bg-[#12141a] p-4 sm:p-7">
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[19px] border border-white/[0.06] bg-[radial-gradient(ellipse_at_50%_35%,rgba(78,88,107,.22),rgba(13,14,19,.92)_75%)] p-4 sm:min-h-[390px] sm:p-8">
              {setting.slug === 'crash' && <CrashDisplay round={round} multiplier={currentMultiplier} />}
              {setting.slug === 'mines' && <MinesBoard round={round} mineCount={mineCount} pending={pending} onPick={pick} />}
              {setting.slug === 'towers' && <TowersBoard round={round} pending={pending} onPick={pick} />}
            </div>

            {roundActive ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-white/45">Wager <span className="font-semibold text-white">{formatFizzcoins(round!.wager, currency)}</span>{setting.slug === 'mines' && <span className="ml-2">· {round!.mineCount} mines</span>}</div>
                {canCashout && <button type="button" disabled={pending} onClick={cashout} className="min-h-11 rounded-xl bg-[#f4bc63] px-6 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Settling…' : `Cash out${setting.slug === 'crash' ? ` · ${currentMultiplier.toFixed(2)}×` : ` · ${formatFizzcoins(round!.picks.length ? (Number(round!.wager) * (setting.slug === 'mines' ? mineMultiplier : towerMultiplier)).toFixed(2) : '0', currency)}`}`}</button>}
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-white/55">Wager in Fizzcoins
                  <span className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#0b0c10] px-3"><span className="text-white/35">FC</span><input aria-label="Wager in Fizzcoins" type="number" min="400" max="40000" step="4" value={wager} onChange={(event) => setWager(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none" /></span>
                </label>
                {setting.slug === 'mines' && <label className="flex flex-col gap-2 text-xs font-semibold text-white/55">Mines
                  <select aria-label="Mine count" value={mineCount} onChange={(event) => setMineCount(Number(event.target.value))} className="h-11 rounded-xl border border-white/10 bg-[#0b0c10] px-3 text-sm text-white outline-none">{Array.from({ length: 24 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} mines</option>)}</select>
                </label>}
                <button type="button" disabled={pending || insufficientBalance} onClick={startRound} className="min-h-11 rounded-xl bg-[#f4bc63] px-7 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Starting…' : insufficientBalance ? 'Need 400 Fizzcoins' : round?.status === 'settled' ? 'Play again' : 'Start round'}</button>
              </div>
            )}

            {insufficientBalance && !roundActive && <p role="status" className="mt-4 rounded-xl border border-amber-100/10 bg-amber-100/[0.035] px-4 py-3 text-xs leading-5 text-amber-50/70">At least 400 Fizzcoins are required to start a round. Your wallet balance is shown at the right.</p>}
            {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200/15 bg-rose-100/[0.04] px-4 py-3 text-sm text-rose-100/80">{error}</p>}
            {round?.status === 'settled' && <div className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${round.result === 'win' ? 'border-emerald-200/15 bg-emerald-100/[0.04]' : 'border-rose-200/15 bg-rose-100/[0.04]'}`}><span className="mt-0.5">{round.result === 'win' ? <Check aria-hidden="true" className="size-4 text-emerald-200" /> : <TriangleAlert aria-hidden="true" className="size-4 text-rose-200" />}</span><div><p className="text-sm font-semibold">{round.result === 'win' ? `Round paid ${formatFizzcoins(round.payout, currency)}${round.cashoutMultiplier ? ` · ${round.cashoutMultiplier.toFixed(2)}×` : ''}` : 'Round lost · no payout'}</p><p className="mt-1 text-xs text-white/45">Your wallet balance is {formatFizzcoins(balance, currency)}.</p></div></div>}

            {round && <details className="mt-5 rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3"><summary className="cursor-pointer text-xs font-semibold text-white/65">Fairness record · {round.status === 'active' ? 'seed commitment published' : 'seed revealed'}</summary><dl className="mt-3 grid gap-2 break-all text-[11px] text-white/45"><div><dt className="font-semibold text-white/65">SHA-256 commitment</dt><dd className="mt-1 font-mono">{round.commitment}</dd></div><div><dt className="font-semibold text-white/65">Client seed</dt><dd className="mt-1 font-mono">{round.clientSeed}</dd></div>{round.fairness && <div><dt className="font-semibold text-white/65">Revealed server seed</dt><dd className="mt-1 font-mono">{round.fairness.serverSeed}</dd></div>}</dl>{round.fairness && <button type="button" onClick={verifyCommitment} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:text-white">Verify seed commitment</button>}{verified && <p role="status" className="mt-2 text-xs text-emerald-200/80">{verified}</p>}</details>}
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-[20px] border border-white/[0.08] bg-[#12141a] p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">Wallet balance</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatFizzcoins(balance, currency)}</p><p className="mt-2 text-xs leading-5 text-white/40">Maximum wager: 40,000 Fizzcoins. Every wager and payout is recorded in your wallet ledger.</p></section>
            <section className="rounded-[20px] border border-amber-100/10 bg-amber-100/[0.025] p-5"><div className="flex items-center gap-2 text-xs font-bold text-amber-100/75"><CircleHelp aria-hidden="true" className="size-4" /> Odds stay visible</div><p className="mt-3 text-xs leading-5 text-white/45">The published RTP and house edge apply globally to new rounds. A setting change never alters an active round. Outcomes are generated server-side; the seed is revealed after settlement.</p></section>
            <p className="px-1 text-[11px] leading-5 text-white/35">Only play where legal and if you meet the legal age. Set limits and never wager more than you can afford to lose.</p>
          </aside>
        </div>
      </div>
    </main>
  )
}

function CrashDisplay({ round, multiplier }: { round: GameRoundView | null; multiplier: number }) {
  if (round?.status === 'settled' && round.result === 'loss') return <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-200/70">Crashed at</p><p className="mt-3 text-6xl font-black tracking-tight text-rose-200 sm:text-8xl">{round.crashPoint?.toFixed(2) ?? '—'}<span className="ml-2 text-4xl">×</span></p></div>
  if (round?.status === 'settled') return <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200/70">Cashed out</p><p className="mt-3 text-6xl font-black tracking-tight text-emerald-100 sm:text-8xl">{round.cashoutMultiplier?.toFixed(2) ?? '—'}<span className="ml-2 text-4xl">×</span></p><p className="mt-3 text-xs text-white/45">Round ended at {round.crashPoint?.toFixed(2) ?? '—'}×</p></div>
  return <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">{round?.status === 'active' ? 'Multiplier' : 'Ready when you are'}</p><p className="mt-3 text-6xl font-black tracking-tight text-amber-100 sm:text-8xl">{round?.status === 'active' ? multiplier.toFixed(2) : '1.00'}<span className="ml-2 text-4xl">×</span></p><p className="mt-3 text-xs text-white/40">{round?.status === 'active' ? 'Cash out before the round ends.' : 'Each new round is generated on the server.'}</p></div>
}

function MinesBoard({ round, mineCount, pending, onPick }: { round: GameRoundView | null; mineCount: number; pending: boolean; onPick: (position: number) => void }) {
  const picked = new Set(round?.picks ?? [])
  const mines = new Set(round?.revealedMines ?? [])
  return <div className="w-full max-w-[430px]"><div className="mb-4 flex items-center justify-between text-xs text-white/40"><span>5 × 5 board</span><span>{round?.mineCount ?? mineCount} mines</span></div><div className="grid grid-cols-5 gap-2 sm:gap-3">{Array.from({ length: 25 }, (_, position) => {
    const isPicked = picked.has(position)
    const isMine = mines.has(position)
    const isKnownSafe = round?.status === 'settled' && !isMine
    return <button key={position} type="button" aria-label={`Tile ${position + 1}${isMine ? ', mine' : isPicked ? ', revealed safe' : ''}`} disabled={pending || round?.status !== 'active' || isPicked} onClick={() => onPick(position)} className={`aspect-square rounded-xl border text-lg font-black transition disabled:cursor-default ${isMine ? 'border-rose-200/30 bg-rose-200/[0.09] text-rose-200' : isPicked || isKnownSafe ? 'border-emerald-200/25 bg-emerald-200/[0.07] text-emerald-100' : 'border-white/[0.08] bg-white/[0.035] text-white/15 hover:border-amber-100/30 hover:bg-amber-100/[0.05]'}`}>{isMine ? '×' : isPicked || isKnownSafe ? '◆' : '?'}</button>
  })}</div><p className="mt-4 text-center text-[11px] text-white/35">{round?.status === 'active' ? 'Choose a tile or cash out after a safe pick.' : 'Start a round to reveal tiles.'}</p></div>
}

function TowersBoard({ round, pending, onPick }: { round: GameRoundView | null; pending: boolean; onPick: (position: number) => void }) {
  return <div className="w-full max-w-[360px]"><p className="mb-3 text-center text-xs text-white/40">Choose one column on each row · {round?.picks.length ?? 0}/8 rows</p><div className="flex flex-col gap-2">{Array.from({ length: 8 }, (_, displayRow) => {
    const row = 7 - displayRow
    const selected = round?.picks[row]
    const correct = round?.revealedSafeColumns?.[row]
    const activeRow = round?.status === 'active' && row === (round.picks.length)
    return <div key={row} className="grid grid-cols-3 gap-2">{[0, 1, 2].map((column) => {
      const wasPicked = selected !== undefined
      const isCorrect = wasPicked && selected === column
      const isSafe = correct === column
      const className = wasPicked
        ? isCorrect && (round?.status !== 'settled' || isSafe) ? 'border-emerald-200/25 bg-emerald-200/[0.08] text-emerald-100' : isCorrect ? 'border-rose-200/25 bg-rose-200/[0.08] text-rose-100' : isSafe && round?.status === 'settled' ? 'border-emerald-200/15 bg-emerald-200/[0.04] text-emerald-100/55' : 'border-white/[0.06] bg-white/[0.02] text-white/10'
        : 'border-white/[0.08] bg-white/[0.035] text-white/20 hover:border-amber-100/30 hover:bg-amber-100/[0.05]'
      return <button key={column} type="button" aria-label={`Row ${row + 1}, column ${column + 1}${isCorrect ? ', selected' : ''}`} disabled={!activeRow || pending || !round} onClick={() => onPick(column)} className={`h-9 rounded-lg border text-sm font-bold transition disabled:cursor-default ${className}`}>{isCorrect || (round?.status === 'settled' && isSafe) ? '◆' : '◇'}</button>
    })}</div>
  })}</div></div>
}

function payoutMultiplier(slug: 'mines' | 'towers', picks: number, mineCount: number, rtpBps: number) {
  return payoutMultiplierForSafePicks(slug, picks, mineCount, rtpBps)
}

function gameDescription(slug: GameRtpSetting['slug']) {
  if (slug === 'crash') return 'Watch the multiplier climb, then cash out before the server-generated crash point.'
  if (slug === 'towers') return 'Pick one of three columns per row. One wrong pick ends the round; every safe row grows your payout.'
  if (slug === 'mines') return 'Pick the mine count, reveal safe tiles, and cash out before you uncover a mine.'
  if (slug === 'donut-division') return 'Match symbols from the left across 25 paylines and choose a bonus investigation when scatters land.'
  return 'Crack the doors. Beat the alarm. Choose your escape.'
}
