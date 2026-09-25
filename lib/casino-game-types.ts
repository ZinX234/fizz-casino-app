export type CasinoGameSlug = 'crash' | 'towers' | 'mines'

export type GameRoundView = {
  sessionId: string
  slug: CasinoGameSlug
  status: 'active' | 'settled'
  result: 'win' | 'loss' | null
  wager: string
  payout: string
  startedAt: string
  commitment: string
  clientSeed: string
  houseEdgeBps: number
  rtpBps: number
  picks: number[]
  mineCount?: number
  revealedMines?: number[]
  revealedSafeColumns?: number[]
  crashPoint?: number
  cashoutMultiplier?: number
  fairness?: { serverSeed: string; clientSeed: string; commitment: string }
}

export type GameRtpSetting = {
  slug: CasinoGameSlug
  name: string
  houseEdgeBps: number
  rtpBps: number
}
