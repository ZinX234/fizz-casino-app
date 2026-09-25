const currencySymbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

export function formatMoney(amount: string, currency = 'USD') {
  const symbol = currencySymbols[currency]
  const value = Number(amount)
  if (!Number.isFinite(value)) return 'Balance unavailable'
  return symbol ? `${symbol}${value.toFixed(2)}` : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}
