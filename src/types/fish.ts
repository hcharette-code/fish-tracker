// Keep in sync with the `species_type` enum in supabase/migrations/0001_init.sql
export const SPECIES_OPTIONS = [
  'coho',
  'chinook',
  'pink',
  'chum',
  'sockeye',
  'steelhead',
  'other',
] as const

export type Species = (typeof SPECIES_OPTIONS)[number]

export const SPECIES_LABELS: Record<Species, string> = {
  coho: 'Coho',
  chinook: 'Chinook',
  pink: 'Pink',
  chum: 'Chum',
  sockeye: 'Sockeye',
  steelhead: 'Steelhead',
  other: 'Other',
}

// One species + count line within a catch entry
export interface CatchCountDraft {
  species: Species
  otherSpeciesLabel: string
  count: string // kept as string while editing, parsed to int on submit
}

// One "Date / guest / river / species+counts" entry, matching a line on a
// paper camp report
export interface CatchEntryDraft {
  entryDate: string
  guestLastName: string
  river: string
  counts: CatchCountDraft[]
}

// Row shape returned by the public_catch_log view (no guest name / guest_id,
// no group_name — trip_label is a non-identifying "Trip 1" style stand-in)
export interface PublicCatchLogRow {
  entry_id: string
  entry_date: string
  river: string
  trip_label: string
  pilot: string | null
  count_id: string
  species: Species
  other_species_label: string | null
  count: number
}
