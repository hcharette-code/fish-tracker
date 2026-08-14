import { useState, type FormEvent, type ReactNode } from 'react'

const STORAGE_KEY = 'fish-tracker-access-unlocked'
const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE ?? ''

// A shared-passphrase gate, NOT real authentication — it's a client-side
// check, so the code is visible in the browser bundle/dev tools, and it does
// not restrict direct calls to the Supabase REST API (those are governed by
// the RLS policies in supabase/migrations). It's a deterrent to keep casual
// visitors from stumbling onto the entry form, not a security boundary. The
// real login (email + hashed password via Supabase Auth) is the guest-info
// section, built in a later phase.
export default function AccessGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return <>{children}</>

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (ACCESS_CODE && code === ACCESS_CODE) {
      localStorage.setItem(STORAGE_KEY, 'true')
      setUnlocked(true)
    } else {
      setError(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div>
          <h1 className="text-lg font-semibold">🎣 Fish Tracker</h1>
          <p className="text-sm text-slate-500">Enter the access code to continue.</p>
        </div>
        <input
          type="password"
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError(false)
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          placeholder="Access code"
        />
        {error && <p className="text-sm text-red-600">That code isn't right.</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
        >
          Continue
        </button>
      </form>
    </div>
  )
}
