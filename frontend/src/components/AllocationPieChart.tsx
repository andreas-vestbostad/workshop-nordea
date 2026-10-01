import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { AllocationSlice } from '../api/types'

const COLORS = Array.from({ length: 8 }, (_, index) => `var(--chart-${index + 1})`)

export default function AllocationPieChart({ data, title }: { data: AllocationSlice[]; title: string }) {
  if (data.length === 0) {
    return (
      <div className="chart-card">
        <h3>{title}</h3>
        <p className="empty-state">No holdings to display.</p>
      </div>
    )
  }

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={50} outerRadius={85} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, _name, props) => [`${props.payload.percentage}%`, props.payload.label]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
