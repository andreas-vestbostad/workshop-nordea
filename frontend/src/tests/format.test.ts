import { describe, expect, it } from 'vitest'
import { formatCurrency, formatPercentage, formatPoints } from '../utils/format'

describe('formatCurrency', () => {
  it('rounds and formats with the default currency', () => {
    expect(formatCurrency(1234.56)).toBe('1,235 NOK')
  })

  it('supports a custom currency', () => {
    expect(formatCurrency(1000, 'USD')).toBe('1,000 USD')
  })
})

describe('formatPercentage', () => {
  it('adds a plus sign for non-negative values', () => {
    expect(formatPercentage(4.2)).toBe('+4.2%')
    expect(formatPercentage(0)).toBe('+0%')
  })

  it('keeps the minus sign for negative values', () => {
    expect(formatPercentage(-3.1)).toBe('-3.1%')
  })

  it('rounds to a fixed number of decimals when asked', () => {
    expect(formatPercentage(4.87, 1)).toBe('+4.9%')
    expect(formatPercentage(-3.72, 1)).toBe('-3.7%')
  })
})

describe('formatPoints', () => {
  it('shows percentage points with one decimal and no percent sign', () => {
    expect(formatPoints(1.94)).toBe('+1.9 pts')
    expect(formatPoints(-2.8)).toBe('-2.8 pts')
  })
})
