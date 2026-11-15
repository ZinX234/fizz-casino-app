'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameRoundView, GameRtpSetting } from '@/lib/casino-game-types'
import { settingsStore, useSettings } from '@/game/fizz-rush/settings'
import { GAME_CONFIG } from '@/game/fizz-rush/config'
import { Game } from '@/game/fizz-rush/engine/game'
import GameHud from '@/game/fizz-rush/components/GameHud'
import PauseOverlay from '@/game/fizz-rush/components/PauseOverlay'
import { formatFizzcoins } from '@/lib/format-money'

type Props = {
  setting: GameRtpSetting
  initialRound: GameRoundView | null
  initialBalance: string
  currency: string
  playerName: string
}

export function FizzRushGame({ setting, initialRound, initialBalance, currency, playerName }: Props) {
  const settings = useSettings()
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<any>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const roundRef = useRef<GameRoundView | null>(initialRound)
  const runResultRef = useRef<any>(null)
  const startRequestIdRef = useRef<string | null>(null)
  const settlementRequestIdRef = useRef<string | null>(null)
  const requestInFlightRef = useRef(false)

  const [hud, setHud] = useState<any>(null)
  const [phase, setPhase] = useState<'intro' | 'setup' | 'starting' | 'running' | 'paused' | 'over'>('intro')
  const phaseRef = useRef(phase)
  const [notices, setNotices] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [settlementError, setSettlementError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [round, setRound] = useState<GameRoundView | null>(initialRound)
  const [balance, setBalance] = useState(initialBalance)

  phaseRef.current = phase
  const difficulty = initialRound?.fizzRush?.difficulty || setting?.difficulty || 'hard'
  const bet = initialRound?.fizzRush?.wagerCents
    ? Number(initialRound.fizzRush.wagerCents) * 4
    : 100
  const mode = round?.fizzRush?.mode || 'real'

  roundRef.current = round
  const balanceInFizzcoins = Number(balance || 0) * 400
  const isReal = mode === 'real'

  const pushNotice = useCallback((notice: any) => {
    if (!notice?.text) return
    if (notice.tone === 'danger') setNotices((list) => [...list, { id: Date.now(), text: 'Flash notice', tone: 'danger' }])
    setNotices((list) => [...list.slice(-2), notice])
    const id = setTimeout(() => {
      setNotices((list) => list.filter((n) => n.id !== notice.id))
    }, 2600)
    timersRef.current.push(id)
  }, [])

  const settleRun = useCallback(async (res: any) => {
    runResultRef.current = res
    setResult({ ...res, payout: { ...res.payout, credited: 0, multiplier: 0 } })
    setPhase('over')
    setSettlementError(null)

    if (res.mode !== 'real') return

    const activeRound = roundRef.current
    if (!activeRound || activeRound.status !== 'active') {
      setSettlementError('The active server round could not be found. Your wallet was not credited.')
      return
    }

    if (requestInFlightRef.current) return
    requestInFlightRef.current = true
    setPending(true)

    const wager = Number(res.payout?.bet || bet)
    const credited = Number(res.payout?.credited || 0)
    const rawMultiplier = wager > 0 && Number.isFinite(credited)
      ? Math.min(GAME_CONFIG.payout.maxPayoutMultiplier, Math.max(0, credited / wager))
      : 0
    const requestId = settlementRequestIdRef.current ?? crypto.randomUUID()
    settlementRequestIdRef.current = requestId

    try {
      const response = await fetch('/api/games/fizz-rush/play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'cashout',
          sessionId: activeRound.sessionId,
          position: rawMultiplier,
          requestId,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Fizz Rush could not settle this run.')
      if (payload.round?.status !== 'settled') {
        throw new Error('Fizz Rush did not return a settled round. Retry settlement to safely complete it.')
      }

      const payoutUsd = Number(payload.round.payout)
      if (!Number.isFinite(payoutUsd) || payoutUsd < 0) {
        throw new Error('Fizz Rush returned an invalid payout. Retry settlement to safely complete it.')
      }

      roundRef.current = payload.round
      setRound(payload.round)
      if (payload.wallet?.balance !== undefined && payload.wallet?.balance !== null) {
        setBalance(String(payload.wallet.balance))
      }
      const creditedFizzcoins = Math.floor(payoutUsd * 400 + 1e-8)
      setResult((current: any) => current ? {
        ...current,
        payout: {
          ...current.payout,
          credited: creditedFizzcoins,
          multiplier: wager > 0 ? creditedFizzcoins / wager : 0,
        },
      } : current)
    } catch (issue) {
      setSettlementError(issue instanceof Error ? issue.message : 'Fizz Rush could not settle this run.')
    } finally {
      requestInFlightRef.current = false
      setPending(false)
    }
  }, [bet])

  const settleInterruptedRound = useCallback(async () => {
    const activeRound = roundRef.current
    if (!activeRound || activeRound.status !== 'active' || requestInFlightRef.current) return

    requestInFlightRef.current = true
    setPending(true)
    const requestId = settlementRequestIdRef.current ?? crypto.randomUUID()
    settlementRequestIdRef.current = requestId

    try {
      const response = await fetch('/api/games/fizz-rush/play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'cashout',
          sessionId: activeRound.sessionId,
          position: 0,
          requestId,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'The interrupted Fizz Rush round could not be settled.')
      if (payload.round?.status !== 'settled' || Number(payload.round.payout) !== 0) {
        throw new Error('The interrupted Fizz Rush round did not settle as expected.')
      }

      roundRef.current = payload.round
      setRound(payload.round)
      if (payload.wallet?.balance !== undefined && payload.wallet?.balance !== null) {
        setBalance(String(payload.wallet.balance))
      }
      setError('The interrupted run was settled with no payout.')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The interrupted Fizz Rush round could not be settled.')
    } finally {
      requestInFlightRef.current = false
      setPending(false)
    }
  }, [])

  const shouldMountGame = phase === 'starting' || phase === 'running' || phase === 'paused'
  useEffect(() => {
    if (!shouldMountGame) return
    if (!mountRef.current) return

    let active = true
    const game = new Game(mountRef.current, {
      mode,
      difficulty,
      bet,
      characterId: 'fizz',
      trailId: 'spark',
      prestige: 0,
      settings: settingsStore.get(),
      onHud: (snapshot: any) => setHud(snapshot),
      onNotice: (notice: any) => pushNotice(notice),
      onStateChange: (state: string, payload: any) => {
        if (state === 'paused') setPhase('paused')
        else if (state === 'running') setPhase('running')
        else if (state === 'over') setPhase('over')
        else if (state === 'quality' && payload) settingsStore.setQuality(payload)
      },
      onGameOver: (res: any) => settleRun(res),
    })

    try {
      game.init()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The 3D renderer could not be initialized.')
      setPhase('setup')
      setPending(false)
      return
    }
    gameRef.current = game

    const launch = async () => {
      const existingRound = roundRef.current
      if (existingRound?.status === 'active') {
        setError('An interrupted Fizz Rush round must be settled before a new run can begin.')
        setPhase('setup')
        setPending(false)
        return
      }

      const wagerCents = bet / 4
      if (!Number.isSafeInteger(wagerCents) || wagerCents < 25 || wagerCents > 10_000) {
        setError('Fizz Rush wagers must be between 100 and 40,000 Fizzcoins.')
        setPhase('setup')
        setPending(false)
        return
      }

      try {
        const requestId = startRequestIdRef.current ?? crypto.randomUUID()
        startRequestIdRef.current = requestId
        const response = await fetch('/api/games/fizz-rush/play', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'start',
            requestId,
            wagerCents,
            expectedRtpBps: setting.rtpBps,
          }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ?? 'Fizz Rush could not start this round.')
        if (payload.round?.status !== 'active') {
          throw new Error('Fizz Rush did not return an active round.')
        }
        if (!active) return

        roundRef.current = payload.round
        setRound(payload.round)
        if (payload.wallet?.balance !== undefined && payload.wallet?.balance !== null) {
          setBalance(String(payload.wallet.balance))
        }
        startRequestIdRef.current = null
        settlementRequestIdRef.current = null
        game.play()
        setPhase('running')
      } catch (issue) {
        if (active) {
          setError(issue instanceof Error ? issue.message : 'Fizz Rush could not start this round.')
          setPhase('setup')
        }
      } finally {
        if (active) setPending(false)
      }
    }

    if (phaseRef.current === 'starting') void launch()
    else game.play()

    return () => {
      active = false
      timersRef.current.forEach((id) => clearTimeout(id))
      timersRef.current = []
      game.dispose()
      gameRef.current = null
    }
  }, [shouldMountGame, mode, difficulty, bet, setting.rtpBps, pushNotice, settleRun])

  useEffect(() => {
    const game = gameRef.current
    if (!game) return
    game.settings = { ...game.settings, ...settings }
    game.audio?.applyVolumes(settings.audio)
  }, [settings])

  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) gameRef.current?.pause()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [])

  const start = useCallback(() => {
    if (pending) return
    if (roundRef.current?.status === 'active') {
      void settleInterruptedRound()
      return
    }
    setError(null)
    setSettlementError(null)
    setResult(null)
    runResultRef.current = null
    setPending(true)
    setPhase('starting')
  }, [pending, settleInterruptedRound])

  const retry = useCallback(() => {
    setResult(null)
    setError(null)
    setPhase('setup')
  }, [])


  if (phase === 'intro') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#0d1117] text-white">
        <div className="flex flex-col items-center gap-6 px-6 py-12 text-center">
          <h1 className="font-display text-5xl font-black tracking-tight text-[#FFD700]">FIZZ RUSH</h1>
          <p className="max-w-xs text-sm text-white/60">
            An endless tropical runner. Run as far as you can before the island claims you.
          </p>
          <button
            onClick={() => setPhase('setup')}
            className="mt-4 rounded-full bg-[#FFD700] px-10 py-3 font-bold text-black shadow-lg transition hover:scale-105"
          >
            Play
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'setup') {
    const hasActiveRound = round?.status === 'active'
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0d1117] px-6 text-white">
        <h2 className="text-2xl font-bold">Choose your wager</h2>
        <div className="text-sm text-white/50">
          Balance: {formatFizzcoins(balance, currency)}
        </div>
        <button
          onClick={start}
          disabled={pending || (isReal && !hasActiveRound && balanceInFizzcoins < bet)}
          className="rounded-full bg-[#FFD700] px-12 py-3 font-bold text-black shadow-lg transition hover:scale-105"
        >
          {pending
            ? hasActiveRound ? 'Settling interrupted run…' : 'Starting…'
            : hasActiveRound ? 'Settle interrupted run (no payout)' : isReal ? `Stake ${bet.toLocaleString()} FC and run` : 'Start free demo run'}
        </button>
        {hasActiveRound && <p className="max-w-md text-center text-xs text-white/50">Run progress cannot be restored after leaving this page. Settle the interrupted wager before starting another run.</p>}
        {error && <p role="alert" className="max-w-md text-center text-sm text-red-300">{error}</p>}
        <button onClick={() => setPhase('intro')} className="text-xs text-white/30 hover:text-white/60">
          Back
        </button>
      </div>
    )
  }

  // ─── GAME OVER screen ────────────────────────────────────────────────────────
  if (phase === 'over' && result) {
    const payout = result.payout ?? {}

    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0d1117] px-6 text-white">
        <h2 className="text-3xl font-black text-[#FFD700]">
          {pending ? 'Settling payout…' : payout.credited > 0 ? 'You won!' : 'Game Over'}
        </h2>
        <div className="flex flex-col items-center gap-1 text-sm text-white/60">
          <span>{Math.round(result.distance ?? 0).toLocaleString()} m</span>
          {!pending && <span>Multiplier: {(payout.multiplier ?? 0).toFixed(2)}×</span>}
          {payout.credited > 0 && (
            <span className="text-lg font-bold text-[#FFD700]">
              +{Math.round(payout.credited).toLocaleString()} FC
            </span>
          )}
        </div>
        {settlementError ? (
          <div className="flex flex-col items-center gap-3">
            <p role="alert" className="max-w-md text-center text-sm text-red-300">{settlementError}</p>
            <button
              onClick={() => void settleRun(runResultRef.current)}
              disabled={pending}
              className="rounded-full bg-[#FFD700] px-8 py-3 font-bold text-black transition hover:scale-105 disabled:opacity-50"
            >
              {pending ? 'Retrying settlement…' : 'Retry settlement'}
            </button>
          </div>
        ) : pending ? (
          <p role="status" className="text-sm text-white/60">Settling your payout…</p>
        ) : (
          <button
            onClick={retry}
            className="rounded-full bg-[#FFD700] px-8 py-3 font-bold text-black transition hover:scale-105"
          >
            Play Again
          </button>
        )}
      </div>
    )
  }

  // ─── STARTING / RUNNING / PAUSED screen ───────────────────────────────────────
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <div ref={mountRef} className="h-full w-full" />
      {phase === 'starting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
          Preparing your round…
        </div>
      )}
      {hud && phase === 'running' && (
        <GameHud
          hud={hud}
          notices={notices}
          onPause={() => setPhase('paused')}
          showTouch={false}
          onAction={() => {}}
          large={false}
        />
      )}
      {phase === 'paused' && gameRef.current && (
        <PauseOverlay
          onResume={() => { gameRef.current?.resume(); setPhase('running') }}
          onRestart={() => gameRef.current?.finish('restart')}
          onQuit={() => gameRef.current?.finish('quit')}
          canRestart={true}
        />
      )}
    </div>
  )
}

