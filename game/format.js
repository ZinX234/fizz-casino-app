// Display helpers.

export function formatCoins(value) {
  const amount = Number.isFinite(value) ? value : 0;
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMultiplier(value) {
  return `${Math.round(value).toLocaleString('en-US')}x`;
}