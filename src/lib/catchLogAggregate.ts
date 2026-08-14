import { SPECIES_LABELS, SPECIES_OPTIONS, type PublicCatchLogRow, type Species } from '../types/fish'

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

/** One row per river, summed per species, ranked highest-total first. */
export function groupByRiver(rows: PublicCatchLogRow[]): SpeciesBucketRow[] {
  return bucketBy(rows, (r) => r.river).sort((a, b) => b.total - a.total)
}

export function speciesDisplayLabel(row: PublicCatchLogRow): string {
  return row.species === 'other' && row.other_species_label ? row.other_species_label : SPECIES_LABELS[row.species]
}
