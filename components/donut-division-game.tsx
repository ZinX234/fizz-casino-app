'use client'

import Link from 'next/link'
import { useState } from 'react'
import GameScreen from '@/components/game/GameScreen'
import IntroScreen from '@/components/game/IntroScreen'
import ModeSelect from '@/components/game/ModeSelect'
import type { GameRoundView, GameRtpSetting } from '@/lib/casino-game-types'

type Props = {
  setting: GameRtpSetting
  initialRound: GameRoundView | null
  initialBalance: string
  currency: string
  playerName: string
}

export function DonutDivisionGame({ setting, initialRound, initialBalance, currency, playerName }: Props) {
  const [screen, setScreen] = useState(initialRound ? 'game' : 'intro')
  const [demo, setDemo] = useState(false)

  return (
    <>
      <Link
        href="/casino"
        onClick={(event) => event.stopPropagation()}
        className="fixed right-3 top-3 z-[70] rounded-full border-2 border-[#151515] bg-[#FFF6E2]/95 px-3 py-1.5 font-body text-[10px] font-extrabold uppercase tracking-wide text-[#151515] shadow-[0_3px_0_#151515]"
      >
        Back to Fizz Casino
      </Link>
      {screen === 'intro' ? (
        <IntroScreen onContinue={() => setScreen('mode')} />
      ) : screen === 'mode' ? (
        <ModeSelect
          onReal={() => {
            setDemo(false)
            setScreen('game')
          }}
          onDemo={() => {
            setDemo(true)
            setScreen('game')
          }}
          onBack={() => setScreen('intro')}
        />
      ) : (
        <GameScreen
          key={demo ? 'demo' : 'real'}
          demo={demo}
          onExit={() => setScreen('mode')}
          initialRound={demo ? null : initialRound}
          initialBalance={initialBalance}
          rtpBps={setting.rtpBps}
          currency={currency}
        />
      )}
    </>
  )
}
