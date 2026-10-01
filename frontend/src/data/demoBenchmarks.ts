import marketData from '../../../data/market_data.json'
import type { AllocationSlice, PerformancePoint } from '../api/types'

export interface Benchmark {
  id: string
  name: string
  index: string
  color: string
  series: PerformancePoint[]
  geography?: string
  sourceUrl?: string
}

const NORDIC_SOURCE = 'https://www.nasdaq.com/products/global-indexes/beta/european-indexes'
const GEOGRAPHY_REFERENCES = [
  { geography: 'Norway', id: 'oslo', name: 'Oslo Børs', index: 'OSEBX', color: '#d97706', sourceUrl: 'https://live.euronext.com/en/markets/oslo/indices/list', regions: ['Norway'] },
  { geography: 'United States', id: 'sp500', name: 'USA · S&P 500', index: 'S&P 500', color: '#059669', sourceUrl: 'https://www.spglobal.com/spdji/en/indices/equity/sp-500/', regions: ['United States'] },
  { geography: 'United States', id: 'nasdaq', name: 'USA · Nasdaq', index: 'Nasdaq-100', color: '#7c3aed', sourceUrl: 'https://indexes.nasdaq.com/Index/Overview/NDX', regions: ['United States'], sector: 'Technology' },
  { geography: 'Nordics', id: 'nordic', name: 'Norden', index: 'OMX Nordic 40', color: '#0891b2', sourceUrl: NORDIC_SOURCE, regions: ['Nordics', 'Sweden', 'Finland', 'Denmark'] },
  { geography: 'Sweden', id: 'sweden', name: 'Stockholm', index: 'OMX Stockholm 30', color: '#2563eb', sourceUrl: NORDIC_SOURCE, regions: ['Sweden'] },
  { geography: 'Finland', id: 'finland', name: 'Helsinki', index: 'OMX Helsinki 25', color: '#be123c', sourceUrl: NORDIC_SOURCE, regions: ['Finland'] },
  { geography: 'Denmark', id: 'denmark', name: 'København', index: 'OMX Copenhagen 25', color: '#a16207', sourceUrl: NORDIC_SOURCE, regions: ['Denmark'] },
  { geography: 'Europe', id: 'europe', name: 'Europa', index: 'STOXX Europe 600', color: '#db2777', sourceUrl: 'https://stoxx.com/index/sxxp/', regions: ['Europe', 'Norway', 'Nordics', 'Sweden', 'Finland', 'Denmark'] },
  { geography: 'Asia Pacific', id: 'asia', name: 'Asia/Stillehavet', index: 'MSCI AC Asia Pacific', color: '#0d9488', sourceUrl: 'https://www.msci.com/www/fact-sheet/msci-ac-asia-pacific-index/05956352', regions: ['Asia Pacific'] },
  { geography: 'Emerging Markets', id: 'emerging', name: 'Fremvoksende markeder', index: 'MSCI Emerging Markets', color: '#9333ea', sourceUrl: 'https://www.msci.com/indexes/index/891800', regions: ['Emerging Markets'] },
  { geography: 'Global', id: 'global', name: 'Globalt', index: 'MSCI ACWI', color: '#475569', sourceUrl: 'https://www.msci.com/indexes/index/892400', regions: [] },
]

export const GEOGRAPHY_LABELS: Record<string, string> = {
  Norway: 'Norge', 'United States': 'USA', Nordics: 'Norden', Sweden: 'Sverige',
  Finland: 'Finland', Denmark: 'Danmark', Europe: 'Europa', 'Asia Pacific': 'Asia/Stillehavet',
  'Emerging Markets': 'fremvoksende markeder', Global: 'globale investeringer',
}

// Equal starting weights across unique equity/fund instruments in the matching
// fictional market region, never weights taken from other customers.
// Named real indices are examples of possible future data sources only.
export function buildGeographyBenchmarks(): Benchmark[] {
  return GEOGRAPHY_REFERENCES.map((reference) => {
    const histories = new Map<string, PerformancePoint[]>()
    for (const point of marketData) {
      if (['Cash', 'Government Bonds', 'Corporate Bonds'].includes(point.sector)) continue
      if (reference.regions.length > 0 && !reference.regions.includes(point.geography)) continue
      if ('sector' in reference && reference.sector && reference.sector !== point.sector) continue
      const history = histories.get(point.ticker) ?? []
      history.push({ date: point.date, value: point.price })
      histories.set(point.ticker, history)
    }
    const instruments = [...histories.values()].map((history) => {
      history.sort((a, b) => a.date.localeCompare(b.date))
      return { baseline: history[0]?.value, prices: new Map(history.map((point) => [point.date, point.value])) }
    })
    const dates = [...new Set([...histories.values()].flatMap((history) => history.map((point) => point.date)))].sort()
    const series: PerformancePoint[] = []
    for (const date of dates) {
      const values = instruments.map((instrument) => {
        const price = instrument.prices.get(date)
        return price !== undefined && price > 0 && instrument.baseline > 0
          ? 100 * price / instrument.baseline : null
      })
      // Missing observations create a gap, rather than changing the basket.
      if (values.length > 0 && values.every((value) => value !== null)) {
        series.push({ date, value: (values as number[]).reduce((sum, value) => sum + value, 0) / values.length })
      }
    }
    return { id: reference.id, geography: reference.geography, name: reference.name, index: reference.index, color: reference.color, sourceUrl: reference.sourceUrl, series }
  })
}

export const DEMO_BENCHMARKS = buildGeographyBenchmarks()

export interface RelevantBenchmark extends Benchmark {
  allocationPct: number
}

export function relevantBenchmarks(allocation: AllocationSlice[], benchmarks = DEMO_BENCHMARKS): RelevantBenchmark[] {
  return allocation
    .filter((slice) => slice.value > 0 && slice.percentage > 0)
    .flatMap((slice) => {
      return benchmarks.filter((candidate) => candidate.geography === slice.label)
        .map((benchmark) => ({ ...benchmark, allocationPct: slice.percentage }))
    })
    .sort((a, b) => b.allocationPct - a.allocationPct)
}
