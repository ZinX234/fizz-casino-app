'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameRoundView, GameRtpSetting } from '@/lib/casino-game-types'
import { GAME_CONFIG, getDifficulty } from '@/game/fizz-rush/game/config'
import { wallet } from '@/game/fizz-rush/game/wallet'
import { settingsStore, useSettings } from '@/game/fizz-rush/game/settings'
import { useProfile, commitRun } from '@/game/fizz-rush/hooks/useProfile'
import GameHud from '@/game/fizz-rush/components/game/GameHud'
import PauseOverlay from '@/game/fizz-rush/components/game/PauseOverlay'
import { cn } from '@/lib/utils'

// Lazily import the Game class (Three.js) — SSR-safe
let GameClass: any = null
async function loadGameClass() {
  if (!GameClass) {
    const mod = await import('@/game/fizz-rush/game/engine/game')
    GameClass = mod.Game
  }
  return GameClass
}

type Props = {
  setting: GameRtpSetting
  initialRound: GameRoundView | null
  initialBalance: string
  currency: string
  playerName: string
}

const BET_PRESETS_CENTS = [100, 500, 1000, 2500, 5000, 10000]
const DEFAULT_DIFFICULTY = GAME_CONFIG.defaults?.difficulty ?? 'normal'

export function FizzRushGame({ setting, initialRound, initialBalance, currency, playerName }: Props) {
  const settings = useSettings()
  const { profile } = useProfile()
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<any>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const settleRef = useRef<((res: any) => Promise<void>) | null>(null)

  const [phase, setPhase] = useState<'intro' | 'setup' | 'running' | 'paused' | 'over'>(
    initialRound ? 'running' : 'intro',
  )
  const [hud, setHud] = useState<any>(null)
  const [notices, setNotices] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [flash, setFlash] = useState(0)

  // Casino-specific state
  const [betCents, setBetCents] = useState(BET_PRESETS_CENTS[0])
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY)
  const [balance, setBalance] = useState(Number(initialBalance))
  const [activeRound, setActiveRound] = useState<GameRoundView | null>(initialRound)
  const [settling, setSettling] = useState(false)
  const [proofVisible, setProofVisible] = useState(false)

  // Sync casino wallet balance into the game's wallet module
  useEffect(() => {
    wallet.useAdapter({
      id: 'casino',
      read: () => Math.round(balance),
      write: () => true,
    })
  }, [balance])

  const pushNotice = useCallback((notice: any) => {
    if (!notice?.text) return
    if (notice.tone === 'danger') setFlash(Date.now())
    setNotices((list) => [...list.slice(-2), notice])
    const id = setTimeout(() => {
      setNotices((list) => list.filter((n) => n.id !== notice.id))
    }, 2600)
    timersRef.current.push(id)
  }, [])

  const settleRun = useCallback(
    async (res: any) => {
      setResult(res)
      setPhase('over')
      setSettling(true)

      try {
        if (!activeRound) {
          setSettling(false)
          return
        }
        // Send the raw multiplier to the server; server applies rtpBps scalar
        const rawMultiplier = res.payout?.multiplier ?? 0
        const resp = await fetch(`/api/games/fizz-rush/play`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cashout',
            sessionId: activeRound.sessionId,
            position: rawMultiplier,
          }),
        })
        const data = await resp.json()
        if (data.wallet?.balance !== undefined) {
          const newBalance = Math.round(Number(data.wallet.balance))
          setBalance(newBalance)
          wallet.useAdapter({
            id: 'casino',
            read: () => newBalance,
            write: () => true,
          })
        }
        if (data.round) setActiveRound(data.round)
      } catch {
        // Settle failed — balance unchanged, show error
        pushNotice({ id: Date.now(), text: 'Settlement failed — your wager was returned.', tone: 'danger' })
      } finally {
        setSettling(false)
      }

      try {
        await commitRun({ result: res, difficulty, mode: 'real', displayName: playerName })
      } catch {
        // progression save failure is non-critical
      }
    },
    [activeRound, difficulty, pushNotice],
  )

  settleRef.current = settleRun

  const hasProfile = !!profile

  useEffect(() => {
    if (phase !== 'running') return
    const activeProfile = profile
    if (!activeProfile || gameRef.current || !mountRef.current) return

    let game: any = null
    loadGameClass().then((GameCls) => {
      if (!mountRef.current) return
      game = new GameCls(mountRef.current, {
        mode: 'real',
        difficulty,
        bet: Math.round(betCents / 100),
        characterId: activeProfile.equipped?.character || 'fizz',
        trailId: activeProfile.equipped?.trail || 'spark',
        prestige: activeProfile.prestige || 0,
        settings: settingsStore.get(),
        // Inject lethal checkpoint from the round (distance in metres = checkpoint × 50)
        lethalCheckpoint:
          activeRound?.fizzRush && activeRound.fizzRush.lethalCheckpoint != null
            ? activeRound.fizzRush.lethalCheckpoint * 50
            : null,
        onHud: (snapshot: any) => setHud(snapshot),
        onNotice: (notice: any) => pushNotice(notice),
        onStateChange: (state: string, payload: any) => {
          if (state === 'paused') setPhase('paused')
          else if (state === 'running') setPhase('running')
          else if (state === 'over') setPhase('over')
          else if (state === 'quality' && payload) settingsStore.setQuality(payload)
        },
        onGameOver: (res: any) => settleRef.current?.(res),
      })
      try {
        game.init()
      } catch {
        setFatal('This device could not start the 3D renderer. Try enabling hardware acceleration.')
        return
      }
      gameRef.current = game
    })

    return () => {
      timersRef.current.forEach((id) => clearTimeout(id))
      timersRef.current = []
      game?.dispose()
      gameRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'running', hasProfile])

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

  const startRound = async () => {
    if (betCents < 100) return
    if (balance * 100 < betCents) {
      setFatal('Your balance is too low for this wager.')
      return
    }
    setFatal(null)
    setSettling(true)
    try {
      const requestId = crypto.randomUUID()
      const resp = await fetch(`/api/games/fizz-rush/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          requestId,
          wagerCents: betCents,
          expectedRtpBps: setting.rtpBps,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.round) {
        setFatal(data.error ?? 'Could not start the round.')
        setSettling(false)
        return
      }
      // Deduct wager from displayed balance immediately
      const newBalance = data.wallet?.balance !== undefined
        ? Math.round(Number(data.wallet.balance))
        : balance - Math.round(betCents / 100)
      setBalance(newBalance)
      wallet.useAdapter({
        id: 'casino',
        read: () => newBalance,
        write: () => true,
      })
      setActiveRound(data.round)
      setResult(null)
      setSettling(false)
      setPhase('running')
    } catch {
      setFatal('Could not start the round. Please try again.')
      setSettling(false)
    }
  }

  // ─── INTRO screen ────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#0d1117] text-white">
        <BackButton />
        <div className="flex flex-col items-center gap-6 px-6 py-12 text-center">
          <h1 className="font-display text-5xl font-black tracking-tight text-[#FFD700]">FIZZ RUSH</h1>
          <p className="max-w-xs text-sm text-white/60">
            An endless tropical runner. Run as far as you can before the island claims you.
          </p>
          <div className="flex gap-3 text-xs text-white/40">
            <span>RTP: {(setting.rtpBps / 100).toFixed(1)}%</span>
            <span>·</span>
            <span>House Edge: {(setting.houseEdgeBps / 100).toFixed(1)}%</span>
          </div>
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

  // ─── SETUP screen ────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0d1117] px-6 text-white">
        <BackButton />
        <h2 className="text-2xl font-bold">Choose your wager</h2>
        <div className="text-sm text-white/50">
          Balance: {balance.toLocaleString()} FC
        </div>
        <div className="grid grid-cols-3 gap-3">
          {BET_PRESETS_CENTS.map((cents) => (
            <button
              key={cents}
              onClick={() => setBetCents(cents)}
              className={cn(
                'rounded-xl border-2 px-4 py-3 text-sm font-bold transition',
                betCents === cents
                  ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
                  : 'border-white/10 bg-white/5 text-white hover:border-white/30',
              )}
            >
              {cents / 100} FC
            </button>
          ))}
        </div>
        <div className="flex gap-4">
          {Object.entries(GAME_CONFIG.difficulty ?? {}).map(([id, cfg]: [string, any]) => (
            <button
              key={id}
              onClick={() => setDifficulty(id)}
              className={cn(
                'rounded-xl border-2 px-4 py-2 text-xs font-semibold transition',
                difficulty === id
                  ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
                  : 'border-white/10 bg-white/5 text-white hover:border-white/30',
              )}
            >
              {cfg.name ?? id}
            </button>
          ))}
        </div>
        {fatal && <p className="max-w-xs text-center text-xs text-red-400">{fatal}</p>}
        <button
          onClick={startRound}
          disabled={settling}
          className="rounded-full bg-[#FFD700] px-12 py-3 font-bold text-black shadow-lg transition hover:scale-105 disabled:opacity-50"
        >
          {settling ? 'Starting…' : 'Start Run'}
        </button>
        <button onClick={() => setPhase('intro')} className="text-xs text-white/30 hover:text-white/60">
          Back
        </button>
      </div>
    )
  }

  // ─── GAME OVER screen ────────────────────────────────────────────────────────
  if (phase === 'over' && result) {
    const payout = result.payout ?? {}
    const settled = activeRound?.fizzRush?.settled
    const serverSeed = activeRound?.fizzRush?.serverSeed
    const commitment = activeRound?.fizzRush?.commitment

    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0d1117] px-6 text-white">
        <BackButton />
        <h2 className="text-3xl font-black text-[#FFD700]">
          {payout.credited > 0 ? 'You won!' : 'Game Over'}
        </h2>
        <div className="flex flex-col items-center gap-1 text-sm text-white/60">
          <span>{Math.round(result.distance ?? 0).toLocaleString()} m</span>
          <span>Multiplier: {(payout.multiplier ?? 0).toFixed(2)}×</span>
          {payout.credited > 0 && (
            <span className="text-lg font-bold text-[#FFD700]">
              +{Math.round(payout.credited).toLocaleString()} FC
            </span>
          )}
        </div>
        {settling && <p className="text-xs text-white/40">Settling…</p>}

        {/* Provably Fair section — shown after settlement */}
        {settled && serverSeed && (
          <div className="mt-2 w-full max-w-sm">
            <button
              onClick={() => setProofVisible((v) => !v)}
              className="w-full rounded-lg border border-white/10 px-4 py-2 text-xs text-white/50 hover:border-white/30"
            >
              {proofVisible ? 'Hide' : 'Show'} Provably Fair Proof
            </button>
            {proofVisible && (
              <div className="mt-2 space-y-1 break-all rounded-lg bg-white/5 p-3 text-[10px] text-white/40">
                <p><span className="text-white/60">Commitment:</span> {commitment}</p>
                <p><span className="text-white/60">Server Seed:</span> {serverSeed}</p>
                <p><span className="text-white/60">Client Seed:</span> {activeRound?.clientSeed}</p>
                <p className="text-white/30">
                  Verify: SHA256(serverSeed) should equal commitment.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => { setResult(null); setActiveRound(null); setPhase('setup') }}
            className="rounded-full bg-[#FFD700] px-8 py-3 font-bold text-black transition hover:scale-105"
          >
            Play Again
          </button>
          <Link
            href="/casino"
            className="rounded-full border border-white/20 px-8 py-3 text-sm text-white/60 transition hover:border-white/40"
          >
            Lobby
          </Link>
        </div>
      </div>
    )
  }

  // ─── RUNNING / PAUSED screen ──────────────────────────────────────────────────
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <BackButton />
      <div ref={mountRef} className="h-full w-full" />
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
          onRestart={() => { gameRef.current?.dispose(); gameRef.current = null; setPhase('intro') }}
          onQuit={() => { gameRef.current?.dispose(); gameRef.current = null; setPhase('intro') }}
          canRestart={false}
        />
      )}
      {fatal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <p className="max-w-xs text-center text-sm text-red-400">{fatal}</p>
        </div>
      )}
    </div>
  )
}

function BackButton() {
  return (
    <Link
      href="/casino"
      className="fixed right-3 top-3 z-[70] rounded-full border-2 border-[#151515] bg-[#FFF6E2]/95 px-3 py-1.5 font-body text-[10px] font-extrabold uppercase tracking-wide text-[#151515] shadow-[0_3px_0_#151515]"
    >
      Back to Fizz Casino
    </Link>
  )
}
