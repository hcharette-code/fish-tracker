import { SPECIES_OPTIONS, type Species } from '../types/fish'

// Validated categorical palette (light mode) — see dataviz skill palette.md.
// Assigned in FIXED order, matching SPECIES_OPTIONS — never reordered/cycled,
// so a species always carries the same color everywhere it appears.
const CATEGORICAL_SLOTS: Record<Species, string> = {
  coho: '#2a78d6', // slot 1 blue
  chinook: '#eb6834', // slot 2 orange
  pink: '#1baf7a', // slot 3 aqua
  chum: '#eda100', // slot 4 yellow
  sockeye: '#e87ba4', // slot 5 magenta
  steelhead: '#008300', // slot 6 green
  other: '#4a3aa7', // slot 7 violet
}

export function speciesColor(species: Species): string {
  return CATEGORICAL_SLOTS[species]
}

// Chart chrome tokens (light mode — this app has no dark theme yet)
export const CHART_INK = {
  surface: '#fcfcfb',
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  gridline: '#e1e0d9',
  baseline: '#c3c2b7',
}

// Fixed legend order — same order everywhere, never derived from which
// species happens to have the most fish in a given filter.
export const SPECIES_ORDER = SPECIES_OPTIONS
