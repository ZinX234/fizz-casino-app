import type { VaultHeistOutcome } from '@/lib/vault-heist-config'

export type CasinoGameSlug = 'crash' | 'towers' | 'mines' | 'vault-heist' | 'donut-division' | 'fizz-rush'

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
  vaultHeist?: {
    profileId: string
    profileName: string
    security: number
    securityMax: number
    currentMultiplier: number
    maxMultiplier: number
    masterKeyPending: boolean
    revealedDoors: Array<{ position: number; outcome: VaultHeistOutcome; security: number; multiplier: number }>
    allDoorOutcomes?: VaultHeistOutcome[]
  }
  donutDivision?: {
    grid: string[][]
    lineWins: Array<{ lineIndex: number; symbol: string; count: number; multiplier: number; direction: 'left' | 'right' }>
    scatterCount: number
    bonusStage: 'choose' | 'pick' | null
    bonusChoice: 'sticky' | 'pick' | 'surveillance' | null
    bonusGrids: string[][][]
    bonusMultipliers: number[]
    bonusSpinWins: Array<{ lineWins: Array<{ lineIndex: number; symbol: string; count: number; multiplier: number; direction: 'left' | 'right' }>; rawMultiplier: number }>
    revealedCards: Array<{ position: number; value: number }>
    picksRemaining: number
    feature: 'gooey' | 'maxWin' | null
  }
  fizzRush?: {
    commitment: string
    rtpBps: number
    houseEdgeBps: number
    maxCheckpoints: number
    lethalCheckpoint?: number | null
    serverSeed?: string
    settled: boolean
  }
}

export type GameRtpSetting = {
  slug: CasinoGameSlug
  name: string
  houseEdgeBps: number
  rtpBps: number
  bonusBuyMultiplier?: number
}
