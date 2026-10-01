import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { explainPerformance } from '../src/services/performanceExplanation.js'
import { calculatePerformance } from '../src/services/portfolio.js'

const app = createApp()
const ANNE_LIKE = 'CUST-00048' // 53, Balanced
const CONSERVATIVE_BIG_GAIN = 'CUST-00028'
const NO_HOLDINGS = 'CUST-00017'

describe('explainPerformance', () => {
  it('contributions add up to the total return', () => {
    const result = explainPerformance(ANNE_LIKE)
    const sum = result.contributions.reduce((s, c) => s + c.contribution_pct_points, 0)
    expect(sum).toBeCloseTo(result.return_pct, 1)
  })

  it('matches the performance chart', () => {
    const result = explainPerformance(ANNE_LIKE)
    const performance = calculatePerformance(ANNE_LIKE)
    expect(result.start_value).toBe(performance.start_value)
    expect(result.end_value).toBe(performance.end_value)
    expect(result.period?.start_date).toBe(performance.series[0].date)
  })

  it('splits the return into market effect and choices effect', () => {
    const { reference, return_pct } = explainPerformance(ANNE_LIKE)
    expect(reference).not.toBeNull()
    expect(reference!.market_effect_pct_points + reference!.choices_effect_pct_points).toBeCloseTo(return_pct, 1)
  })

  it('flags a much higher return than expected for a conservative profile', () => {
    expect(explainPerformance(CONSERVATIVE_BIG_GAIN).expectation?.verdict).toBe('above')
  })

  it('handles a customer without investments', () => {
    const result = explainPerformance(NO_HOLDINGS)
    expect(result.period).toBeNull()
    expect(result.summary[0]).toMatch(/don't have any investments/)
    expect(result.limitations.length).toBeGreaterThan(0)
  })

  it('uses "an" before profiles that start with a vowel', () => {
    expect(explainPerformance('CUST-00072').summary.join(' ')).toMatch(/For an Aggressive profile/)
  })

  it('always explains its limitations', () => {
    expect(explainPerformance(ANNE_LIKE).limitations.join(' ')).toMatch(/today's investments/)
  })
})

describe('GET /customers/:customerId/performance/explanation', () => {
  it('returns 200 with a summary', async () => {
    const res = await request(app).get(`/customers/${ANNE_LIKE}/performance/explanation`)
    expect(res.status).toBe(200)
    expect(res.body.summary.length).toBeGreaterThan(0)
  })

  it('returns 404 for an unknown customer', async () => {
    const res = await request(app).get('/customers/CUST-99999/performance/explanation')
    expect(res.status).toBe(404)
  })
})

// Note: the deterministic Copilot intent-matcher that used to route "why"
// questions to this explanation was removed - the LLM-backed Copilot (see
// services/copilot.ts) reaches this same data via the get_performance_explanation
// MCP tool instead. See api/tests/api.test.ts for /copilot coverage.
