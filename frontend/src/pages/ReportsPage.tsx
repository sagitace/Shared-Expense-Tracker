export default function ReportsPage() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold">Reports</h2>
      <p className="mt-2 text-sm text-slate-400">
        CSV and PDF export hooks belong here. The backend already exposes the aggregated dashboard data, so the next step is to add dedicated export endpoints for scheduled or on-demand reporting.
      </p>
    </div>
  )
}
