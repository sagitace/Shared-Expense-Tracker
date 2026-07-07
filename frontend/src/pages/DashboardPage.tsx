import { useQuery } from '@tanstack/react-query'
import { Line } from 'react-chartjs-2'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import client from '@/api/client'
import type { DashboardResponse } from '@/api/types'
import StatCard from '@/components/StatCard'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export default function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await client.get<DashboardResponse>('/ledger/dashboard/')).data,
  })

  const labels = dashboard.data?.monthly_expense.map((row) => row.month) ?? []
  const values = dashboard.data?.monthly_expense.map((row) => row.total) ?? []

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total owed to you" value={`₱${Number(dashboard.data?.outstanding ?? 0).toLocaleString()}`} />
        <StatCard label="Collected" value={`₱${Number(dashboard.data?.total_paid ?? 0).toLocaleString()}`} />
        <StatCard label="Gross owed" value={`₱${Number(dashboard.data?.total_owed ?? 0).toLocaleString()}`} />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Monthly spend</h2>
          <div className="mt-4 h-72">
            <Line
              data={{
                labels,
                datasets: [
                  {
                    label: 'Spend',
                    data: values,
                    borderColor: '#f4b942',
                    backgroundColor: 'rgba(244,185,66,0.12)',
                    fill: true,
                    tension: 0.35,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#e5eefb' } } },
                scales: {
                  x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                  y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                },
              }}
            />
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Balances by friend</h2>
          <div className="mt-4 space-y-3">
            {dashboard.data?.by_friend.map((friend) => (
              <div key={friend.friend_id ?? friend.friend__name} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{friend.friend__name}</p>
                    <p className="text-sm text-slate-400">Owed: ₱{Number(friend.total_owed ?? 0).toLocaleString()}</p>
                  </div>
                  <p className="text-xl font-bold text-amber-300">₱{Number(friend.balance ?? 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {!dashboard.data?.by_friend.length ? <p className="text-sm text-slate-400">No receivables yet. Create an expense to start tracking balances.</p> : null}
          </div>
        </div>
      </section>
    </div>
  )
}
