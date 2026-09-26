const currencySymbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

export function formatFizzcoins(usdAmount: string, currency = 'USD') {
  const value = Number(usdAmount)
  if (!Number.isFinite(value)) return 'Balance unavailable'
  if (currency !== 'USD') return 'USD wallet required for Fizzcoins'
  const coins = Math.round(value * 400)
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(coins)
  return `${formatted} ${coins === 1 ? 'Fizzcoin' : 'Fizzcoins'}`
}

export function formatMoney(amount: string, currency = 'USD') {
  const symbol = currencySymbols[currency]
  const value = Number(amount)
  if (!Number.isFinite(value)) return 'Balance unavailable'
  return symbol ? `${symbol}${value.toFixed(2)}` : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}
