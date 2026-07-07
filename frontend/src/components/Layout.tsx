import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/friends', label: 'Friends' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/payments', label: 'Payments' },
  { to: '/reports', label: 'Reports' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen px-4 py-4 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">Shared Expense Tracker</p>
              <h1 className="font-display text-2xl font-bold md:text-3xl">Money you front, receivables you recover.</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-sm text-slate-300">
                {user?.name ?? user?.email}
              </span>
              <button
                onClick={async () => {
                  await logout()
                  navigate('/login')
                }}
                className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
              >
                Log out
              </button>
            </div>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm transition ${
                    isActive ? 'bg-white text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-glow backdrop-blur-xl md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
