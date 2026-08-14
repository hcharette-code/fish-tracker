import CatchReportForm from '../components/CatchReportForm'

export default function EntryForm() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Enter Catch Report</h1>
        <p className="text-sm text-slate-500">
          Guest last names are used only to link entries internally — they are never shown on this
          page or in the catch log.
        </p>
      </div>
      <CatchReportForm />
    </div>
  )
}
