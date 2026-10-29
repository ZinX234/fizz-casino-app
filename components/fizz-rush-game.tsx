'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameRtpSetting } from '@/lib/casino-game-types'
import { wallet } from '@/game/fizz-rush/wallet'
import { settingsStore, useSettings } from '@/game/fizz-rush/settings'
import { GAME_CONFIG, getDifficulty } from '@/game/fizz-rush/config'
import { Game } from '@/game/fizz-rush/engine/game'
import GameHud from '@/game/fizz-rush/components/GameHud'
import PauseOverlay from '@/game/fizz-rush/components/PauseOverlay'
import GameOverPanel from '@/game/fizz-rush/components/GameOverPanel'
import { cn } from '@/lib/utils'

type Props = {
  setting: GameRtpSetting
  initialRound: any
  initialBalance: string
  currency: string
  playerName: string
}

export function FizzRushGame({ setting, initialRound, initialBalance, currency, playerName }: Props) {
  const settings = useSettings()
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<any>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const [hud, setHud] = useState<any>(null)
  const [phase, setPhase] = useState<'intro' | 'setup' | 'running' | 'paused' | 'over'>('intro')
  const [notices, setNotices] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const [fatal, setFatal] = useState<string | null>(null)

  const difficulty = initialRound?.fizzRush?.difficulty || setting?.difficulty || 'hard'
  const bet = initialRound?.fizzRush?.wagerCents || setting?.betCents || 100
  const mode = initialRound?.fizzRush?.mode || 'real'

  const balance = Number(initialBalance || 0)
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

  const settleRun = useCallback(
    async (res: any) => {
      setResult(res)
      setPhase('over')

      if (res.mode === 'real' && res.payout?.credited > 0) {
        wallet.credit(res.payout.credited)
      }
    },
    []
  )

  useEffect(() => {
    if (phase !== 'running') return
    if (!mountRef.current) return

    const game = new Game(mountRef.current, {
      mode,
      difficulty,
      bet,
      rtpBps: setting?.rtpBps || 9500,
      houseEdgeBps: setting?.houseEdgeBps || 500,
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
      game.play()
    } catch {
      setFatal('This device could not start the 3D renderer.')
      return
    }
    gameRef.current = game

    return () => {
      timersRef.current.forEach((id) => clearTimeout(id))
      timersRef.current = []
      game.dispose()
      gameRef.current = null
    }
  }, [phase === 'running', mode, difficulty, bet, setting, pushNotice])

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
    setFatal(null)
    setResult(null)
    setPhase('running')
  }, [])

  const retry = useCallback(() => {
    setResult(null)
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
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0d1117] px-6 text-white">
        <h2 className="text-2xl font-bold">Choose your wager</h2>
        <div className="text-sm text-white/50">
          Balance: {balance.toLocaleString()} {currency || 'FC'}
        </div>
        <button
          onClick={start}
          disabled={isReal && balance * 100 < bet}
          className="rounded-full bg-[#FFD700] px-12 py-3 font-bold text-black shadow-lg transition hover:scale-105"
        >
          {isReal ? `Stake ${bet.toLocaleString()} FC and run` : 'Start free demo run'}
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

    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0d1117] px-6 text-white">
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
        <div className="flex gap-4">
          <button
            onClick={retry}
            className="rounded-full bg-[#FFD700] px-8 py-3 font-bold text-black transition hover:scale-105"
          >
            Play Again
          </button>
        </div>
      </div>
    )
  }

  // ─── RUNNING / PAUSED screen ──────────────────────────────────────────────────
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
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
          canRestart={true}
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

