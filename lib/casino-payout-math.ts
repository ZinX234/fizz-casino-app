import type { CasinoGameSlug } from '@/lib/casino-game-types'

export function payoutMultiplierForSafePicks(slug: Extract<CasinoGameSlug, 'mines' | 'towers'>, picks: number, mineCount: number, rtpBps: number) {
  let survivalProbability = 1
  if (slug === 'towers') {
    survivalProbability = (1 / 3) ** picks
  } else {
    for (let index = 0; index < picks; index++) {
      survivalProbability *= (25 - mineCount - index) / (25 - index)
    }
  }

  return Math.floor(((rtpBps / 10_000) / survivalProbability) * 100 + 1e-8) / 100
}
