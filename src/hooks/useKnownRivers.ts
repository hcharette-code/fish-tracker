import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { buildRiverGroups } from '../lib/riverGroups'

/** Distinct canonical river names already logged, for "did you mean...?" typo
 * suggestions while entering a new report. Reads only the public_catch_log
 * view (river names aren't sensitive — no guest data involved). */
export function useKnownRivers(): string[] {
  const [rivers, setRivers] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from('public_catch_log').select('river')
      if (cancelled || error || !data) return
      const rows = data as { river: string }[]
      const groups = buildRiverGroups(rows)
      const canonicalSet = new Set(rows.map((r) => groups.get(r.river) ?? r.river))
      setRivers(Array.from(canonicalSet).sort())
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return rivers
}
