import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { register } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">Shared Expense Tracker</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Create account</h1>
        <p className="mt-2 text-sm text-slate-400">Sign up with your email to start tracking shared expenses.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setError('')
            try {
              await register({ email, name, password })
              navigate('/')
            } catch (submitError) {
              setError('Could not create account. Check your details and try again.')
            }
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Name</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none ring-0 focus:border-amber-300"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Email</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none ring-0 focus:border-amber-300"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Password</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none ring-0 focus:border-amber-300"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
            />
          </label>
          {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
          <button className="w-full rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200">
            Sign up
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-amber-300 hover:text-amber-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
