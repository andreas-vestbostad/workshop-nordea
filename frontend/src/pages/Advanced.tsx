import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchInvestments, fetchPerformance, fetchPortfolio } from '../api/client'
import type { Investment, PerformanceSummary, PortfolioSummary } from '../api/types'
import { useCustomerContext } from '../context/CustomerContext'
import { relevantBenchmarks } from '../data/demoBenchmarks'
import { analyzePerformance, currencyBreakdown, driftAlerts, type AlertSettings } from '../utils/advanced'
import { formatCurrency } from '../utils/format'
import StatCard from '../components/StatCard'

const number = (value: number | null, suffix = '') => value === null ? 'Ikke tilgjengelig' : value.toLocaleString('nb-NO', { maximumFractionDigits: 2 }) + suffix
const dateLabel = (date: string) => new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date))
const emptySettings: AlertSettings = { equityMinimum: null, priceFloors: {} }

function readSettings(key: string): AlertSettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!value || typeof value !== 'object') return emptySettings
    const priceFloors: Record<string, number> = {}
    for (const [id, floor] of Object.entries(value.priceFloors ?? {})) {
      if (typeof floor === 'number' && Number.isFinite(floor) && floor > 0) priceFloors[id] = floor
    }
    return { equityMinimum: typeof value.equityMinimum === 'number' && value.equityMinimum >= 0 && value.equityMinimum <= 100 ? value.equityMinimum : null, priceFloors }
  } catch { return emptySettings }
}

