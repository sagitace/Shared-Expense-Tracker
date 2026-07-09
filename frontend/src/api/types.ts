export type User = {
  id: number
  email: string
  name: string
  created_at: string
}

export type Friend = {
  id: number
  name: string
  email: string
  phone: string
  is_active: boolean
  created_at: string
}

export type Category = {
  id: number
  name: string
  is_active: boolean
}

export type DashboardResponse = {
  total_owed: number
  total_paid: number
  outstanding: number
  total_owed_by_me: number
  total_paid_by_me: number
  outstanding_by_me: number
  my_share: number
  by_friend: Array<{
    friend_id: number
    friend__name: string
    total_owed: number
    total_paid: number
    owed_by_me: number
    paid_by_me: number
    balance: number
  }>
  monthly_expense: Array<{ month: string; total: number }>
  spending_by_category: Array<{ category_label: string; total: number }>
  recent_activity: Array<{
    type: 'expense' | 'payment_received' | 'payment_sent'
    id: number
    date: string
    description: string
    amount: number
  }>
}

export type ReceivableDirection = 'owed_to_me' | 'owed_by_me'

export type Receivable = {
  id: number
  expense: number
  expense_description: string
  friend: number
  friend_name: string
  direction: ReceivableDirection
  amount_owed: string
  amount_paid: string
  status: string
  balance: string
  created_at: string
}

export type ExpenseParticipantInput = {
  friend: number | null
  share_value: string | number
  is_owner_share: boolean
}

export type ExpenseItemInput = {
  name: string
  price: string | number
  split_type: 'equal' | 'custom' | 'percentage' | 'quantity'
  participants: ExpenseParticipantInput[]
}

export type ExpenseInput = {
  date: string
  description: string
  category: number | null
  paid_by?: number
  paid_by_friend?: number | null
  receipt?: File | null
  items: ExpenseItemInput[]
}

export type ExpenseParticipant = {
  id: number
  friend: number | null
  share_value: string
  computed_amount: string
  is_owner_share: boolean
}

export type ExpenseItem = {
  id: number
  name: string
  price: string
  split_type: 'equal' | 'custom' | 'percentage' | 'quantity'
  participants: ExpenseParticipant[]
}

export type Expense = {
  id: number
  owner: number
  paid_by: number
  paid_by_friend: number | null
  date: string
  description: string
  category: number | null
  total_amount: string
  receipt: string | null
  is_locked: boolean
  items: ExpenseItem[]
  created_at: string
  updated_at: string
}

export type PaymentDirection = 'received' | 'sent'

export type Payment = {
  id: number
  friend: number
  friend_name?: string
  direction: PaymentDirection
  amount: string
  date: string
  method: 'cash' | 'bank' | 'gcash' | 'other'
  notes: string
  created_at: string
}

export type MonthlyReport = {
  year: number
  month: number
  available_years: number[]
  total_owed: number
  total_owed_by_me: number
  collected_amount: number
  paid_out_amount: number
  friends_borrowed: Array<{ friend_id: number; friend__name: string; amount_owed: number; amount_paid: number }>
  expenses: Array<{
    id: number
    date: string
    description: string
    category_name: string | null
    total_amount: string
    items: Array<{
      name: string
      price: string
      participants: Array<{ friend_name: string; share: string }>
    }>
  }>
}

export type PaymentInput = {
  friend: number
  direction: PaymentDirection
  amount: string
  date: string
  method: 'cash' | 'bank' | 'gcash' | 'other'
  notes: string
}
