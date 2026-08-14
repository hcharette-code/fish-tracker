import { useState } from 'react'
import CatchReportForm, { type TripDraft } from '../components/CatchReportForm'
import { prepareReportPhoto } from '../lib/imageUtils'
import { extractedReportToDrafts, type ExtractedReport } from '../lib/extractedReport'
import { todayIso } from '../components/CatchReportForm'
import type { CatchEntryDraft } from '../types/fish'

type Stage =
  | { status: 'idle' }
  | { status: 'working'; message: string }
  | { status: 'reviewing'; trip: TripDraft; entries: CatchEntryDraft[]; photoBlob: Blob; previewUrl: string }
  | { status: 'error'; message: string }

export default function UploadReport() {
  const [stage, setStage] = useState<Stage>({ status: 'idle' })

  async function handleFileSelected(file: File) {
    setStage({ status: 'working', message: 'Preparing photo…' })
    try {
      const prepared = await prepareReportPhoto(file)
      const previewUrl = URL.createObjectURL(prepared.blob)

      setStage({ status: 'working', message: 'Reading the report — this can take a few seconds…' })

      const res = await fetch('/.netlify/functions/extract-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageBase64: prepared.base64,
          mimeType: prepared.mimeType,
          todayIso: todayIso(),
        }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error ?? `Extraction failed (${res.status})`)
      }

      const { trip, entries } = extractedReportToDrafts(body as ExtractedReport)
      setStage({ status: 'reviewing', trip, entries, photoBlob: prepared.blob, previewUrl })
    } catch (err) {
      setStage({
        status: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong reading the photo.',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload Report Photo</h1>
        <p className="text-sm text-slate-500">
          Upload a photo of a handwritten camp report — it's read automatically, then you review and
          correct it before anything is saved.
        </p>
      </div>

      {(stage.status === 'idle' || stage.status === 'working' || stage.status === 'error') && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="block text-sm">
            <span className="text-slate-600">Report photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-1 block w-full text-sm"
              disabled={stage.status === 'working'}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFileSelected(file)
              }}
            />
          </label>
          {stage.status === 'working' && (
            <p className="mt-3 text-sm text-slate-500">{stage.message}</p>
          )}
          {stage.status === 'error' && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {stage.message}
            </div>
          )}
        </section>
      )}

      {stage.status === 'reviewing' && (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-medium text-slate-800">Original photo</h2>
            <img
              src={stage.previewUrl}
              alt="Uploaded camp report"
              className="max-h-96 rounded-md border border-slate-200 object-contain"
            />
          </section>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Handwriting varies — check every field below against the photo above before saving,
            especially dates and counts.
          </div>
          <CatchReportForm
            initialTrip={stage.trip}
            initialEntries={stage.entries}
            sourcePhoto={stage.photoBlob}
            submitLabel="Save reviewed report"
            onSaved={() => setStage({ status: 'idle' })}
          />
        </>
      )}
    </div>
  )
}
