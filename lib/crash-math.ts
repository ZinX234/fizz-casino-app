export function crashMultiplierAtElapsed(elapsedSeconds: number) {
  const safeElapsedSeconds = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0
  return Math.floor((1 + safeElapsedSeconds * 0.2) * 100) / 100
}
