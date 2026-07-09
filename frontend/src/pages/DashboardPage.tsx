import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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

const peso = (value: number) => `₱${Number(value ?? 0).toLocaleString()}`

export default function DashboardPage() {
  const navigate = useNavigate()
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await client.get<DashboardResponse>('/ledger/dashboard/')).data,
  })

  const labels = dashboard.data?.monthly_expense.map((row) => row.month) ?? []
  const values = dashboard.data?.monthly_expense.map((row) => row.total) ?? []

  const totalOwed = dashboard.data?.total_owed ?? 0
  const totalPaid = dashboard.data?.total_paid ?? 0
  const collectionRate = totalOwed > 0 ? Math.min(100, Math.round((totalPaid / totalOwed) * 100)) : 0

  const categoryTotal = dashboard.data?.spending_by_category.reduce((sum, row) => sum + Number(row.total ?? 0), 0) ?? 0

  const activityColor = (type: 'expense' | 'payment_received' | 'payment_sent') =>
    type === 'payment_received' ? 'text-emerald-300' : 'text-rose-300'
  const activitySign = (type: 'expense' | 'payment_received' | 'payment_sent') => (type === 'payment_received' ? '+' : '-')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => navigate('/expenses', { state: { openAdd: true } })}
          className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-200"
        >
          + Add expense
        </button>
        <button
          type="button"
          onClick={() => navigate('/payments', { state: { openAdd: true } })}
          className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
        >
          + Record payment
        </button>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total owed to you" value={peso(dashboard.data?.outstanding ?? 0)} />
        <StatCard label="You owe" value={peso(dashboard.data?.outstanding_by_me ?? 0)} />
        <StatCard label="Collected" value={peso(totalPaid)} />
        <StatCard label="Gross owed" value={peso(totalOwed)} />
        <StatCard label="My share" value={peso(dashboard.data?.my_share ?? 0)} subtext="Your own portion, not reimbursable" />
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Collected vs outstanding</h2>
          <span className="text-sm text-slate-400">{collectionRate}% collected</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${collectionRate}%` }} />
        </div>
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
                  y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                  },
                },
              }}
            />
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Balances by friend</h2>
          <div className="mt-4 space-y-3">
            {dashboard.data?.by_friend.map((friend) => {
              const owedToMeOutstanding = friend.total_owed - friend.total_paid
              const owedByMeOutstanding = friend.owed_by_me - friend.paid_by_me
              const theyOweYou = friend.balance >= 0
              return (
                <div key={friend.friend_id ?? friend.friend__name} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{friend.friend__name}</p>
                      <p className="text-sm text-slate-400">{theyOweYou ? 'Owes you' : 'You owe'}</p>
                    </div>
                    <p className={`text-xl font-bold ${theyOweYou ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {peso(Math.abs(friend.balance))}
                    </p>
                  </div>
                  {owedToMeOutstanding > 0 && owedByMeOutstanding > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      They owe you {peso(owedToMeOutstanding)} • You owe them {peso(owedByMeOutstanding)}
                    </p>
                  ) : null}
                </div>
              )
            })}
            {!dashboard.data?.by_friend.length ? <p className="text-sm text-slate-400">No receivables yet. Create an expense to start tracking balances.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Spending by category</h2>
          <div className="mt-4 space-y-3">
            {dashboard.data?.spending_by_category.map((row) => {
              const share = categoryTotal > 0 ? Math.round((Number(row.total) / categoryTotal) * 100) : 0
              return (
                <div key={row.category_label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-200">{row.category_label}</span>
                    <span className="text-slate-400">{peso(row.total)} • {share}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-amber-300" style={{ width: `${share}%` }} />
                  </div>
                </div>
              )
            })}
            {!dashboard.data?.spending_by_category.length ? <p className="text-sm text-slate-400">No expenses yet.</p> : null}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <div className="mt-4 space-y-3">
            {dashboard.data?.recent_activity.map((entry) => (
              <div key={`${entry.type}-${entry.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div>
                  <p className="font-semibold text-white">{entry.description}</p>
                  <p className="text-sm text-slate-400">{entry.date}</p>
                </div>
                <p className={`text-lg font-bold ${activityColor(entry.type)}`}>
                  {activitySign(entry.type)}{peso(entry.amount)}
                </p>
              </div>
            ))}
            {!dashboard.data?.recent_activity.length ? <p className="text-sm text-slate-400">No activity yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  )
}
