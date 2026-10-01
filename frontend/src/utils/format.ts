export function formatCurrency(value: number, currency = 'NOK'): string {
  return `${Math.round(value).toLocaleString('en-US')} ${currency}`
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`
}

// Percentage points (difference between two percentages), e.g. "+1.9 pts".
export function formatPoints(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} pts`
}
