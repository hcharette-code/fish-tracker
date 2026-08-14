import { useMemo, useState } from 'react'
import { SPECIES_LABELS, SPECIES_OPTIONS, type PublicCatchLogRow } from '../../types/fish'
import { speciesDisplayLabel } from '../../lib/catchLogAggregate'

export default function AllEntriesView({ rows }: { rows: PublicCatchLogRow[] }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [riverFilter, setRiverFilter] = useState('')

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (startDate && r.entry_date < startDate) return false
      if (endDate && r.entry_date > endDate) return false
      if (riverFilter.trim() && !r.river.toLowerCase().includes(riverFilter.trim().toLowerCase())) return false
      return true
    })
  }, [rows, startDate, endDate, riverFilter])

  const rivers = useMemo(
    () => Array.from(new Set(filteredRows.map((r) => r.river))).sort(),
    [filteredRows]
  )
  const speciesColumns = useMemo(() => {
    const present = new Set(filteredRows.map((r) => speciesDisplayLabel(r)))
    const standard = SPECIES_OPTIONS.filter((s) => s !== 'other' && present.has(SPECIES_LABELS[s])).map(
      (s) => SPECIES_LABELS[s]
    )
    const custom = Array.from(present).filter((label) => !standard.includes(label)).sort()
    return [...standard, ...custom]
  }, [filteredRows])

  const pivot = useMemo(() => {
    const table = new Map<string, Map<string, number>>()
    for (const river of rivers) table.set(river, new Map())
    for (const row of filteredRows) {
      const label = speciesDisplayLabel(row)
      const riverMap = table.get(row.river)!
      riverMap.set(label, (riverMap.get(label) ?? 0) + row.count)
    }
    return table
  }, [filteredRows, rivers])

  return (
    <div className="space-y-6">
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
        <label className="text-sm">
          <span className="block text-slate-600">River contains</span>
          <input
            className="mt-1 rounded-md border border-slate-300 px-3 py-2"
            value={riverFilter}
            onChange={(e) => setRiverFilter(e.target.value)}
            placeholder="e.g. Dean"
          />
        </label>
        {(startDate || endDate || riverFilter) && (
          <button
            type="button"
            className="text-sm text-slate-600 underline"
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setRiverFilter('')
            }}
          >
            Clear filters
          </button>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 p-4 font-medium text-slate-800">River × Species</h2>
        {rivers.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No entries match these filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">River</th>
                {speciesColumns.map((s) => (
                  <th key={s} className="px-4 py-2 font-medium text-slate-600">
                    {s}
                  </th>
                ))}
                <th className="px-4 py-2 font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {rivers.map((river) => {
                const riverMap = pivot.get(river)!
                const total = Array.from(riverMap.values()).reduce((a, b) => a + b, 0)
                return (
                  <tr key={river} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium">{river}</td>
                    {speciesColumns.map((s) => (
                      <td key={s} className="px-4 py-2">
                        {riverMap.get(s) ?? 0}
                      </td>
                    ))}
                    <td className="px-4 py-2 font-semibold">{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 p-4 font-medium text-slate-800">Raw log</h2>
        {filteredRows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No entries match these filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Date</th>
                <th className="px-4 py-2 font-medium text-slate-600">River</th>
                <th className="px-4 py-2 font-medium text-slate-600">Species</th>
                <th className="px-4 py-2 font-medium text-slate-600">Count</th>
                <th className="px-4 py-2 font-medium text-slate-600">Trip</th>
                <th className="px-4 py-2 font-medium text-slate-600">Pilot</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.count_id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{row.entry_date}</td>
                  <td className="px-4 py-2">{row.river}</td>
                  <td className="px-4 py-2">{speciesDisplayLabel(row)}</td>
                  <td className="px-4 py-2">{row.count}</td>
                  <td className="px-4 py-2">{row.trip_label}</td>
                  <td className="px-4 py-2">{row.pilot ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
