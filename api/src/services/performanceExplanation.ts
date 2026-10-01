// Explains *why* a portfolio's value changed over the observed period.
//
// Deterministic and explainable on purpose: every number can be traced
// back to holdings x market prices. Builds on calculatePerformance() so
// the explanation always matches the performance chart.
//
// IMPORTANT: The reference mixes and expected ranges below are simplified
// EDUCATIONAL assumptions for the workshop demo, not real benchmarks or
// return forecasts.
import { calculatePerformance } from './portfolio.js'
import { getCustomer, getInvestmentsFor, getMarketDataFor } from '../data.js'

export interface HoldingContribution {
  ticker: string
  name: string
  asset_type: string
  start_value: number
  end_value: number
  change_value: number
  return_pct: number
  contribution_pct_points: number
}

export interface GroupContribution {
  label: string
  change_value: number
  contribution_pct_points: number
}

export interface ReferenceComparison {
  label: string
  weights: { ticker: string; weight: number }[]
  return_pct: number
  market_effect_pct_points: number
  choices_effect_pct_points: number
}

export interface ExpectationCheck {
  risk_profile: string
  expected_return_pct: number
  typical_low_pct: number
  typical_high_pct: number
  verdict: 'below' | 'within' | 'above'
  assumption: string
}

export interface PerformanceExplanation {
  customer_id: string
  period: { start_date: string; end_date: string; days: number } | null
  start_value: number
  end_value: number
  change_value: number
  return_pct: number
  contributions: HoldingContribution[]
  top_positive: HoldingContribution[]
  top_negative: HoldingContribution[]
  by_asset_type: GroupContribution[]
  reference: ReferenceComparison | null
  expectation: ExpectationCheck | null
  summary: string[]
  limitations: string[]
  data_warnings: string[]
}

// Simple index-fund mixes per risk profile ("what the market gave").
const REFERENCE_MIX: Record<string, { ticker: string; weight: number }[]> = {
  Conservative: [{ ticker: 'GLBEQ', weight: 0.2 }, { ticker: 'CORPB', weight: 0.6 }, { ticker: 'CASHNOK', weight: 0.2 }],
  Moderate: [{ ticker: 'GLBEQ', weight: 0.35 }, { ticker: 'CORPB', weight: 0.55 }, { ticker: 'CASHNOK', weight: 0.1 }],
  Balanced: [{ ticker: 'GLBEQ', weight: 0.5 }, { ticker: 'CORPB', weight: 0.45 }, { ticker: 'CASHNOK', weight: 0.05 }],
  Growth: [{ ticker: 'GLBEQ', weight: 0.75 }, { ticker: 'CORPB', weight: 0.25 }],
  Aggressive: [{ ticker: 'GLBEQ', weight: 0.9 }, { ticker: 'CORPB', weight: 0.1 }],
}

// Assumed yearly return and volatility (in %) per risk profile.
const PROFILE_ASSUMPTIONS: Record<string, { annualReturn: number; annualVolatility: number }> = {
  Conservative: { annualReturn: 3, annualVolatility: 4 },
  Moderate: { annualReturn: 4, annualVolatility: 7 },
  Balanced: { annualReturn: 5, annualVolatility: 10 },
  Growth: { annualReturn: 6, annualVolatility: 14 },
  Aggressive: { annualReturn: 7, annualVolatility: 18 },
}

const LIMITATIONS = [
  'Based on synthetic demo data covering about 90 days, not a full half-year.',
  "Assumes you held today's investments for the whole period, so buying and selling is not taken into account.",
  'The reference mix is a simplified comparison, not an official benchmark.',
  'The expected range is an illustrative assumption, not a forecast or a guarantee.',
]

