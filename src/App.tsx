import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AccessGate from './components/AccessGate'
import Nav from './components/Nav'
import EntryForm from './pages/EntryForm'
import UploadReport from './pages/UploadReport'
import CatchLog from './pages/CatchLog'

export default function App() {
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
