import { describe, expect, it } from 'vitest'
import { analyzePerformance, currencyBreakdown, driftAlerts, metricsFromReturns, pairedReturns } from '../utils/advanced'
import type { Investment } from '../api/types'

const stock: Investment = { investment_id: 'one', customer_id: 'customer', account_id: 'account', asset_type: 'Equity', ticker: 'TEST', name: 'Test', quantity: 10, purchase_price: 10, current_price: 10, currency: 'NOK', sector: 'Technology', geography: 'Norway' }
const cash = { ...stock, investment_id: 'cash', asset_type: 'Cash', current_price: 30 }

describe('advanced metrics', () => {
  it('recovers known beta and regression alpha from a deterministic return relation', () => {
    const benchmark = Array.from({ length: 30 }, (_, i) => (i % 5 - 2) / 1000)
    const portfolio = benchmark.map((value) => 2 * value + 0.0001)
    const metrics = metricsFromReturns(portfolio, benchmark)
    expect(metrics.beta).toBeCloseTo(2)
    expect(metrics.alphaAnnualPct).toBeCloseTo(3.65)
    expect(metrics.observations).toBe(30)
    expect(metrics.sharpe).toBeGreaterThan(0)
  })
  it('does not report beta or alpha for a constant reference, or Sharpe for a constant portfolio', () => {
    const metrics = metricsFromReturns(Array(30).fill(0), Array(30).fill(0))
    expect(metrics.beta).toBeNull()
    expect(metrics.alphaAnnualPct).toBeNull()
    expect(metrics.sharpe).toBeNull()
    expect(metrics.trackingErrorPct).toBe(0)
  })
  it('requires enough observations and rejects invalid assumptions', () => {
    expect(metricsFromReturns([0.01], [0.02]).beta).toBeNull()
    expect(metricsFromReturns(Array(30).fill(0.01), Array(30).fill(0.02), NaN).sharpe).toBeNull()
  })
  it('uses only identical one-day intervals and never fills missing reference prices', () => {
    const portfolio = [{ date: '2026-06-09', value: 100 }, { date: '2026-06-10', value: 110 }, { date: '2026-06-12', value: 120 }]
    const benchmark = portfolio.map((point) => ({ ...point, value: 100 }))
    expect(pairedReturns(portfolio, benchmark)).toHaveLength(1)
    expect(pairedReturns(portfolio, benchmark.slice(1))).toEqual([])
  })
  it('tracks rolling beta and alpha using 30 daily observations', () => {
    let value = 100
    const series = Array.from({ length: 50 }, (_, i) => {
      value *= 1 + (i % 5 - 2) / 1000
      return { date: new Date(Date.UTC(2026, 5, 9 + i)).toISOString().slice(0, 10), value }
    })
    const analysis = analyzePerformance(series, series)
    expect(analysis.metrics.beta).toBeCloseTo(1)
    expect(analysis.metrics.alphaAnnualPct).toBeCloseTo(0)
    expect(analysis.metrics.trackingErrorPct).toBe(0)
    expect(analysis.rolling).toHaveLength(20)
    expect(analysis.rolling.every((point) => Math.abs(point.beta! - 1) < 1e-8)).toBe(true)
  })
  it('responds to the risk-free rate assumption in Sharpe', () => {
    const returns = Array.from({ length: 30 }, (_, i) => 0.0001 + (i % 5 - 2) / 1000)
    expect(metricsFromReturns(returns, returns, 10).sharpe!).toBeLessThan(metricsFromReturns(returns, returns, 0).sharpe!)
  })
})

describe('currency and alerts', () => {
  it('reports registered NOK without inventing USD from geography', () => {
    const result = currencyBreakdown([{ ...stock, geography: 'United States' }])
    expect(result.rows).toEqual([{ currency: 'NOK', value: 100, percentage: 100 }])
  })
  it('does not sum different currencies to calculate exposure shares without FX rates', () => {
    const result = currencyBreakdown([stock, { ...stock, currency: 'USD' }])
    expect(result.comparable).toBe(false)
    expect(result.rows.every((row) => row.percentage === null)).toBe(true)
  })
  it('checks chosen stock-price floors and equity minimums', () => {
    const alerts = driftAlerts([stock, cash], { equityMinimum: 30, priceFloors: { one: 11 } })
    expect(alerts.equityPct).toBe(25)
    expect(alerts.equityBelow).toBe(true)
    expect(alerts.prices.map((holding) => holding.investment_id)).toEqual(['one'])
    expect(driftAlerts([stock], { equityMinimum: 100, priceFloors: { one: 10 } }).prices).toEqual([])
  })
  it('avoids alerts for unset targets or empty portfolios', () => {
    expect(driftAlerts([stock], { equityMinimum: null, priceFloors: {} }).equityBelow).toBe(false)
    expect(driftAlerts([], { equityMinimum: 50, priceFloors: {} }).equityBelow).toBe(false)
  })
})
