import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import type { MonthlyReport } from '@/api/types'
import StatCard from '@/components/StatCard'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ReportsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const report = useQuery({
    queryKey: ['monthly-report', year, month],
    queryFn: async () => (await client.get<MonthlyReport>('/ledger/reports/monthly/', { params: { year, month } })).data,
  })

  const years = report.data?.available_years?.length ? report.data.available_years : [now.getFullYear()]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3"
          value={month}
          onChange={(event) => setMonth(Number(event.target.value))}
        >
          {MONTHS.map((label, index) => (
            <option key={label} value={index + 1}>{label}</option>
          ))}
        </select>
        <select
          className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3"
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        >
          {years.map((yearOption) => (
            <option key={yearOption} value={yearOption}>{yearOption}</option>
          ))}
        </select>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <StatCard label="Total owed this month" value={`₱${Number(report.data?.total_owed ?? 0).toLocaleString()}`} />
        <StatCard label="Collected this month" value={`₱${Number(report.data?.collected_amount ?? 0).toLocaleString()}`} />
      </section>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">Friends who borrowed</h2>
        <div className="mt-4 space-y-3">
          {report.data?.friends_borrowed.map((friend) => (
            <div key={friend.friend_id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold">{friend.friend__name}</p>
                <div className="text-right text-sm">
                  <p className="text-slate-400">Owed: ₱{Number(friend.amount_owed).toLocaleString()}</p>
                  <p className="text-slate-400">Paid: ₱{Number(friend.amount_paid).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
          {!report.data?.friends_borrowed.length ? <p className="text-sm text-slate-400">No one borrowed this month.</p> : null}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">Expenses this month</h2>
        <div className="mt-4 space-y-4">
          {report.data?.expenses.map((expense) => (
            <div key={expense.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{expense.description}</p>
                  <p className="text-sm text-slate-400">{expense.date} • {expense.category_name ?? 'No category'}</p>
                </div>
                <p className="text-lg font-bold text-white">₱{expense.total_amount}</p>
              </div>
              <div className="mt-3 space-y-2">
                {expense.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-medium text-slate-200">{item.name}</p>
                      <p className="text-slate-300">₱{item.price}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.participants.map((participant, participantIndex) => (
                        <span key={participantIndex} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                          {participant.friend_name}: ₱{participant.share}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!report.data?.expenses.length ? <p className="text-sm text-slate-400">No expenses this month.</p> : null}
        </div>
      </div>
    </div>
  )
}
