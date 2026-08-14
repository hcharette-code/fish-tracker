import { useEffect, useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import {
  SPECIES_LABELS,
  SPECIES_OPTIONS,
  type CatchCountDraft,
  type CatchEntryDraft,
} from '../types/fish'

export interface TripDraft {
  groupName: string
  pilot: string
  startDate: string
  endDate: string
}

// One river fished on a given day — nested under a DayBlockDraft. Guest last
// name lives here (not per species row) since a river visit is normally one
// guest/group at one place; if two guests fish the same river on the same
// day, add a second river block with the same river name.
export interface RiverEntryDraft {
  river: string
  guestLastName: string
  counts: CatchCountDraft[]
}

// One calendar date, holding every river fished that day — mirrors the
// paper report's layout (a dated block containing several river rows).
export interface DayBlockDraft {
  date: string
  rivers: RiverEntryDraft[]
}

function emptyCount(): CatchCountDraft {
  return { species: 'coho', otherSpeciesLabel: '', count: '' }
}

function emptyRiverEntry(defaultGuestName: string): RiverEntryDraft {
  return { river: '', guestLastName: defaultGuestName, counts: [emptyCount()] }
}

function emptyDay(date: string, defaultGuestName: string): DayBlockDraft {
  return { date, rivers: [emptyRiverEntry(defaultGuestName)] }
}

/** Groups a flat entry list (e.g. from OCR extraction) into day blocks, preserving order. */
function groupEntriesIntoDays(entries: CatchEntryDraft[]): DayBlockDraft[] {
  const order: string[] = []
  const byDate = new Map<string, RiverEntryDraft[]>()
  for (const e of entries) {
    if (!byDate.has(e.entryDate)) {
      byDate.set(e.entryDate, [])
      order.push(e.entryDate)
    }
    byDate.get(e.entryDate)!.push({ river: e.river, guestLastName: e.guestLastName, counts: e.counts })
  }
  return order.map((date) => ({ date, rivers: byDate.get(date)! }))
}

function flattenDaysToEntries(days: DayBlockDraft[]): { entry: CatchEntryDraft; label: string }[] {
  const result: { entry: CatchEntryDraft; label: string }[] = []
  days.forEach((day, dayIdx) => {
    day.rivers.forEach((river, riverIdx) => {
      result.push({
        entry: { entryDate: day.date, guestLastName: river.guestLastName, river: river.river, counts: river.counts },
        label: `${day.date || `Day ${dayIdx + 1}`}, river ${riverIdx + 1}`,
      })
    })
  })
  return result
}

export function todayIso() {
  // Local date, not UTC — toISOString() would roll over to the next day
  // for several hours every evening in timezones behind UTC (e.g. Pacific).
  return formatIsoDate(new Date())
}

function formatIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Every calendar date from start to end (inclusive), capped at 30 days as a sanity limit. */
function datesInRange(start: string, end: string): string[] {
  if (!start) return []
  const effectiveEnd = end || start
  const startD = new Date(`${start}T00:00:00`)
  const endD = new Date(`${effectiveEnd}T00:00:00`)
  if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime()) || endD < startD) return [start]

  const dates: string[] = []
  const cursor = new Date(startD)
  let guard = 0
  while (cursor.getTime() <= endD.getTime() && guard < 30) {
    dates.push(formatIsoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  return dates
}

export function emptyTripDraft(): TripDraft {
  return { groupName: '', pilot: '', startDate: todayIso(), endDate: '' }
}

// Validates + coerces the in-progress form state right before we write to
// Supabase. Kept separate from the raw draft types so the inputs can stay
// as free-form strings while the user is typing.
const countSchema = z
  .object({
    species: z.enum(SPECIES_OPTIONS),
    otherSpeciesLabel: z.string(),
    count: z.string(),
  })
  .transform((c, ctx) => {
    const count = Number(c.count)
    if (c.count.trim() === '' || Number.isNaN(count) || count < 0 || !Number.isInteger(count)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Count must be a whole number, 0 or more' })
      return z.NEVER
    }
    if (c.species === 'other' && c.otherSpeciesLabel.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Describe the "Other" species' })
      return z.NEVER
    }
    return { species: c.species, otherSpeciesLabel: c.otherSpeciesLabel.trim(), count }
  })

const entrySchema = z
  .object({
    entryDate: z.string().min(1, 'Date is required'),
    guestLastName: z.string().trim().min(1, 'Guest last name is required'),
    river: z.string().trim().min(1, 'River / location is required'),
    counts: z.array(countSchema).min(1),
  })
  .transform((e, ctx) => {
    const nonZero = e.counts.filter((c) => c.count > 0)
    if (nonZero.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter at least one species with a count > 0' })
      return z.NEVER
    }
    return { ...e, counts: nonZero }
  })

const tripSchema = z
  .object({
    groupName: z.string().trim().min(1, 'Group name is required'),
    pilot: z.string().trim(),
    startDate: z.string().min(1, 'Trip start date is required'),
    endDate: z.string(),
  })
  .refine((t) => t.endDate === '' || t.endDate >= t.startDate, {
    message: 'Trip end date cannot be before the start date',
    path: ['endDate'],
  })

type SubmitState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'success'; entryCount: number }
  | { status: 'error'; message: string }

