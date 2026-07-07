import { useFieldArray, useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import type { Category, ExpenseInput, Friend } from '@/api/types'

export default function ExpensesPage() {
  const queryClient = useQueryClient()
  const friends = useQuery({ queryKey: ['friends'], queryFn: async () => (await client.get<Friend[]>('/ledger/friends/')).data })
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await client.get<Category[]>('/ledger/categories/')).data })

  const { register, control, handleSubmit, reset, watch, setValue, getValues } = useForm<ExpenseInput>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      description: '',
      category: null,
      items: [
        {
          name: '',
          price: '0.00',
          split_type: 'equal',
          participants: [
            { friend: null, share_value: '0', is_owner_share: true },
          ],
        },
      ],
    },
  })

  const items = useFieldArray({ control, name: 'items' })
  const createExpense = useMutation({
    mutationFn: async (values: ExpenseInput) => {
      const payload = {
        ...values,
        category: values.category || null,
        items: values.items.map((item) => ({
          ...item,
          price: Number(item.price),
          participants: item.participants.map((participant) => ({
            ...participant,
            share_value: Number(participant.share_value),
          })),
        })),
      }
      return client.post('/ledger/expenses/', payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      reset()
    },
  })

  const watchedItems = watch('items')

  return (
    <div className="space-y-6">
      <form
        className="rounded-3xl border border-white/10 bg-white/5 p-5"
        onSubmit={handleSubmit((values) => createExpense.mutate(values))}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <input className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" type="date" {...register('date', { required: true })} />
          <input className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 md:col-span-2" placeholder="Description" {...register('description', { required: true })} />
          <select className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" {...register('category')}>
            <option value="">No category</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        {items.fields.map((field, itemIndex) => (
          <div key={field.id} className="mt-6 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-semibold">Item {itemIndex + 1}</h3>
              {items.fields.length > 1 ? (
                <button type="button" className="text-sm text-rose-300" onClick={() => items.remove(itemIndex)}>
                  Remove item
                </button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <input className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 md:col-span-2" placeholder="Item name" {...register(`items.${itemIndex}.name` as const, { required: true })} />
              <input className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" placeholder="Price" type="number" step="0.01" {...register(`items.${itemIndex}.price` as const, { required: true })} />
              <select className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" {...register(`items.${itemIndex}.split_type` as const)}>
                <option value="equal">Equal</option>
                <option value="custom">Custom Amount</option>
                <option value="percentage">Percentage</option>
                <option value="quantity">Quantity</option>
              </select>
            </div>
            <div className="mt-4 space-y-3">
              {watchedItems?.[itemIndex]?.participants?.map((_, participantIndex) => (
                <div key={participantIndex} className="grid gap-3 md:grid-cols-4">
                  <select className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 md:col-span-2" {...register(`items.${itemIndex}.participants.${participantIndex}.friend` as const)}>
                    <option value="">You</option>
                    {friends.data?.map((friend) => (
                      <option key={friend.id} value={friend.id}>{friend.name}</option>
                    ))}
                  </select>
                  <input className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" placeholder="Share value" type="number" step="0.0001" {...register(`items.${itemIndex}.participants.${participantIndex}.share_value` as const)} />
                  <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                    <input type="checkbox" {...register(`items.${itemIndex}.participants.${participantIndex}.is_owner_share` as const)} />
                    Owner share
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200"
                onClick={() => {
                  const nextItems = [...(getValues('items') ?? [])]
                  nextItems[itemIndex].participants = [
                    ...(nextItems[itemIndex].participants ?? []),
                    { friend: null, share_value: '0', is_owner_share: false },
                  ]
                  setValue('items', nextItems, { shouldDirty: true, shouldTouch: true })
                }}
              >
                Add participant
              </button>
            </div>
          </div>
        ))}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm"
            onClick={() => items.append({ name: '', price: '0.00', split_type: 'equal', participants: [{ friend: null, share_value: '0', is_owner_share: true }] })}
          >
            Add item
          </button>
          <button className="rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950">Save expense</button>
        </div>
      </form>
    </div>
  )
}
