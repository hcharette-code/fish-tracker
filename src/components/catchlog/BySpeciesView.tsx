import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PublicCatchLogRow } from '../../types/fish'
import { SPECIES_LABELS } from '../../types/fish'
import { CHART_INK, speciesColor } from '../../lib/chartTheme'
import { groupByMonth, monthLabel, presentSpecies } from '../../lib/catchLogAggregate'

export default function BySpeciesView({ rows }: { rows: PublicCatchLogRow[] }) {
  const chartData = useMemo(
    () => groupByMonth(rows).map((row) => ({ ...row, label: monthLabel(row.key) })),
    [rows]
  )
  const species = useMemo(() => presentSpecies(rows), [rows])

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 font-medium text-slate-800">Catch by month, all rivers</h2>
        <p className="mb-4 text-sm text-slate-500">Every species plotted on the same graph, month over month.</p>
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500">No entries logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART_INK.gridline} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                axisLine={{ stroke: CHART_INK.baseline }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                axisLine={{ stroke: CHART_INK.baseline }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: CHART_INK.surface,
                  border: `1px solid ${CHART_INK.baseline}`,
                  borderRadius: 6,
                  fontSize: 13,
                }}
                labelStyle={{ color: CHART_INK.primary, fontWeight: 600, marginBottom: 4 }}
                itemStyle={{ color: CHART_INK.secondary }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 13, color: CHART_INK.secondary }} />
              {species.map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={SPECIES_LABELS[s]}
                  stroke={speciesColor(s)}
                  strokeWidth={2}
                  dot={{ r: 4, fill: speciesColor(s), strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  )
}
