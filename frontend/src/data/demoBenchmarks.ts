import type { PerformancePoint } from '../api/types'

export interface Benchmark {
  id: string
  name: string
  index: string
  color: string
  series: PerformancePoint[]
}

// Fixed fictional fixtures, independent of the selected customer's holdings.
// These are not historical prices for the named indices.
function demoHistory(seed: number, drift: number, volatility: number): PerformancePoint[] {
  let state = seed
  let value = 100
  return Array.from({ length: 90 }, (_, day) => {
    const date = new Date(Date.UTC(2026, 5, 9 + day)).toISOString().slice(0, 10)
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    if (day > 0) value *= 1 + drift + (state / 4294967296 - 0.5) * volatility
    return { date, value }
  })
}

export const DEMO_BENCHMARKS: Benchmark[] = [
  { id: 'nasdaq', name: 'Nasdaq', index: 'Nasdaq Composite', color: '#7c3aed', series: demoHistory(17, 0.0008, 0.026) },
  { id: 'oslo', name: 'Oslo Børs', index: 'OSEBX', color: '#d97706', series: demoHistory(42, 0.0003, 0.018) },
  { id: 'sp500', name: 'S&P 500', index: 'S&P 500', color: '#059669', series: demoHistory(89, 0.0005, 0.016) },
  { id: 'europe', name: 'Europa', index: 'STOXX Europe 600', color: '#db2777', series: demoHistory(123, 0.0002, 0.014) },
  { id: 'nordic', name: 'Norden', index: 'OMX Nordic 40', color: '#0891b2', series: demoHistory(321, 0.0004, 0.018) },
]