export default function CatchReportForm({
  initialTrip,
  initialEntries,
  sourcePhoto,
  submitLabel = 'Save report',
  onSaved,
}: {
  initialTrip?: TripDraft
  initialEntries?: CatchEntryDraft[]
  /** Resized JPEG of the original paper report, uploaded to Storage on save (OCR review flow only). */
  sourcePhoto?: Blob
  submitLabel?: string
  onSaved?: () => void
}) {
  const [groupName, setGroupName] = useState(initialTrip?.groupName ?? '')
  const [pilot, setPilot] = useState(initialTrip?.pilot ?? '')
  const [startDate, setStartDate] = useState(initialTrip?.startDate ?? todayIso())
  const [endDate, setEndDate] = useState(initialTrip?.endDate ?? '')
  const [days, setDays] = useState<DayBlockDraft[]>(() =>
    initialEntries && initialEntries.length > 0
      ? groupEntriesIntoDays(initialEntries)
      : [emptyDay(initialTrip?.startDate ?? todayIso(), initialTrip?.groupName ?? '')]
  )
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' })

  // Keeps day dates in sync with the Trip date range so you only ever type a
  // date once: changing the trip start date renames whichever day block was
  // still sitting at the old default, and widening the start/end range
  // auto-adds a blank day for every new calendar date so you just fill in
  // rivers + fish for each one.
  const prevStartDateRef = useRef(initialTrip?.startDate ?? todayIso())
  useEffect(() => {
    const prevStart = prevStartDateRef.current
    const rangeDates = datesInRange(startDate, endDate)
    setDays((prev) => {
      let next = prev
      if (prevStart && startDate && prevStart !== startDate) {
        next = next.map((d) => (d.date === prevStart ? { ...d, date: startDate } : d))
      }
      const existingDates = new Set(next.map((d) => d.date))
      const missing = rangeDates.filter((dt) => !existingDates.has(dt))
      if (missing.length > 0) {
        next = [...next, ...missing.map((dt) => emptyDay(dt, groupName))].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      }
      return next
    })
    prevStartDateRef.current = startDate
    // groupName intentionally omitted — only used to seed newly-added days, shouldn't retrigger this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  // Keeps each river's guest field in sync with Group name until manually
  // overridden — so re-typing the family name per river isn't necessary.
  const prevGroupNameRef = useRef(initialTrip?.groupName ?? '')
  useEffect(() => {
    const prev = prevGroupNameRef.current
    if (prev !== groupName) {
      setDays((prevDays) =>
        prevDays.map((day) => ({
          ...day,
          rivers: day.rivers.map((r) => (r.guestLastName === prev ? { ...r, guestLastName: groupName } : r)),
        }))
      )
      prevGroupNameRef.current = groupName
    }
  }, [groupName])

  function updateDay(dayIdx: number, patch: Partial<DayBlockDraft>) {
    setDays((prev) => prev.map((d, i) => (i === dayIdx ? { ...d, ...patch } : d)))
  }

  function addDay() {
    setDays((prev) => [...prev, emptyDay(endDate || startDate || todayIso(), groupName)])
  }

  function removeDay(dayIdx: number) {
    setDays((prev) => prev.filter((_, i) => i !== dayIdx))
  }

  function updateRiver(dayIdx: number, riverIdx: number, patch: Partial<RiverEntryDraft>) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIdx ? { ...d, rivers: d.rivers.map((r, j) => (j === riverIdx ? { ...r, ...patch } : r)) } : d
      )
    )
  }

  function addRiver(dayIdx: number) {
    setDays((prev) =>
      prev.map((d, i) => (i === dayIdx ? { ...d, rivers: [...d.rivers, emptyRiverEntry(groupName)] } : d))
    )
  }

  function removeRiver(dayIdx: number, riverIdx: number) {
    setDays((prev) =>
      prev.map((d, i) => (i === dayIdx ? { ...d, rivers: d.rivers.filter((_, j) => j !== riverIdx) } : d))
    )
  }

  function updateCount(dayIdx: number, riverIdx: number, countIdx: number, patch: Partial<CatchCountDraft>) {
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIdx
          ? d
          : {
              ...d,
              rivers: d.rivers.map((r, j) =>
                j !== riverIdx
                  ? r
                  : { ...r, counts: r.counts.map((c, k) => (k === countIdx ? { ...c, ...patch } : c)) }
              ),
            }
      )
    )
  }

  function addCount(dayIdx: number, riverIdx: number) {
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIdx
          ? d
          : { ...d, rivers: d.rivers.map((r, j) => (j !== riverIdx ? r : { ...r, counts: [...r.counts, emptyCount()] })) }
      )
    )
  }

  function removeCount(dayIdx: number, riverIdx: number, countIdx: number) {
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIdx
          ? d
          : {
              ...d,
              rivers: d.rivers.map((r, j) =>
                j !== riverIdx
                  ? r
                  : { ...r, counts: r.counts.length === 1 ? r.counts : r.counts.filter((_, k) => k !== countIdx) }
              ),
            }
      )
    )
  }

  function resetForm() {
    const today = todayIso()
    setGroupName('')
    setPilot('')
    setStartDate(today)
    setEndDate('')
    setDays([emptyDay(today, '')])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors([])
    setSubmit({ status: 'idle' })

    const errors: string[] = []

    const tripResult = tripSchema.safeParse({ groupName, pilot, startDate, endDate })
    if (!tripResult.success) {
      errors.push(...tripResult.error.issues.map((i) => i.message))
    }

    const flattened = flattenDaysToEntries(days)
    if (flattened.length === 0) {
      errors.push('Add at least one river with a catch to save.')
    }

    const parsedEntries: z.infer<typeof entrySchema>[] = []
    flattened.forEach(({ entry, label }) => {
      const result = entrySchema.safeParse(entry)
      if (!result.success) {
        result.error.issues.forEach((issue) => errors.push(`${label}: ${issue.message}`))
      } else {
        parsedEntries.push(result.data)
      }
    })

    if (errors.length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmit({ status: 'saving' })
    try {
      const trip = tripResult.data!

      // When a source photo is attached (OCR review flow), pre-generate the
      // trip id so the photo can be uploaded to a path keyed by it and the
      // trip row created with that path already set — anon only has INSERT
      // on trips, not UPDATE, so this has to happen in one insert.
      let reportPhotoPath: string | null = null
      const tripId = sourcePhoto ? crypto.randomUUID() : undefined
      if (sourcePhoto && tripId) {
        reportPhotoPath = `${tripId}/report.jpg`
        const { error: uploadError } = await supabase.storage
          .from('report-photos')
          .upload(reportPhotoPath, sourcePhoto, { contentType: 'image/jpeg', upsert: false })
        if (uploadError) throw uploadError
      }

      const { data: tripRow, error: tripError } = await supabase
        .from('trips')
        .insert({
          ...(tripId ? { id: tripId } : {}),
          group_name: trip.groupName,
          pilot: trip.pilot || null,
          start_date: trip.startDate,
          end_date: trip.endDate || null,
          report_photo_path: reportPhotoPath,
        })
        .select('id')
        .single()
      if (tripError || !tripRow) throw tripError ?? new Error('Could not create trip')

      for (const entry of parsedEntries) {
        // Resolves/creates the guest by last name without ever reading the
        // guest table's contents (see get_or_create_guest in the migration).
        const { data: guestId, error: guestError } = await supabase.rpc('get_or_create_guest', {
          p_last_name: entry.guestLastName,
        })
        if (guestError || !guestId) throw guestError ?? new Error('Could not resolve guest')

        const { data: entryRow, error: entryError } = await supabase
          .from('catch_entries')
          .insert({
            trip_id: tripRow.id,
            guest_id: guestId,
            entry_date: entry.entryDate,
            river: entry.river,
          })
          .select('id')
          .single()
        if (entryError || !entryRow) throw entryError ?? new Error('Could not save entry')

        const countsPayload = entry.counts.map((c) => ({
          entry_id: entryRow.id,
          species: c.species,
          other_species_label: c.species === 'other' ? c.otherSpeciesLabel : null,
          count: c.count,
        }))
        const { error: countsError } = await supabase.from('catch_counts').insert(countsPayload)
        if (countsError) throw countsError
      }

      setSubmit({ status: 'success', entryCount: parsedEntries.length })
      resetForm()
      onSaved?.()
    } catch (err) {
      setSubmit({
        status: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong saving the report.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-medium text-slate-800">Trip</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Group name</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Anderson Party"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Pilot</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={pilot}
              onChange={(e) => setPilot(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Trip start date</span>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Trip end date (optional)</span>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        {endDate && endDate > startDate && (
          <p className="mt-2 text-sm text-slate-500">
            A day block below is auto-added for each date from {startDate} to {endDate} — just fill in
            rivers and fish for each one.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-800">Catch entries by day</h2>
          <button
            type="button"
            onClick={addDay}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            + Add day
          </button>
        </div>

        {days.map((day, dayIdx) => (
          <div key={dayIdx} className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-end justify-between gap-4">
              <label className="block text-sm">
                <span className="text-slate-600">Date</span>
                <input
                  type="date"
                  className="mt-1 rounded-md border border-slate-300 px-3 py-2"
                  value={day.date}
                  onChange={(e) => updateDay(dayIdx, { date: e.target.value })}
                />
              </label>
              <button
                type="button"
                onClick={() => removeDay(dayIdx)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove day
              </button>
            </div>

            {day.rivers.length === 0 && (
              <p className="text-sm text-slate-500">No rivers logged for this day yet.</p>
            )}

            {day.rivers.map((river, riverIdx) => (
              <div key={riverIdx} className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    River {riverIdx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRiver(dayIdx, riverIdx)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove river
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-slate-600">River / location</span>
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                      value={river.river}
                      onChange={(e) => updateRiver(dayIdx, riverIdx, { river: e.target.value })}
                      placeholder="e.g. Dean River"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">
                      Guest last name{' '}
                      <span className="text-slate-400">(internal use only, never shown publicly)</span>
                    </span>
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                      value={river.guestLastName}
                      onChange={(e) => updateRiver(dayIdx, riverIdx, { guestLastName: e.target.value })}
                      placeholder="e.g. Anderson"
                      autoComplete="off"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <span className="text-sm text-slate-600">Species &amp; count</span>
                  {river.counts.map((count, countIdx) => (
                    <div key={countIdx} className="flex flex-wrap items-center gap-2">
                      <select
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        value={count.species}
                        onChange={(e) =>
                          updateCount(dayIdx, riverIdx, countIdx, {
                            species: e.target.value as CatchCountDraft['species'],
                          })
                        }
                      >
                        {SPECIES_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {SPECIES_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      {count.species === 'other' && (
                        <input
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          placeholder="Describe species"
                          value={count.otherSpeciesLabel}
                          onChange={(e) =>
                            updateCount(dayIdx, riverIdx, countIdx, { otherSpeciesLabel: e.target.value })
                          }
                        />
                      )}
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Count"
                        value={count.count}
                        onChange={(e) => updateCount(dayIdx, riverIdx, countIdx, { count: e.target.value })}
                      />
                      {river.counts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCount(dayIdx, riverIdx, countIdx)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addCount(dayIdx, riverIdx)}
                    className="text-sm text-slate-600 underline hover:text-slate-900"
                  >
                    + Add another species
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addRiver(dayIdx)}
              className="text-sm text-slate-600 underline hover:text-slate-900"
            >
              + Add river to this day
            </button>
          </div>
        ))}
      </section>

      {fieldErrors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <ul className="list-inside list-disc">
            {fieldErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {submit.status === 'error' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {submit.message}
        </div>
      )}
      {submit.status === 'success' && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Saved {submit.entryCount} catch {submit.entryCount === 1 ? 'entry' : 'entries'}.
        </div>
      )}

      <button
        type="submit"
        disabled={submit.status === 'saving'}
        className="rounded-md bg-slate-900 px-5 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {submit.status === 'saving' ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
