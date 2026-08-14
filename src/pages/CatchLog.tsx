import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { PublicCatchLogRow } from '../types/fish'
import ByRiverView from '../components/catchlog/ByRiverView'
import ByDateView from '../components/catchlog/ByDateView'
import AllEntriesView from '../components/catchlog/AllEntriesView'

const TABS = [
  { id: 'byRiver', label: 'By River' },
  { id: 'byDate', label: 'By Date' },
  { id: 'all', label: 'All Entries' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function CatchLog() {
  const [rows, setRows] = useState<PublicCatchLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('byRiver')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      // Reads only from the public_catch_log view, which never includes a
      // guest name, guest_id, or group_name.
      const { data, error } = await supabase
        .from('public_catch_log')
        .select('*')
        .order('entry_date', { ascending: false })
      if (cancelled) return
      if (error) setError(error.message)
      else setRows((data ?? []) as PublicCatchLogRow[])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Catch Log</h1>
        <p className="text-sm text-slate-500">River, species, and date only — no guest names.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && (
        <>
          {tab === 'byRiver' && <ByRiverView rows={rows} />}
          {tab === 'byDate' && <ByDateView rows={rows} />}
          {tab === 'all' && <AllEntriesView rows={rows} />}
        </>
      )}
    </div>
  )
}
