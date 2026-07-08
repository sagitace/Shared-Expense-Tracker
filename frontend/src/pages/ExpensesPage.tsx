import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import { extractApiError } from '@/api/errors'
import { computeShares } from '@/utils/splits'
import type { Category, Expense, ExpenseInput, Friend } from '@/api/types'

const emptyItem = () => ({
  name: '',
  price: '0.00',
  split_type: 'equal' as const,
  participants: [{ friend: null, share_value: '0', is_owner_share: true }],
})

const defaultValues: ExpenseInput = {
  date: new Date().toISOString().slice(0, 10),
  description: '',
  category: null,
  items: [emptyItem()],
}

export default function ExpensesPage() {
  const queryClient = useQueryClient()
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null)
  const [expenseError, setExpenseError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')

  const friends = useQuery({ queryKey: ['friends'], queryFn: async () => (await client.get<Friend[]>('/ledger/friends/')).data })
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await client.get<Category[]>('/ledger/categories/')).data })
  const expenses = useQuery({ queryKey: ['expenses'], queryFn: async () => (await client.get<Expense[]>('/ledger/expenses/')).data })

  const { register, control, handleSubmit, reset, watch, setValue, getValues } = useForm<ExpenseInput>({ defaultValues })
  const items = useFieldArray({ control, name: 'items' })

  const createCategory = useMutation({
    mutationFn: async (name: string) => client.post('/ledger/categories/', { name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      setNewCategoryName('')
      setCategoryError('')
    },
    onError: (mutationError) => setCategoryError(extractApiError(mutationError)),
  })

  const toggleCategory = useMutation({
    mutationFn: async (category: Category) => client.patch(`/ledger/categories/${category.id}/`, { is_active: !category.is_active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const saveExpense = useMutation({
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
      return editingExpenseId
        ? client.put(`/ledger/expenses/${editingExpenseId}/`, payload)
        : client.post('/ledger/expenses/', payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setEditingExpenseId(null)
      setExpenseError('')
      reset(defaultValues)
    },
    onError: (mutationError) => setExpenseError(extractApiError(mutationError)),
  })

  const watchedItems = watch('items')

  const startEdit = (expense: Expense) => {
    setEditingExpenseId(expense.id)
    setExpenseError('')
    reset({
      date: expense.date,
      description: expense.description,
      category: expense.category,
      items: expense.items.map((item) => ({
        name: item.name,
        price: item.price,
        split_type: item.split_type,
        participants: item.participants.map((participant) => ({
          friend: participant.friend,
          share_value: participant.share_value,
          is_owner_share: participant.is_owner_share,
        })),
      })),
    })
  }

  const cancelEdit = () => {
    setEditingExpenseId(null)
    setExpenseError('')
    reset(defaultValues)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">Categories</h2>
        <form
          className="mt-4 flex gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (newCategoryName.trim()) createCategory.mutate(newCategoryName.trim())
          }}
        >
          <input
            className="flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3"
            placeholder="New category name"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
          />
          <button className="rounded-2xl bg-amber-300 px-5 py-3 font-semibold text-slate-950">Add</button>
        </form>
        {categoryError ? <p className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{categoryError}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.data?.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => toggleCategory.mutate(category)}
              title={category.is_active ? 'Click to archive' : 'Click to restore'}
              className={`rounded-full px-4 py-2 text-sm transition ${
                category.is_active ? 'bg-white/10 text-slate-100 hover:bg-white/20' : 'bg-slate-800/60 text-slate-500 line-through'
              }`}
            >
              {category.name}
            </button>
          ))}
          {!categories.data?.length ? <p className="text-sm text-slate-400">No categories yet.</p> : null}
        </div>
      </div>

      <form
        className="rounded-3xl border border-white/10 bg-white/5 p-5"
        onSubmit={handleSubmit((values) => saveExpense.mutate(values))}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{editingExpenseId ? `Edit expense #${editingExpenseId}` : 'Add expense'}</h2>
          {editingExpenseId ? (
            <button type="button" onClick={cancelEdit} className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300">
              Cancel edit
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <input className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" type="date" {...register('date', { required: true })} />
          <input className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 md:col-span-2" placeholder="Description" {...register('description', { required: true })} />
          <select className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3" {...register('category')}>
            <option value="">No category</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.is_active ? '' : ' (archived)'}
              </option>
            ))}
          </select>
        </div>

        {items.fields.map((field, itemIndex) => {
          const item = watchedItems?.[itemIndex]
          const price = Number(item?.price) || 0
          const shares = computeShares(price, item?.split_type ?? 'equal', item?.participants ?? [])

          return (
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
                {item?.participants?.map((participant, participantIndex) => (
                  <div key={participantIndex} className="grid gap-3 md:grid-cols-5 md:items-center">
                    <select className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 md:col-span-2" {...register(`items.${itemIndex}.participants.${participantIndex}.friend` as const)}>
                      <option value="">You</option>
                      {friends.data?.map((friend) => (
                        <option key={friend.id} value={friend.id}>{friend.name}</option>
                      ))}
                    </select>
                    {item.split_type !== 'equal' ? (
                      <input
                        className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                        placeholder={item.split_type === 'percentage' ? '%' : item.split_type === 'quantity' ? 'Qty' : 'Amount'}
                        type="number"
                        step="0.0001"
                        {...register(`items.${itemIndex}.participants.${participantIndex}.share_value` as const)}
                      />
                    ) : (
                      <div />
                    )}
                    <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                      <input type="checkbox" {...register(`items.${itemIndex}.participants.${participantIndex}.is_owner_share` as const)} />
                      Owner share
                    </label>
                    <p className="text-right text-sm font-semibold text-amber-300">
                      ₱{(shares[participantIndex] ?? 0).toFixed(2)}
                    </p>
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
          )
        })}

        {expenseError ? <p className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{expenseError}</p> : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm"
            onClick={() => items.append(emptyItem())}
          >
            Add item
          </button>
          <button className="rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950">
            {editingExpenseId ? 'Save changes' : 'Save expense'}
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">Expenses</h2>
        <div className="mt-4 space-y-3">
          {expenses.data?.map((expense) => (
            <div key={expense.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{expense.description}</p>
                  <p className="text-sm text-slate-400">
                    {expense.date} • {categories.data?.find((category) => category.id === expense.category)?.name ?? 'No category'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-white">₱{expense.total_amount}</p>
                  <button
                    type="button"
                    onClick={() => startEdit(expense)}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!expenses.data?.length ? <p className="text-sm text-slate-400">No expenses yet.</p> : null}
        </div>
      </div>
    </div>
  )
}
