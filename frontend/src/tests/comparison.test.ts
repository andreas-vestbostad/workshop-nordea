import { describe, expect, it } from 'vitest'
import { comparePerformance } from '../utils/comparison'
import { DEMO_BENCHMARKS, type Benchmark } from '../data/demoBenchmarks'

const benchmark: Benchmark = {
  id: 'test', name: 'Test', index: 'Test', color: '#000',
  series: [
    { date: '2026-06-09', value: 100 },
    { date: '2026-06-10', value: 120 },
    { date: '2026-06-11', value: 90 },
  ],
}

describe('portfolio comparison', () => {
  it('compares different starting amounts as percentage changes on the same dates', () => {
    const result = comparePerformance([
      { date: '2026-06-10', value: 10000 },
      { date: '2026-06-11', value: 11000 },
    ], [benchmark])
    expect(result[0].portfolio).toBe(0)
    expect(result[0].test).toBe(0)
    expect(result[1].portfolio).toBeCloseTo(10)
    expect(result[1].test).toBeCloseTo(-25)
  })
  it('leaves a gap for missing prices rather than inserting a made-up return', () => {
    const result = comparePerformance([
      { date: '2026-06-09', value: 100 },
      { date: '2026-06-12', value: 105 },
    ], [benchmark])
    expect(result[1].test).toBeNull()
    expect(result[1].portfolio).toBeCloseTo(5)
  })
  it('does not compare an index without the matching start date', () => {
    expect(comparePerformance([{ date: '2026-06-08', value: 100 }], [benchmark])[0].test).toBeNull()
  })
  it('handles empty portfolios and zero start values', () => {
    expect(comparePerformance([], [benchmark])).toEqual([])
    expect(comparePerformance([{ date: '2026-06-09', value: 0 }], [benchmark])).toEqual([])
  })
  it('keeps demo index returns independent of customer portfolio values', () => {
    const dates = ['2026-06-09', '2026-09-06']
    const first = comparePerformance(dates.map((date, i) => ({ date, value: 100 + i })), DEMO_BENCHMARKS)
    const second = comparePerformance(dates.map((date, i) => ({ date, value: 9000 + i * 3000 })), DEMO_BENCHMARKS)
    for (const index of DEMO_BENCHMARKS) {
      expect(first[0][index.id]).toBe(0)
      expect(first[1][index.id]).toBe(second[1][index.id])
      expect(typeof first[1][index.id]).toBe('number')
    }
  })
})
