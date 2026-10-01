import type { Investment, PerformancePoint } from '../api/types'

export interface RiskMetrics {
  observations: number
  beta: number | null
  alphaAnnualPct: number | null
  sharpe: number | null
  trackingErrorPct: number | null
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const variance = (values: number[]) => {
  const average = mean(values)
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)
}

// The demo has calendar-day observations, including weekends: use 365,
// not the 252 trading-day convention. Only identical one-day intervals count.
export function pairedReturns(portfolio: PerformancePoint[], benchmark: PerformancePoint[]) {
  const prices = new Map(benchmark.map((point) => [point.date, point.value]))
  const result: { date: string; portfolio: number; benchmark: number }[] = []
  for (let i = 1; i < portfolio.length; i += 1) {
    const previous = portfolio[i - 1]
    const current = portfolio[i]
    const start = prices.get(previous.date)
    const end = prices.get(current.date)
    if ((Date.parse(current.date) - Date.parse(previous.date)) !== 86400000) continue
    if (![previous.value, current.value, start, end].every((value) => value !== undefined && Number.isFinite(value) && value > 0)) continue
    result.push({ date: current.date, portfolio: current.value / previous.value - 1, benchmark: end! / start! - 1 })
  }
  return result
}

export function metricsFromReturns(p: number[], b: number[], riskFreeAnnualPct = 0): RiskMetrics {
  const empty = { observations: p.length, beta: null, alphaAnnualPct: null, sharpe: null, trackingErrorPct: null }
  if (p.length < 20 || p.length !== b.length || ![...p, ...b, riskFreeAnnualPct].every(Number.isFinite) || riskFreeAnnualPct <= -100) return empty
  const rf = (1 + riskFreeAnnualPct / 100) ** (1 / 365) - 1
  const excessP = p.map((value) => value - rf)
  const excessB = b.map((value) => value - rf)
  const mp = mean(excessP)
  const mb = mean(excessB)
  const vb = variance(excessB)
  const vp = variance(excessP)
  const covariance = excessP.reduce((sum, value, i) => sum + (value - mp) * (excessB[i] - mb), 0) / (p.length - 1)
  const beta = vb > 1e-16 ? covariance / vb : null
  return {
    observations: p.length,
    beta,
    alphaAnnualPct: beta === null ? null : (mp - beta * mb) * 365 * 100,
    sharpe: vp > 1e-16 ? mp / Math.sqrt(vp) * Math.sqrt(365) : null,
    trackingErrorPct: Math.sqrt(variance(p.map((value, i) => value - b[i]))) * Math.sqrt(365) * 100,
  }
}

export function analyzePerformance(portfolio: PerformancePoint[], benchmark: PerformancePoint[], riskFreeAnnualPct = 0) {
  const returns = pairedReturns(portfolio, benchmark)
  return {
    metrics: metricsFromReturns(returns.map((point) => point.portfolio), returns.map((point) => point.benchmark), riskFreeAnnualPct),
    rolling: returns.slice(29).map((point, i) => {
      const window = returns.slice(i, i + 30)
      const contiguous = Date.parse(window[29].date) - Date.parse(window[0].date) === 29 * 86400000
      const metrics = contiguous ? metricsFromReturns(window.map((item) => item.portfolio), window.map((item) => item.benchmark), riskFreeAnnualPct) : null
      return { date: point.date, beta: metrics?.beta ?? null, alpha: metrics?.alphaAnnualPct ?? null }
    }),
  }
}

export function currencyBreakdown(holdings: Investment[]) {
  const totals = new Map<string, number>()
  for (const holding of holdings) {
    totals.set(holding.currency, (totals.get(holding.currency) ?? 0) + holding.quantity * holding.current_price)
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0)
  // No FX rates exist in this dataset: never sum amounts in different currencies.
  return { comparable: totals.size <= 1, rows: [...totals].map(([currency, value]) => ({ currency, value, percentage: totals.size === 1 && total > 0 ? 100 : null })) }
}

export interface AlertSettings {
  equityMinimum: number | null
  priceFloors: Record<string, number>
}

export function driftAlerts(holdings: Investment[], settings: AlertSettings) {
  const total = holdings.reduce((sum, holding) => sum + holding.quantity * holding.current_price, 0)
  const equityValue = holdings.filter((holding) => holding.asset_type === 'Equity').reduce((sum, holding) => sum + holding.quantity * holding.current_price, 0)
  const equityPct = total > 0 ? equityValue / total * 100 : null
  const prices = holdings.filter((holding) => holding.asset_type === 'Equity' && settings.priceFloors[holding.investment_id] > 0 && holding.current_price < settings.priceFloors[holding.investment_id])
  return { equityPct, equityBelow: equityPct !== null && settings.equityMinimum !== null && equityPct < settings.equityMinimum, prices }
}
