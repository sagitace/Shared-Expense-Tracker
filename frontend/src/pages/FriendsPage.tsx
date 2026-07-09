import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import client from '@/api/client'
import { extractApiError } from '@/api/errors'
import Modal from '@/components/Modal'
import type { Friend } from '@/api/types'

type FriendForm = { name: string; email: string; phone: string }
const emptyValues: FriendForm = { name: '', email: '', phone: '' }

export default function FriendsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: async () => (await client.get<Friend[]>('/ledger/friends/')).data,
  })
  const { register, handleSubmit, reset } = useForm<FriendForm>({ defaultValues: emptyValues })

  const saveFriend = useMutation({
    mutationFn: async (payload: FriendForm) =>
      editingId ? client.patch(`/ledger/friends/${editingId}/`, payload) : client.post('/ledger/friends/', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['friends'] })
      closeModal()
    },
    onError: (mutationError) => setError(extractApiError(mutationError)),
  })

  const openAddModal = () => {
    setEditingId(null)
    setError('')
    reset(emptyValues)
    setModalOpen(true)
  }

  const openEditModal = (friend: Friend) => {
    setEditingId(friend.id)
    setError('')
    reset({ name: friend.name, email: friend.email, phone: friend.phone })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setError('')
    reset(emptyValues)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Friends</h2>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-200"
        >
          Add friend
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="space-y-3">
          {friends.data?.map((friend) => (
            <div key={friend.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{friend.name}</p>
                  <p className="text-sm text-slate-400">{friend.email || 'No email'} • {friend.phone || 'No phone'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs ${friend.is_active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-500/20 text-slate-300'}`}>
                    {friend.is_active ? 'Active' : 'Archived'}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditModal(friend)}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!friends.data?.length ? <p className="text-sm text-slate-400">No friends yet.</p> : null}
        </div>
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editingId ? 'Edit friend' : 'Add friend'}>
        <form className="space-y-4" onSubmit={handleSubmit((values) => saveFriend.mutate(values))}>
          <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" placeholder="Name" {...register('name', { required: true })} />
          <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" placeholder="Email" {...register('email')} />
          <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" placeholder="Phone" {...register('phone')} />
          {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
          <div className="flex gap-3">
            <button className="w-full rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950">
              {editingId ? 'Save changes' : 'Save friend'}
            </button>
            <button type="button" onClick={closeModal} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
