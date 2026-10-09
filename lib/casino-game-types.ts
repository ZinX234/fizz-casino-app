import type { VaultHeistOutcome } from '@/lib/vault-heist-config'
import type { SweetBonanzaSymbol } from '@/lib/sweet-bonanza-config'

export type CasinoGameSlug = 'crash' | 'towers' | 'mines' | 'vault-heist' | 'sweet-bonanza'

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
  sweetBonanza?: {
    profileId: string
    profileName: string
    grid: string[][]
    winningSymbol: SweetBonanzaSymbol | null
    symbolCount: number
    baseMultiplier: number
    finalMultiplier: number
    isBonusTriggered?: boolean
    bonusSpinsRemaining?: number
    bonusMultiplier?: number
    isBonusRound?: boolean
    currentBonusSpin?: number
    bonusTotalPayout?: number
  }
}

export type GameRtpSetting = {
  slug: CasinoGameSlug
  name: string
  houseEdgeBps: number
  rtpBps: number
}
