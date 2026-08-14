import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AccessGate from './components/AccessGate'
import Nav from './components/Nav'
import EntryForm from './pages/EntryForm'
import UploadReport from './pages/UploadReport'
import CatchLog from './pages/CatchLog'
import { isSupabaseConfigured } from './lib/supabaseClient'

function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md space-y-3 rounded-lg border border-red-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-red-700">Configuration missing</h1>
        <p className="text-sm text-slate-600">
          This deploy is missing <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and/or{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code>. Add them in Netlify under{' '}
          <strong>Site settings → Environment variables</strong>, then trigger a new deploy — env vars only
          take effect on builds that happen after they're saved.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <ConfigError />

  return (
    <AccessGate>
      <BrowserRouter>
        <div className="min-h-screen">
          <Nav />
          <main className="mx-auto max-w-5xl px-4 py-6">
            <Routes>
              <Route path="/" element={<EntryForm />} />
              <Route path="/upload" element={<UploadReport />} />
              <Route path="/catch-log" element={<CatchLog />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AccessGate>
  )
}