function Analytics({ customerId, portfolio, performance, holdings }: { customerId: string; portfolio: PortfolioSummary; performance: PerformanceSummary; holdings: Investment[] }) {
  const benchmarks = relevantBenchmarks(portfolio.allocation_by_geography)
  const [benchmarkId, setBenchmarkId] = useState(benchmarks[0]?.id ?? '')
  const [riskFree, setRiskFree] = useState('0')
  const storageKey = `wealth-copilot:alerts:${customerId}`
  const [settings, setSettings] = useState<AlertSettings>(() => readSettings(storageKey))
  const [saved, setSaved] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const benchmark = benchmarks.find((item) => item.id === benchmarkId)
  const rate = Number(riskFree)
  const validRate = riskFree.trim() !== '' && Number.isFinite(rate) && rate >= 0 && rate <= 20
  const analysis = analyzePerformance(performance.series, benchmark?.series ?? [], validRate ? rate : NaN)
  const currencies = currencyBreakdown(holdings)
  const alerts = driftAlerts(holdings, settings)
  const stocks = holdings.filter((holding) => holding.asset_type === 'Equity')
  const count = alerts.prices.length + (alerts.equityBelow ? 1 : 0)
  const hasTargets = settings.equityMinimum !== null || Object.keys(settings.priceFloors).length > 0

  function updateSettings(next: AlertSettings) { setSettings(next); setSaved(false) }
  function saveSettings() {
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); setSaved(true); setStorageError(false) }
    catch { setStorageError(true) }
  }

  return <>
    <section className="panel advanced-controls">
      <div><label htmlFor="advanced-benchmark">Sammenligningsindeks (demo)</label>
        <select id="advanced-benchmark" value={benchmarkId} onChange={(event) => setBenchmarkId(event.target.value)} disabled={!benchmarks.length}>
          {!benchmarks.length && <option value="">Ingen sammenligningsdata</option>}
          {benchmarks.map((item) => <option key={item.id} value={item.id}>{item.index} · {item.allocationPct.toLocaleString('nb-NO')} % eksponering</option>)}
        </select></div>
      <div><label htmlFor="risk-free">Antatt risikofri rente (% per år)</label>
        <input id="risk-free" type="number" min="0" max="20" step="0.1" value={riskFree} onChange={(event) => setRiskFree(event.target.value)} />
      </div>
      <p className="advanced-context">{dateLabel(performance.series[0].date)} – {dateLabel(performance.series.at(-1)!.date)} {performance.series.at(-1)!.date.slice(0, 4)} · {analysis.metrics.observations} felles dagsavkastninger. Rente 0 % er en demoantakelse.</p>
      {!validRate && <p role="alert" className="error-state">Velg en rente mellom 0 og 20 %.</p>}
    </section>

    <div className="stat-grid">
      <StatCard label="Beta" value={number(analysis.metrics.beta)} sublabel="Følsomhet mot valgt demoreferanse" />
      <StatCard label="Alfa · annualisert" value={number(analysis.metrics.alphaAnnualPct, ' %')} sublabel="Regresjonsalfa, justert for beta og rente" />
      <StatCard label="Sharpe-ratio · annualisert" value={number(analysis.metrics.sharpe)} sublabel="Meravkastning over antatt rente per svingning" />
      <StatCard label="Tracking error · annualisert" value={number(analysis.metrics.trackingErrorPct, ' %')} sublabel="Svingninger i forskjellen mot referansen" />
    </div>
    <p className="advanced-explanation">Beta 1 betyr omtrent samme følsomhet som referansen; beta 0 betyr liten lineær samvariasjon. Alfa er regresjonens konstantledd. Kort, syntetisk historikk kan gi ustabile tall, særlig når de annualiseres. Tallene er ingen prognose eller vurdering av forvalterens ferdigheter.</p>

    <div className="advanced-chart-grid">
      {([{ key: 'beta', name: 'Beta over tid', color: 'var(--chart-1)', suffix: '', baseline: 1 }, { key: 'alpha', name: 'Alfa over tid · annualisert', color: 'var(--chart-2)', suffix: ' %', baseline: 0 }] as const).map((chart) => (
        <section className="panel" key={chart.key}>
          <h3>{chart.name}</h3><p className="benchmark-description">Rullerende vindu på 30 dager</p>
          {analysis.rolling.some((point) => point[chart.key] !== null) ? <ResponsiveContainer width="100%" height={240}>
            <LineChart data={analysis.rolling} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={45} />
              <YAxis width={65} tickFormatter={(value: number) => number(value, chart.suffix)} />
              <ReferenceLine y={chart.baseline} stroke="var(--text-muted)" strokeOpacity={0.5} strokeDasharray="4 4" />
              <Tooltip labelFormatter={(date: string) => dateLabel(date)} formatter={(value: number) => [number(value, chart.suffix), chart.name]} />
              <Line type="linear" dataKey={chart.key} stroke={chart.color} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer> : <p className="empty-state">Mangler nok sammenhengende data eller variasjon i referansen.</p>}
        </section>
      ))}
    </div>

    <section className="panel">
      <h3>Valutaoversikt og eksponering</h3>
      <p className="benchmark-description">Basert på posisjonenes registrerte valuta.</p>
      <div className="currency-breakdown">
        {currencies.rows.map((row) => <div className="currency-row" key={row.currency}>
          <strong>{row.currency}</strong><span>{formatCurrency(row.value, row.currency)}</span><span>{number(row.percentage, ' %')}</span>
          {row.percentage !== null && <div className="currency-bar" aria-label={`${row.percentage} prosent ${row.currency}`}><div style={{ width: `${row.percentage}%` }} /></div>}
        </div>)}
      </div>
      <p className="benchmark-note">Alle posisjonene i demoen er registrert i NOK. Det viser rapporteringsvaluta, ikke at utenlandske investeringer er uten valutarisiko. Underliggende valutaer, valutasikring og valutakurser mangler; reell USD/EUR-eksponering kan derfor ikke beregnes fra disse dataene.</p>
      {!currencies.comparable && <p className="error-state">Flere valutaer er registrert. Andeler kan ikke beregnes uten valutakurser.</p>}
    </section>

    <section className="panel">
      <div className="benchmark-heading"><div><h3>Drift alerts · mål og kursgrenser</h3><p className="benchmark-description">Sett egne terskler for denne kunden.</p></div>
        <span className={`alert-status${count ? ' alert-status--warning' : ''}`}>{hasTargets ? `${count} aktive varsler` : 'Ingen mål satt'}</span></div>
      <div className="advanced-controls advanced-controls--inline">
        <div><label htmlFor="equity-minimum">Minste andel enkeltaksjer (%)</label>
          <input id="equity-minimum" type="number" min="0" max="100" step="0.1" placeholder="Sett et mål" value={settings.equityMinimum ?? ''} onChange={(event) => {
            const value = event.target.value === '' ? null : Number(event.target.value)
            if (value === null || (Number.isFinite(value) && value >= 0 && value <= 100)) updateSettings({ ...settings, equityMinimum: value })
          }} /></div>
        <p>Nåværende aksjeandel: <strong>{number(alerts.equityPct, ' %')}</strong>. ETF-er og fond er ikke regnet som enkeltaksjer.</p>
      </div>
      {alerts.equityBelow && <p className="drift-warning" role="status">Aksjeandelen er {number(alerts.equityPct, ' %')}, under målet på {settings.equityMinimum} %.</p>}
      {stocks.length ? <div className="advanced-table-wrap"><table className="holdings-table">
        <thead><tr><th>Aksje</th><th>Nåværende kurs</th><th>Minstekurs</th><th>Status</th></tr></thead>
        <tbody>{stocks.map((holding) => {
          const floor = settings.priceFloors[holding.investment_id]
          const below = floor !== undefined && holding.current_price < floor
          return <tr key={holding.investment_id}><td><strong>{holding.name}</strong><div className="holdings-table__ticker">{holding.ticker} · {holding.account_id}</div></td>
            <td>{number(holding.current_price)} {holding.currency}</td>
            <td><input type="number" min="0" step="0.01" aria-label={`Minstekurs for ${holding.ticker} på ${holding.account_id}`} placeholder="Ingen grense" value={floor ?? ''} onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isFinite(value) || value < 0) return
              const priceFloors = { ...settings.priceFloors }
              if (event.target.value === '' || value === 0) delete priceFloors[holding.investment_id]
              else priceFloors[holding.investment_id] = value
              updateSettings({ ...settings, priceFloors })
            }} /></td>
            <td><span className={below ? 'negative' : floor ? 'positive' : ''}>{below ? 'Under kursgrensen' : floor ? 'Over eller på kursgrensen' : 'Ingen grense satt'}</span></td></tr>
        })}</tbody>
      </table></div> : <p className="empty-state">Kunden har ingen enkeltaksjer.</p>}
      <div className="advanced-actions"><button type="button" className="primary-button" onClick={saveSettings}>Lagre mål for denne kunden</button>
        <button type="button" className="secondary-button" onClick={() => updateSettings({ equityMinimum: null, priceFloors: {} })}>Nullstill mål</button>
        {saved && <span role="status">Mål lagret i denne nettleseren.</span>}
        {storageError && <span role="alert" className="negative">Kunne ikke lagre. Målene gjelder bare til siden lukkes.</span>}
      </div>
      <p className="benchmark-note">Varslene vurderer siste datapunkt i demoen, ikke sanntidskurser. Målene er selvvalgte og lagres per kunde i denne nettleseren. Dette er varsler i appen, uten automatiske handler eller bakgrunnsvarsling.</p>
    </section>

    <details className="panel advanced-method"><summary>Datagrunnlag og beregningsmetode</summary>
      <p>Porteføljen bruker dagens antall gjennom hele perioden. Referansene er syntetiske kurver fra demoens instrumenter, ikke offisielle indekskurser. Minimum 20 felles dagsavkastninger kreves.</p>
      <p>Beta = kovarians / referansens varians. Daglig alfa = gjennomsnittlig meravkastning − beta × referansens gjennomsnittlige meravkastning. Annualisert alfa = daglig alfa × 365. Sharpe = gjennomsnittlig daglig meravkastning / standardavvik × √365. Tracking error = standardavvik av daglig avkastningsforskjell × √365.</p>
      <p>Demoen har kalenderdager, også helger, og bruker derfor 365 dager per år. Renter omregnes med (1 + årlig rente)^(1/365) − 1. Dette er en pedagogisk konvensjon; virkelige børsdata krever handelskalendere, valutakurser, utbytte og faktisk beholdningshistorikk.</p>
      <a href="https://www.cfainstitute.org/insights/articles/understanding-investment-risk" target="_blank" rel="noreferrer">Les om risikomål hos CFA Institute</a>
    </details>
  </>
}

