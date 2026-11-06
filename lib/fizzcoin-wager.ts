const FIZZCOINS_PER_CENT = 4
const MIN_WAGER_FIZZCOINS = 400
const MAX_WAGER_FIZZCOINS = 40_000

export function wagerCentsFromFizzcoins(wagerFizzcoins: number) {
  if (!Number.isSafeInteger(wagerFizzcoins)
    || wagerFizzcoins < MIN_WAGER_FIZZCOINS
    || wagerFizzcoins > MAX_WAGER_FIZZCOINS
    || wagerFizzcoins % FIZZCOINS_PER_CENT !== 0) {
    throw new RangeError('Choose a wager from 400 to 40,000 Fizzcoins in increments of 4.')
  }
  return wagerFizzcoins / FIZZCOINS_PER_CENT
}
