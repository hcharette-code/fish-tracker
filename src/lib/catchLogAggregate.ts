import { SPECIES_LABELS, SPECIES_OPTIONS, type PublicCatchLogRow, type Species } from '../types/fish'
import { buildRiverGroups } from './riverGroups'

// One bar's worth of data: the dimension value (a date or a river) plus a
// count per species key, so Recharts can stack a <Bar> per species.
export type SpeciesBucketRow = {
  key: string
  total: number
} & Partial<Record<Species, number>>

/** Species present in `rows`, in the fixed palette/legend order (never sorted by rank). */
export function presentSpecies(rows: PublicCatchLogRow[]): Species[] {
  const present = new Set(rows.map((r) => r.species))
  return SPECIES_OPTIONS.filter((s) => present.has(s))
}

function bucketBy(rows: PublicCatchLogRow[], keyOf: (row: PublicCatchLogRow) => string): SpeciesBucketRow[] {
  const buckets = new Map<string, SpeciesBucketRow>()
  for (const row of rows) {
    const key = keyOf(row)
    if (!buckets.has(key)) buckets.set(key, { key, total: 0 })
    const bucket = buckets.get(key)!
    bucket[row.species] = (bucket[row.species] ?? 0) + row.count
    bucket.total += row.count
  }
  return Array.from(buckets.values())
}

/** One row per date, summed per species — for the "by river" time-series chart. */
export function groupByDate(rows: PublicCatchLogRow[]): SpeciesBucketRow[] {
  return bucketBy(rows, (r) => r.entry_date).sort((a, b) => a.key.localeCompare(b.key))
}

/** One row per river, summed per species, ranked highest-total first. Rivers
 * spelled differently ("Atway" vs "Atway River") are merged under one label. */
export function groupByRiver(rows: PublicCatchLogRow[]): SpeciesBucketRow[] {
  const riverGroups = buildRiverGroups(rows)
  return bucketBy(rows, (r) => riverGroups.get(r.river) ?? r.river).sort((a, b) => b.total - a.total)
}

/** One row per calendar month (YYYY-MM), summed per species — for the
 * month-over-month species trend chart. */
export function groupByMonth(rows: PublicCatchLogRow[]): SpeciesBucketRow[] {
  return bucketBy(rows, (r) => r.entry_date.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key))
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** "2026-08" -> "Aug 2026" */
export function monthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  const idx = Number(month) - 1
  return idx >= 0 && idx < 12 ? `${MONTH_NAMES[idx]} ${year}` : yyyyMm
}

export function speciesDisplayLabel(row: PublicCatchLogRow): string {
  return row.species === 'other' && row.other_species_label ? row.other_species_label : SPECIES_LABELS[row.species]
}