export default function Advanced() {
  const { selectedCustomerId, selectedCustomer } = useCustomerContext()
  const [data, setData] = useState<{ customerId: string; portfolio: PortfolioSummary; performance: PerformanceSummary; holdings: Investment[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedCustomerId) return
    let cancelled = false
    setData(null); setError(null)
    Promise.all([fetchPortfolio(selectedCustomerId), fetchPerformance(selectedCustomerId), fetchInvestments(selectedCustomerId)])
      .then(([portfolio, performance, investments]) => { if (!cancelled) setData({ customerId: selectedCustomerId, portfolio, performance, holdings: investments.investments }) })
      .catch((error: Error) => { if (!cancelled) setError(error.message) })
    return () => { cancelled = true }
  }, [selectedCustomerId])
  return <div className="page">
    <Link className="advanced-back" to="/portfolio">← Tilbake til porteføljen</Link>
    <div className="page-heading"><p className="eyebrow">Avansert analyse · syntetiske demodata</p><h2>{selectedCustomer ? `Analyse for ${selectedCustomer.first_name}` : 'Avansert analyse'}</h2></div>
    {error ? <p className="error-state" role="alert">Kunne ikke hente analysen: {error}</p> : !data || data.customerId !== selectedCustomerId ? <p className="loading-state">Henter analyse…</p> : !data.performance.series.length || data.portfolio.total_value <= 0 ? <p className="empty-state">Denne kunden har ingen investeringshistorikk å analysere.</p> : <Analytics key={data.customerId} {...data} />}
  </div>
}
