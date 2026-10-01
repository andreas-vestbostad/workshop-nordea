import { useEffect, useState } from 'react'
import { fetchPerformanceExplanation } from '../api/client'
import type { HoldingContribution, PerformanceExplanation } from '../api/types'
import StatCard from './StatCard'
import { formatCurrency, formatPercentage, formatPoints } from '../utils/format'

const VERDICT_LABEL = { below: 'Below typical range', within: 'Within typical range', above: 'Above typical range' }

function ContributionList({ title, items, maxAbs }: { title: string; items: HoldingContribution[]; maxAbs: number }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4>{title}</h4>
      <ul className="contribution-list">
        {items.map((item) => {
          const positive = item.contribution_pct_points >= 0
          return (
            <li key={item.ticker}>
              <span className="contribution-list__name">{item.name}</span>
              <span className="contribution-list__bar-track">
                <span
                  className={`contribution-list__bar contribution-list__bar--${positive ? 'positive' : 'negative'}`}
                  style={{ width: `${(Math.abs(item.contribution_pct_points) / maxAbs) * 100}%` }}
                />
              </span>
              <span className={positive ? 'positive' : 'negative'}>
                {formatPoints(item.contribution_pct_points)} ({formatCurrency(item.change_value)})
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function PerformanceExplanationPanel({ customerId }: { customerId: string }) {
  const [data, setData] = useState<PerformanceExplanation | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetchPerformanceExplanation(customerId)
      .then((res) => !cancelled && setData(res))
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [customerId])

  if (error) return <section className="panel"><p className="error-state">Could not explain your performance: {error}</p></section>
  if (!data) return <section className="panel"><p className="loading-state">Explaining your performance...</p></section>

  const maxAbs = Math.max(0.01, ...data.contributions.map((c) => Math.abs(c.contribution_pct_points)))

  return (
    <section className="panel">
      <h3>Why did my portfolio change?</h3>
      {data.summary.map((sentence) => <p key={sentence}>{sentence}</p>)}

      {data.period && (
        <div className="stat-grid">
          <StatCard label="Your return" value={formatPercentage(data.return_pct, 1)} sublabel={`${data.period.days} days`}
            tone={data.return_pct >= 0 ? 'positive' : 'negative'} />
          {data.reference && (
            <>
              <StatCard label="Market (reference mix)" value={formatPercentage(data.reference.return_pct, 1)} sublabel={data.reference.label} />
              <StatCard label="Effect of your choices" value={formatPoints(data.reference.choices_effect_pct_points)}
                sublabel="Your return minus the reference mix" tone={data.reference.choices_effect_pct_points >= 0 ? 'positive' : 'negative'} />
            </>
          )}
        </div>
      )}

      <div className="chart-grid">
        <ContributionList title="Pulled your portfolio up" items={data.top_positive} maxAbs={maxAbs} />
        <ContributionList title="Pulled your portfolio down" items={data.top_negative} maxAbs={maxAbs} />
      </div>

      {data.expectation && (
        <p>
          <span className={`expectation-badge expectation-badge--${data.expectation.verdict}`}>
            {VERDICT_LABEL[data.expectation.verdict]}
          </span>{' '}
          Typical for {data.expectation.risk_profile}: {formatPercentage(data.expectation.typical_low_pct, 1)} to{' '}
          {formatPercentage(data.expectation.typical_high_pct, 1)}
        </p>
      )}

      {data.data_warnings.length > 0 && (
        <ul className="disclaimer">{data.data_warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      )}

      <details>
        <summary>How is this calculated?</summary>
        <ul>
          {data.expectation && <li>{data.expectation.assumption}</li>}
          {data.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </details>
    </section>
  )
}
