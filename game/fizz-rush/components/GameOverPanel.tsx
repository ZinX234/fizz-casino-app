'use client'

import { useCallback } from 'react'
import { Play, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Props = {
  result: any
  rewards: any
  isBest: boolean
  cloud: boolean
  onRetry: () => void
  onQuit: () => void
  cashOut?: () => void
}

export default function GameOverPanel({ result, rewards, isBest, cloud, onRetry, onQuit, cashOut }: Props) {
  const payout = result?.payout ?? {}
  const distance = Math.round(result?.distance ?? 0)
  const credited = payout.credited ?? 0

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0d1117] px-6 text-white">
      <h2 className="text-3xl font-black text-[#FFD700]">
        {credited > 0 ? 'You won!' : 'Game Over'}
      </h2>
      <div className="flex flex-col items-center gap-1 text-sm text-white/60">
        <span>{distance.toLocaleString()} m</span>
        <span>Multiplier: {(payout.multiplier ?? 0).toFixed(2)}×</span>
        {credited > 0 && (
          <span className="text-lg font-bold text-[#FFD700]">
            +{credited.toLocaleString()} FC
          </span>
        )}
      </div>
      <button
        onClick={onRetry}
        className="rounded-full bg-[#FFD700] px-8 py-3 font-bold text-black transition hover:scale-105"
      >
        <Play className="h-4 w-4 fill-current mr-2" /> Play Again
      </button>
      <Link
        href="/casino"
        className="rounded-full border border-white/20 px-8 py-3 text-sm text-white/60 transition hover:border-white/40"
      >
        <ArrowLeft className="h-3 w-3 mr-1" /> Lobby
      </Link>
    </div>
  )
}