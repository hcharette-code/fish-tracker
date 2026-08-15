import { levenshtein } from './levenshtein'

// Common water-body descriptor words that get typed inconsistently — "Atway"
// vs "Atway River" should be treated as the same place. Only a single
// trailing suffix word is stripped for comparison, so this stays
// conservative (it won't merge genuinely different names like "Adam" and
// "Adams River").
const SUFFIX_WORDS = new Set([
  'river',
  'creek',
  'lake',
  'inlet',
  'slough',
  'bay',
  'channel',
  'pass',
  'canal',
  'narrows',
  'sound',
  'arm',
  'cove',
  'harbour',
  'harbor',
])

export function groupKey(raw: string): string {
  const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length > 1 && SUFFIX_WORDS.has(words[words.length - 1])) {
    words.pop()
  }
  return words.join(' ')
}

function hasSuffixWord(raw: string): boolean {
  const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return words.length > 1 && SUFFIX_WORDS.has(words[words.length - 1])
}

/** Picks the display label for a set of raw spellings of the same river:
 * prefers a variant with a recognized suffix word (the more complete name,
 * e.g. "Atway River" over "Atway"), then the most frequently used spelling,
 * then the longest, then alphabetical — so the result is deterministic. */
function canonicalLabel(variants: string[]): string {
  const counts = new Map<string, number>()
  for (const v of variants) counts.set(v, (counts.get(v) ?? 0) + 1)

  const withSuffix = Array.from(counts.keys()).filter(hasSuffixWord)
  const pool = withSuffix.length > 0 ? withSuffix : Array.from(counts.keys())

  return pool.sort(
    (a, b) => (counts.get(b)! - counts.get(a)!) || b.length - a.length || a.localeCompare(b)
  )[0]
}

/** Maps each raw river spelling found in `rows` to a shared canonical display label. */
export function buildRiverGroups(rows: { river: string }[]): Map<string, string> {
  const byKey = new Map<string, string[]>()
  for (const row of rows) {
    const key = groupKey(row.river)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(row.river)
  }

  const rawToCanonical = new Map<string, string>()
  for (const variants of byKey.values()) {
    const label = canonicalLabel(variants)
    for (const raw of variants) rawToCanonical.set(raw, label)
  }
  return rawToCanonical
}

export function canonicalRiver(riverGroups: Map<string, string>, raw: string): string {
  return riverGroups.get(raw) ?? raw
}

/**
 * Checks a river name being typed against a list of already-known rivers and
 * suggests a likely match if one looks like the same place — either a
 * suffix-word variant ("Ahnuhati" -> "Ahnuhati River") or a probable typo
 * (short edit distance). Returns null if the input already matches a known
 * river exactly, or if nothing is close enough to suggest confidently.
 */
export function suggestRiver(input: string, knownRivers: string[]): string | null {
  const trimmed = input.trim()
  if (trimmed.length < 3) return null

  const lower = trimmed.toLowerCase()
  if (knownRivers.some((k) => k.toLowerCase() === lower)) return null // already an exact match

  const inputKey = groupKey(trimmed)
  let best: { name: string; distance: number } | null = null

  for (const known of knownRivers) {
    if (groupKey(known) === inputKey) return known // e.g. "Ahnuhati" vs "Ahnuhati River"

    const distance = levenshtein(lower, known.toLowerCase())
    const threshold = Math.max(1, Math.floor(known.length * 0.25))
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { name: known, distance }
    }
  }

  return best?.name ?? null
}
