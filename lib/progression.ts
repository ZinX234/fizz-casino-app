export type PlayerProgression = {
  totalXp: number
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  progressPercent: number
}

const XP_PER_LEVEL_STEP = 100

export function getPlayerProgression(totalXp: number): PlayerProgression {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0
  const level = Math.floor((Math.sqrt(1 + (8 * xp) / XP_PER_LEVEL_STEP) - 1) / 2) + 1
  const xpAtLevelStart = (XP_PER_LEVEL_STEP * level * (level - 1)) / 2
  const xpForNextLevel = XP_PER_LEVEL_STEP * level
  const xpIntoLevel = xp - xpAtLevelStart

  return {
    totalXp: xp,
    level,
    xpIntoLevel,
    xpForNextLevel,
    progressPercent: Math.min(100, Math.max(0, (xpIntoLevel / xpForNextLevel) * 100)),
  }
}

export function xpForFizzcoinWager(wagerCents: number) {
  return Math.floor(wagerCents / 25)
}
