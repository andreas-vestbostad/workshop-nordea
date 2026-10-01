import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PerformanceExplanationPanel from '../components/PerformanceExplanationPanel'

vi.mock('../api/client', () => ({
  fetchPerformanceExplanation: vi.fn().mockResolvedValue({
    customer_id: 'CUST-1', period: { start_date: '2026-06-09', end_date: '2026-09-06', days: 89 },
    start_value: 100000, end_value: 105000, change_value: 5000, return_pct: 5,
    contributions: [], top_positive: [], top_negative: [], by_asset_type: [],
    reference: null, expectation: null,
    summary: ['Your investments went up 5.0% (+5,000 NOK) from 2026-06-09 to 2026-09-06.'],
    limitations: ['Based on synthetic demo data covering about 90 days, not a full half-year.'],
    data_warnings: [],
  }),
}))

describe('PerformanceExplanationPanel', () => {
  it('shows the plain-language summary', async () => {
    render(<PerformanceExplanationPanel customerId="CUST-1" />)
    expect(await screen.findByText(/went up 5.0%/)).toBeTruthy()
    expect(screen.getByText(/How is this calculated/)).toBeTruthy()
  })
})
