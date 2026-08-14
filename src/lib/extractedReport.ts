import type { CatchEntryDraft } from '../types/fish'
import type { TripDraft } from '../components/CatchReportForm'

// Mirrors netlify/functions/lib/extractReport.ts's ExtractedReport shape —
// duplicated (not imported) because the frontend and the Netlify function
// are separate build contexts in this project.
export interface ExtractedCatch {
  species: 'coho' | 'chinook' | 'pink' | 'chum' | 'sockeye' | 'steelhead' | 'other'
  other_species_label: string
  count: number
}
export interface ExtractedEntry {
  entry_date: string
  guest_name: string
  river: string
  catches: ExtractedCatch[]
}
export interface ExtractedReport {
  group_name: string
  pilot: string
  trip_start_date: string
  trip_end_date: string
  entries: ExtractedEntry[]
}

/** Converts the OCR function's output into the same draft shape the digital entry form edits. */
export function extractedReportToDrafts(extracted: ExtractedReport): {
  trip: TripDraft
  entries: CatchEntryDraft[]
} {
  return {
    trip: {
      groupName: extracted.group_name ?? '',
      pilot: extracted.pilot ?? '',
      startDate: extracted.trip_start_date ?? '',
      endDate: extracted.trip_end_date ?? '',
    },
    entries: extracted.entries.map((entry) => ({
      entryDate: entry.entry_date ?? '',
      guestLastName: entry.guest_name ?? '',
      river: entry.river ?? '',
      counts:
        entry.catches.length > 0
          ? entry.catches.map((c) => ({
              species: c.species,
              otherSpeciesLabel: c.other_species_label ?? '',
              count: String(c.count),
            }))
          : [{ species: 'coho', otherSpeciesLabel: '', count: '' }],
    })),
  }
}
