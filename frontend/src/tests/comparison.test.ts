import investments from '../../../data/investments.json'
import customers from '../../../data/customers.json'
import marketData from '../../../data/market_data.json'
import { describe, expect, it } from 'vitest'
import { comparePerformance } from '../utils/comparison'
import { DEMO_BENCHMARKS, relevantBenchmarks, type Benchmark } from '../data/demoBenchmarks'

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


describe('geographic reference selection', () => {
  it('shows only markets in the allocation, ordered by exposure', () => {
    const refs = relevantBenchmarks([
      { label: 'Finland', percentage: 30, value: 300 },
      { label: 'Global', percentage: 70, value: 700 },
      { label: 'Norway', percentage: 0, value: 0 },
    ])
    expect(refs.map((ref) => ref.id)).toEqual(['global', 'finland'])
    expect(refs.map((ref) => ref.allocationPct)).toEqual([70, 30])
  })
  it('offers broad US and Nasdaq alternatives only for US exposure', () => {
    expect(relevantBenchmarks([{ label: 'United States', percentage: 100, value: 100 }]).map((ref) => ref.id)).toEqual(['sp500', 'nasdaq'])
    expect(relevantBenchmarks([{ label: 'Norway', percentage: 100, value: 100 }]).map((ref) => ref.id)).toEqual(['oslo'])
  })
  it('covers the observed geographies of all 100 synthetic customers', () => {
    for (const customer of customers) {
      const values = new Map<string, number>()
      for (const holding of investments.filter((holding) => holding.customer_id === customer.customer_id)) {
        values.set(holding.geography, (values.get(holding.geography) ?? 0) + holding.quantity * holding.current_price)
      }
      const total = [...values.values()].reduce((sum, value) => sum + value, 0)
      const allocation = [...values].map(([label, value]) => ({ label, value, percentage: value / total * 100 }))
      const refs = relevantBenchmarks(allocation)
      expect(new Set(refs.map((ref) => ref.geography))).toEqual(new Set(values.keys()))
      expect(refs.every((ref) => ref.series.length === 90)).toBe(true)
    }
  })
  it('derives the Oslo demo basket from actual fictional Norwegian stock prices', () => {
    const firstDate = '2026-06-09'
    const lastDate = '2026-09-06'
    const start = marketData.filter((point) => point.geography === 'Norway' && point.date === firstDate && !['Cash', 'Government Bonds', 'Corporate Bonds'].includes(point.sector))
    const ratios = start.map((point) => {
      const end = marketData.find((candidate) => candidate.ticker === point.ticker && candidate.date === lastDate)!
      return end.price / point.price
    })
    const oslo = DEMO_BENCHMARKS.find((ref) => ref.id === 'oslo')!
    expect(oslo.series[0].value).toBeCloseTo(100)
    expect(oslo.series.at(-1)!.value).toBeCloseTo(100 * ratios.reduce((sum, value) => sum + value, 0) / ratios.length)
  })
  it('does not invent a market for empty or unknown geographies', () => {
    expect(relevantBenchmarks([])).toEqual([])
    expect(relevantBenchmarks([{ label: 'Unknown', value: 100, percentage: 100 }])).toEqual([])
  })
})
