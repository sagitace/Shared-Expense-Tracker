import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import client from '@/api/client'
import type { Friend, Payment, Receivable } from '@/api/types'

export default function PaymentsPage() {
  const queryClient = useQueryClient()
  const friends = useQuery({ queryKey: ['friends'], queryFn: async () => (await client.get<Friend[]>('/ledger/friends/')).data })
  const receivables = useQuery({ queryKey: ['receivables'], queryFn: async () => (await client.get<Receivable[]>('/ledger/receivables/')).data })
  const payments = useQuery({ queryKey: ['payments'], queryFn: async () => (await client.get<Payment[]>('/ledger/payments/')).data })
  const { register, handleSubmit, reset } = useForm<{ friend: number; amount: string; date: string; method: 'cash' | 'bank' | 'gcash' | 'other'; notes: string }>()

  const createPayment = useMutation({
    mutationFn: async (payload: { friend: number; amount: string; date: string; method: 'cash' | 'bank' | 'gcash' | 'other'; notes: string }) => client.post('/ledger/payments/', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] })
      await queryClient.invalidateQueries({ queryKey: ['receivables'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      reset()
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <form className="rounded-3xl border border-white/10 bg-white/5 p-5" onSubmit={handleSubmit((values) => createPayment.mutate(values))}>
        <h2 className="text-lg font-semibold">Record payment</h2>
        <div className="mt-4 space-y-3">
          <select className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" {...register('friend', { valueAsNumber: true })}>
            <option value="">Select friend</option>
            {friends.data?.map((friend) => (
              <option key={friend.id} value={friend.id}>{friend.name}</option>
            ))}
          </select>
          <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" type="number" step="0.01" placeholder="Amount" {...register('amount')} />
          <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" type="date" {...register('date')} />
          <select className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" {...register('method')}>
            <option value="cash">Cash</option>
            <option value="bank">Bank Transfer</option>
            <option value="gcash">GCash</option>
            <option value="other">Other</option>
          </select>
          <textarea className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" rows={4} placeholder="Notes" {...register('notes')} />
          <button className="w-full rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950">Save payment</button>
        </div>
      </form>

      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Receivables</h2>
          <div className="mt-4 space-y-3">
            {receivables.data?.map((receivable) => (
              <div key={receivable.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{receivable.friend_name}</p>
                    <p className="text-sm text-slate-400">{receivable.expense_description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-amber-300">₱{receivable.balance}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{receivable.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Payment history</h2>
          <div className="mt-4 space-y-3">
            {payments.data?.map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{payment.friend_name ?? payment.friend}</p>
                    <p className="text-sm text-slate-400">{payment.date} • {payment.method}</p>
                  </div>
                  <p className="text-lg font-bold text-white">₱{payment.amount}</p>
                </div>
              </div>
            ))}
            {!payments.data?.length ? <p className="text-sm text-slate-400">No payments yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
