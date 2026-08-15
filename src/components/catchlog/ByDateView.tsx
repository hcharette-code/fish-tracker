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
import { groupByRiver, presentSpecies } from '../../lib/catchLogAggregate'

function defaultSeasonRange() {
  const year = new Date().getFullYear()
  return { start: `${year}-06-01`, end: `${year}-10-31` }
}

export default function ByDateView({ rows }: { rows: PublicCatchLogRow[] }) {
  const season = defaultSeasonRange()
  const [startDate, setStartDate] = useState(season.start)
  const [endDate, setEndDate] = useState(season.end)

  const effectiveEnd = endDate || startDate
  const isDefaultRange = startDate === season.start && endDate === season.end
  const filteredRows = useMemo(
    () => rows.filter((r) => r.entry_date >= startDate && r.entry_date <= effectiveEnd),
    [rows, startDate, effectiveEnd]
  )
  const chartData = useMemo(() => groupByRiver(filteredRows), [filteredRows])
  const species = useMemo(() => presentSpecies(filteredRows), [filteredRows])
  const lastSpecies = species[species.length - 1]
  const chartHeight = Math.max(220, chartData.length * 44 + 60)

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="block text-slate-600">From date</span>
          <input
            type="date"
            className="mt-1 rounded-md border border-slate-300 px-3 py-2"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">To date</span>
          <input
            type="date"
            className="mt-1 rounded-md border border-slate-300 px-3 py-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        {!isDefaultRange && (
          <button
            type="button"
            className="text-sm text-slate-600 underline"
            onClick={() => {
              setStartDate(season.start)
              setEndDate(season.end)
            }}
          >
            Reset to this season (Jun–Oct)
          </button>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 font-medium text-slate-800">
          Rivers ranked by production {startDate === effectiveEnd ? `— ${startDate}` : `— ${startDate} to ${effectiveEnd}`}
        </h2>
        <p className="mb-4 text-sm text-slate-500">Highest total catch first</p>
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500">No entries in this date range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
            >
              <CartesianGrid stroke={CHART_INK.gridline} horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                axisLine={{ stroke: CHART_INK.baseline }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="key"
                width={120}
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
                  radius={s === lastSpecies ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {chartData.length > 0 && (
        <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 p-4 font-medium text-slate-800">
            River totals, ranked
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">River</th>
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
                  <td className="px-4 py-2 font-medium">{row.key}</td>
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
