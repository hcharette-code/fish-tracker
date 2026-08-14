import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PublicCatchLogRow } from '../../types/fish'
import { SPECIES_LABELS } from '../../types/fish'
import { CHART_INK, speciesColor } from '../../lib/chartTheme'
import { groupByDate, presentSpecies } from '../../lib/catchLogAggregate'

export default function ByRiverView({ rows }: { rows: PublicCatchLogRow[] }) {
  const rivers = useMemo(() => Array.from(new Set(rows.map((r) => r.river))).sort(), [rows])
  const [river, setRiver] = useState('')

  const effectiveRiver = river || rivers[0] || ''
  const filteredRows = useMemo(
    () => rows.filter((r) => r.river === effectiveRiver),
    [rows, effectiveRiver]
  )
  const chartData = useMemo(() => groupByDate(filteredRows), [filteredRows])
  const species = useMemo(() => presentSpecies(filteredRows), [filteredRows])
  const lastSpecies = species[species.length - 1]

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-sm">
          <span className="text-slate-600">River</span>
          <select
            className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2"
            value={effectiveRiver}
            onChange={(e) => setRiver(e.target.value)}
          >
            {rivers.length === 0 && <option value="">No rivers logged yet</option>}
            {rivers.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </section>

      {effectiveRiver && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-1 font-medium text-slate-800">{effectiveRiver} — catch by date</h2>
          <p className="mb-4 text-sm text-slate-500">
            {filteredRows.reduce((sum, r) => sum + r.count, 0)} fish across {chartData.length}{' '}
            {chartData.length === 1 ? 'date' : 'dates'}
          </p>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500">No entries for this river yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_INK.gridline} vertical={false} />
                <XAxis
                  dataKey="key"
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
                <Legend
                  verticalAlign="top"
                  height={36}
                  wrapperStyle={{ fontSize: 13, color: CHART_INK.secondary }}
                />
                {species.map((s) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    name={SPECIES_LABELS[s]}
                    stackId="catch"
                    fill={speciesColor(s)}
                    stroke={CHART_INK.surface}
                    strokeWidth={2}
                    maxBarSize={24}
                    radius={s === lastSpecies ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      )}
    </div>
  )
}
