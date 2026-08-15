import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
        <h2 className="mb-1 font-medium text-slate-800">Catch by month, all rivers combined</h2>
        <p className="mb-4 text-sm text-slate-500">
          Each group of bars is one month. Within a month, each colored bar is one species — so you can
          compare species side by side within a month, and compare the same species across months.
          {chartData.length === 1 && ' Only one month is logged so far, so there\'s just one group of bars for now.'}
        </p>
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500">No entries logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
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
                label={{ value: 'Fish caught', angle: -90, position: 'insideLeft', fill: CHART_INK.secondary }}
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
                <Bar
                  key={s}
                  dataKey={s}
                  name={SPECIES_LABELS[s]}
                  fill={speciesColor(s)}
                  stroke={CHART_INK.surface}
                  strokeWidth={2}
                  maxBarSize={40}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {chartData.length > 0 && (
        <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 p-4 font-medium text-slate-800">Same data, as numbers</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Month</th>
                {species.map((s) => (
                  <th key={s} className="px-4 py-2 font-medium text-slate-600">
                    {SPECIES_LABELS[s]}
                  </th>
                ))}
                <th className="px-4 py-2 font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{row.label}</td>
                  {species.map((s) => (
                    <td key={s} className="px-4 py-2">
                      {row[s] ?? 0}
                    </td>
                  ))}
                  <td className="px-4 py-2 font-semibold">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
