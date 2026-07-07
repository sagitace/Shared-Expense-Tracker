import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import client from '@/api/client'
import type { Friend } from '@/api/types'

export default function FriendsPage() {
  const queryClient = useQueryClient()
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: async () => (await client.get<Friend[]>('/ledger/friends/')).data,
  })
  const { register, handleSubmit, reset } = useForm<{ name: string; email: string; phone: string }>()

  const createFriend = useMutation({
    mutationFn: async (payload: { name: string; email: string; phone: string }) => client.post('/ledger/friends/', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['friends'] })
      reset()
    },
  })

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form
        className="rounded-3xl border border-white/10 bg-white/5 p-5"
        onSubmit={handleSubmit((values) => createFriend.mutate(values))}
      >
        <h2 className="text-lg font-semibold">Add friend</h2>
        <div className="mt-4 space-y-4">
          <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" placeholder="Name" {...register('name', { required: true })} />
          <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" placeholder="Email" {...register('email')} />
          <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" placeholder="Phone" {...register('phone')} />
          <button className="w-full rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950">Save friend</button>
        </div>
      </form>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">Friends</h2>
        <div className="mt-4 space-y-3">
          {friends.data?.map((friend) => (
            <div key={friend.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{friend.name}</p>
                  <p className="text-sm text-slate-400">{friend.email || 'No email'} • {friend.phone || 'No phone'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${friend.is_active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-500/20 text-slate-300'}`}>
                  {friend.is_active ? 'Active' : 'Archived'}
                </span>
              </div>
            </div>
          ))}
          {!friends.data?.length ? <p className="text-sm text-slate-400">No friends yet.</p> : null}
        </div>
      </div>
    </div>
  )
}
