import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import client from '@/api/client'
import { extractApiError } from '@/api/errors'
import Modal from '@/components/Modal'
import type { Friend, Payment, PaymentDirection, Receivable } from '@/api/types'

type PaymentForm = {
  friend: number
  direction: PaymentDirection
  amount: string
  date: string
  method: 'cash' | 'bank' | 'gcash' | 'other'
  notes: string
}

export default function PaymentsPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState('')
  const friends = useQuery({ queryKey: ['friends'], queryFn: async () => (await client.get<Friend[]>('/ledger/friends/')).data })
  const receivables = useQuery({ queryKey: ['receivables'], queryFn: async () => (await client.get<Receivable[]>('/ledger/receivables/')).data })
  const payments = useQuery({ queryKey: ['payments'], queryFn: async () => (await client.get<Payment[]>('/ledger/payments/')).data })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentForm>({ defaultValues: { direction: 'received' } })

  const createPayment = useMutation({
    mutationFn: async (payload: PaymentForm) => client.post('/ledger/payments/', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] })
      await queryClient.invalidateQueries({ queryKey: ['receivables'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      closeModal()
    },
    onError: (mutationError) => setError(extractApiError(mutationError)),
  })

  const closeModal = () => {
    setModalOpen(false)
    setError('')
    reset({ direction: 'received' })
  }

  useEffect(() => {
    if ((location.state as { openAdd?: boolean } | null)?.openAdd) {
      setModalOpen(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state])

  const owedToMe = receivables.data?.filter((receivable) => receivable.direction === 'owed_to_me') ?? []
  const owedByMe = receivables.data?.filter((receivable) => receivable.direction === 'owed_by_me') ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Payments</h2>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-200"
        >
          Record payment
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Owed to you</h2>
          <div className="mt-4 space-y-3">
            {owedToMe.map((receivable) => (
              <div key={receivable.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{receivable.friend_name}</p>
                    <p className="text-sm text-slate-400">{receivable.expense_description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-300">₱{receivable.balance}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{receivable.status}</p>
                  </div>
                </div>
              </div>
            ))}
            {!owedToMe.length ? <p className="text-sm text-slate-400">Nobody owes you right now.</p> : null}
          </div>
        </section>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">You owe</h2>
          <div className="mt-4 space-y-3">
            {owedByMe.map((receivable) => (
              <div key={receivable.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{receivable.friend_name}</p>
                    <p className="text-sm text-slate-400">{receivable.expense_description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-rose-300">₱{receivable.balance}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{receivable.status}</p>
                  </div>
                </div>
              </div>
            ))}
            {!owedByMe.length ? <p className="text-sm text-slate-400">You don't owe anyone right now.</p> : null}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">Payment history</h2>
        <div className="mt-4 space-y-3">
          {payments.data?.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {payment.direction === 'sent' ? 'You paid ' : ''}
                    {payment.friend_name ?? payment.friend}
                    {payment.direction === 'received' ? ' paid you' : ''}
                  </p>
                  <p className="text-sm text-slate-400">{payment.date} • {payment.method}</p>
                </div>
                <p className={`text-lg font-bold ${payment.direction === 'received' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {payment.direction === 'received' ? '+' : '-'}₱{payment.amount}
                </p>
              </div>
            </div>
          ))}
          {!payments.data?.length ? <p className="text-sm text-slate-400">No payments yet.</p> : null}
        </div>
      </section>

      <Modal open={modalOpen} onClose={closeModal} title="Record payment">
        <form className="space-y-3" onSubmit={handleSubmit((values) => createPayment.mutate(values))}>
          <select className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" {...register('direction', { required: true })}>
            <option value="received">I received this (friend paid me back)</option>
            <option value="sent">I paid this (I'm paying a friend back)</option>
          </select>
          <select className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" {...register('friend', { valueAsNumber: true, required: true })}>
            <option value="">Select friend</option>
            {friends.data?.map((friend) => (
              <option key={friend.id} value={friend.id}>{friend.name}</option>
            ))}
          </select>
          <input
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Amount"
            {...register('amount', { required: true, min: { value: 0.01, message: 'Amount must be greater than zero.' } })}
          />
          {errors.amount ? <p className="text-sm text-rose-300">{errors.amount.message || 'Amount is required.'}</p> : null}
          <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" type="date" {...register('date', { required: true })} />
          <select className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" {...register('method')}>
            <option value="cash">Cash</option>
            <option value="bank">Bank Transfer</option>
            <option value="gcash">GCash</option>
            <option value="other">Other</option>
          </select>
          <textarea className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" rows={4} placeholder="Notes" {...register('notes')} />
          {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
          <div className="flex gap-3">
            <button className="w-full rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950">Save payment</button>
            <button type="button" onClick={closeModal} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
