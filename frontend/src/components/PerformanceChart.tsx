import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PerformancePoint } from '../api/types'
import { DEMO_BENCHMARKS } from '../data/demoBenchmarks'
import { comparePerformance } from '../utils/comparison'

function formatDate(date: string) {
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date))
}

export default function PerformanceChart({ series }: { series: PerformancePoint[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const data = comparePerformance(series, DEMO_BENCHMARKS)
  const active = DEMO_BENCHMARKS.filter((benchmark) => selected.includes(benchmark.id)
    && data.some((point) => typeof point[benchmark.id] === 'number'))

  if (series.length === 0) {
    return <p className="empty-state">Ingen historikk tilgjengelig for denne kunden.</p>
  }
  if (data.length === 0) {
    return <p className="empty-state">Kan ikke beregne prosentvis utvikling uten en positiv startverdi.</p>
  }

  return (
    <div className="performance-comparison">
      <div className="benchmark-heading">
        <div>
          <p className="benchmark-title">Sammenlign med markedet</p>
          <p className="benchmark-description">Velg én eller flere indekser. Alle kurver starter på 0 %.</p>
        </div>
        <span className="benchmark-demo-badge">Syntetiske demodata</span>
      </div>
      <div className="benchmark-buttons" role="group" aria-label="Velg indekser å sammenligne med">
        {DEMO_BENCHMARKS.map((benchmark) => {
          const available = data.some((point) => typeof point[benchmark.id] === 'number')
          const pressed = available && selected.includes(benchmark.id)
          return (
            <button
              key={benchmark.id}
              type="button"
              aria-pressed={pressed}
              disabled={!available}
              title={available ? `${benchmark.index} – syntetisk demokurve` : 'Mangler data for samme startdato'}
              className={`benchmark-button${pressed ? ' benchmark-button--selected' : ''}`}
              onClick={() => setSelected((previous) => previous.includes(benchmark.id)
                ? previous.filter((id) => id !== benchmark.id) : [...previous, benchmark.id])}
            >
              <span className="benchmark-dot" style={{ backgroundColor: benchmark.color }} aria-hidden="true" />
              {benchmark.name}
              {pressed && <span aria-hidden="true">✓</span>}
            </button>
          )
        })}
      </div>
      <div className="benchmark-legend" aria-label="Kurver i grafen">
        <span><span className="benchmark-dot" style={{ backgroundColor: '#2563eb' }} aria-hidden="true" />Din portefølje</span>
        {active.map((benchmark) => (
          <span key={benchmark.id}><span className="benchmark-dot" style={{ backgroundColor: benchmark.color }} aria-hidden="true" />{benchmark.index} (demo)</span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={40} />
          <YAxis tickFormatter={(value: number) => `${value.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} %`} width={65} />
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Tooltip
            labelFormatter={(label: string) => formatDate(label)}
            formatter={(value: number, name: string) => [`${value >= 0 ? '+' : ''}${value.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} %`, name]}
          />
          <Line type="linear" dataKey="portfolio" name="Din portefølje" stroke="#2563eb" strokeWidth={3} dot={false} isAnimationActive={false} />
          {active.map((benchmark) => (
            <Line key={benchmark.id} type="linear" dataKey={benchmark.id} name={`${benchmark.index} (demo)`} stroke={benchmark.color} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="benchmark-period">{formatDate(series[0].date)} – {formatDate(series[series.length - 1].date)} {series[series.length - 1].date.slice(0, 4)} · Prosentvis endring fra startdato</p>
      <p className="benchmark-note">Indekskurvene er fiktive illustrasjoner, ikke faktiske børskurser. Porteføljen bruker dagens beholdninger gjennom hele perioden. Sammenligningen viser ikke faktisk meravkastning og tar ikke hensyn til valuta, utbytte eller handel.</p>
    </div>
  )
}
