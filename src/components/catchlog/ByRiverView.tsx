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
import { buildRiverGroups } from '../../lib/riverGroups'

function defaultSeasonRange() {
  const year = new Date().getFullYear()
  return { start: `${year}-06-01`, end: `${year}-10-31` }
}

export default function ByRiverView({ rows }: { rows: PublicCatchLogRow[] }) {
  // Different spellings of the same river ("Atway" / "Atway River") are
  // merged under one canonical label so they don't show up as separate rivers.
  const riverGroups = useMemo(() => buildRiverGroups(rows), [rows])
  const rivers = useMemo(
    () => Array.from(new Set(rows.map((r) => riverGroups.get(r.river) ?? r.river))).sort(),
    [rows, riverGroups]
  )
  const [river, setRiver] = useState('')

  const season = defaultSeasonRange()
  const [startDate, setStartDate] = useState(season.start)
  const [endDate, setEndDate] = useState(season.end)

  const effectiveRiver = river || rivers[0] || ''
  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (riverGroups.get(r.river) ?? r.river) === effectiveRiver &&
          (!startDate || r.entry_date >= startDate) &&
          (!endDate || r.entry_date <= endDate)
      ),
    [rows, riverGroups, effectiveRiver, startDate, endDate]
  )
  // Broken down by individual day within the selected range — the season
  // default just keeps the initial view from being overwhelmed by every
  // date ever logged.
  const chartData = useMemo(() => groupByDate(filteredRows), [filteredRows])
  const species = useMemo(() => presentSpecies(filteredRows), [filteredRows])
  const lastSpecies = species[species.length - 1]

  const isDefaultRange = startDate === season.start && endDate === season.end

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
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

      {effectiveRiver && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-1 font-medium text-slate-800">{effectiveRiver} — catch by date</h2>
          <p className="mb-4 text-sm text-slate-500">
            {filteredRows.reduce((sum, r) => sum + r.count, 0)} fish across {chartData.length}{' '}
            {chartData.length === 1 ? 'date' : 'dates'}
            {startDate || endDate ? ` (${startDate || '…'} to ${endDate || '…'})` : ''}
          </p>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500">No entries for this river in this date range.</p>
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
