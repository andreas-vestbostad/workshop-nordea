import type { PerformancePoint } from '../api/types'
import type { Benchmark } from '../data/demoBenchmarks'

export interface ComparisonPoint {
  date: string
  portfolio: number
  value: number
  [key: string]: number | string | null
}

export function comparePerformance(series: PerformancePoint[], benchmarks: Benchmark[]): ComparisonPoint[] {
  const baseline = series[0]?.value
  if (!baseline || !Number.isFinite(baseline) || baseline <= 0) return []
  const histories = benchmarks.map((benchmark) => ({
    id: benchmark.id,
    prices: new Map(benchmark.series.map((point) => [point.date, point.value])),
  }))
  return series.map((point) => {
    const row: ComparisonPoint = {
      date: point.date,
      value: point.value,
      portfolio: ((point.value / baseline) - 1) * 100,
    }
    for (const history of histories) {
      const start = history.prices.get(series[0].date)
      const price = history.prices.get(point.date)
      row[history.id] = start !== undefined && Number.isFinite(start) && start > 0
        && price !== undefined && Number.isFinite(price) && price > 0
        ? ((price / start) - 1) * 100
        : null
    }
    return row
  })
}