const round2 = (n: number) => Number(n.toFixed(2))
const formatPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
const formatPoints = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)} percentage points`
const formatNok = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n).toLocaleString('en-US')} NOK`
const withArticle = (word: string) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`

function priceOn(ticker: string, date: string): number | undefined {
  return getMarketDataFor(ticker).find((p) => p.date === date)?.price
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000)
}

export function explainPerformance(customerId: string): PerformanceExplanation {
  const customer = getCustomer(customerId)
  const holdings = getInvestmentsFor(customerId)
  const performance = calculatePerformance(customerId)
  const dataWarnings: string[] = []

  const empty: PerformanceExplanation = {
    customer_id: customerId,
    period: null,
    start_value: 0,
    end_value: 0,
    change_value: 0,
    return_pct: 0,
    contributions: [],
    top_positive: [],
    top_negative: [],
    by_asset_type: [],
    reference: null,
    expectation: null,
    summary: ["You don't have any investments yet, so there is no development to explain."],
    limitations: LIMITATIONS,
    data_warnings: [],
  }
  if (holdings.length === 0 || performance.series.length < 2 || performance.start_value <= 0) return empty

  const startDate = performance.series[0].date
  const endDate = performance.series[performance.series.length - 1].date
  const days = daysBetween(startDate, endDate)
  const startTotal = performance.start_value

  // 1) What moved the portfolio: per-holding contributions.
  const contributions: HoldingContribution[] = holdings.map((h) => {
    const startPrice = priceOn(h.ticker, startDate)
    const endPrice = priceOn(h.ticker, endDate)
    if (startPrice === undefined || endPrice === undefined) {
      dataWarnings.push(`Missing price history for ${h.name} (${h.ticker}). Today's price was used, so its effect may be wrong.`)
    }
    const startValue = h.quantity * (startPrice ?? h.current_price)
    const endValue = h.quantity * (endPrice ?? h.current_price)
    const change = endValue - startValue
    return {
      ticker: h.ticker,
      name: h.name,
      asset_type: h.asset_type,
      start_value: round2(startValue),
      end_value: round2(endValue),
      change_value: round2(change),
      return_pct: startValue > 0 ? round2((change / startValue) * 100) : 0,
      contribution_pct_points: round2((change / startTotal) * 100),
    }
  }).sort((a, b) => Math.abs(b.contribution_pct_points) - Math.abs(a.contribution_pct_points))

  const topPositive = contributions.filter((c) => c.contribution_pct_points > 0).slice(0, 3)
  const topNegative = contributions.filter((c) => c.contribution_pct_points < 0).slice(0, 3)

  const groups = new Map<string, number>()
  for (const c of contributions) groups.set(c.asset_type, (groups.get(c.asset_type) ?? 0) + c.change_value)
  const byAssetType: GroupContribution[] = [...groups.entries()]
    .map(([label, change]) => ({ label, change_value: round2(change), contribution_pct_points: round2((change / startTotal) * 100) }))
    .sort((a, b) => b.contribution_pct_points - a.contribution_pct_points)

  // 2) Market or own choices: compare with a reference mix for the risk profile.
  const returnPct = performance.period_return_pct
  const profile = customer?.risk_profile ?? 'Unknown'
  const mix = REFERENCE_MIX[profile]
  let reference: ReferenceComparison | null = null
  if (mix) {
    const referenceReturn = mix.reduce((sum, { ticker, weight }) => {
      const start = priceOn(ticker, startDate)
      const end = priceOn(ticker, endDate)
      if (!start || !end) {
        dataWarnings.push(`Missing price history for ${ticker} in the reference mix, so the reference return leaves it out and may be wrong.`)
        return sum
      }
      return sum + weight * ((end / start - 1) * 100)
    }, 0)
    reference = {
      label: `Reference mix for ${withArticle(profile)} investor`,
      weights: mix,
      return_pct: round2(referenceReturn),
      market_effect_pct_points: round2(referenceReturn),
      choices_effect_pct_points: round2(returnPct - referenceReturn),
    }
  } else {
    dataWarnings.push(`Unknown risk profile "${profile}", so no reference comparison or expected range is shown.`)
  }

  // 3) Is this normal for the risk profile?
  const assumption = PROFILE_ASSUMPTIONS[profile]
  let expectation: ExpectationCheck | null = null
  if (assumption) {
    const expected = assumption.annualReturn * (days / 365)
    const band = assumption.annualVolatility * Math.sqrt(days / 365)
    const low = expected - band
    const high = expected + band
    expectation = {
      risk_profile: profile,
      expected_return_pct: round2(expected),
      typical_low_pct: round2(low),
      typical_high_pct: round2(high),
      verdict: returnPct < low ? 'below' : returnPct > high ? 'above' : 'within',
      assumption: `Assumes about ${assumption.annualReturn}% average yearly return and ${assumption.annualVolatility}% yearly fluctuation for ${withArticle(profile)} profile.`,
    }
  }

  // 4) Plain-language summary, one short sentence per question.
  const summary: string[] = []
  const direction = returnPct >= 0 ? 'went up' : 'went down'
  summary.push(`Your investments ${direction} ${formatPct(Math.abs(returnPct)).replace('+', '')} (${formatNok(performance.end_value - startTotal)}) from ${startDate} to ${endDate}.`)
  if (topPositive[0]) summary.push(`The biggest boost came from ${topPositive[0].name} (${formatPoints(topPositive[0].contribution_pct_points)}).`)
  if (topNegative[0]) summary.push(`The biggest drag came from ${topNegative[0].name} (${formatPoints(topNegative[0].contribution_pct_points)}).`)
  if (reference) {
    summary.push(
      `A simple ${profile} reference mix changed ${formatPct(reference.return_pct)} in the same period. ` +
      `The difference of ${formatPoints(reference.choices_effect_pct_points)} comes from what you hold compared with that mix.`,
    )
  }
  if (expectation) {
    const verdictText = { below: 'below what is typical', within: 'within what is typical', above: 'above what is typical' }[expectation.verdict]
    summary.push(`For ${withArticle(profile)} profile, a result between ${formatPct(expectation.typical_low_pct)} and ${formatPct(expectation.typical_high_pct)} is normal for a period this long, so your result is ${verdictText}.`)
  }

  return {
    customer_id: customerId,
    period: { start_date: startDate, end_date: endDate, days },
    start_value: performance.start_value,
    end_value: performance.end_value,
    change_value: round2(performance.end_value - startTotal),
    return_pct: returnPct,
    contributions,
    top_positive: topPositive,
    top_negative: topNegative,
    by_asset_type: byAssetType,
    reference,
    expectation,
    summary,
    limitations: LIMITATIONS,
    data_warnings: dataWarnings,
  }
}
