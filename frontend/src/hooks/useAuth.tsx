import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import client from '@/api/client'
import type { User } from '@/api/types'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (payload: { email: string; password: string }) => Promise<void>
  register: (payload: { email: string; name: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const bootstrap = async () => {
      const access = localStorage.getItem('access_token')
      if (!access) {
        setLoading(false)
        return
      }
      try {
        const response = await client.get('/auth/me/')
        setUser(response.data)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async ({ email, password }) => {
        const response = await client.post('/auth/login/', { email, password })
        localStorage.setItem('access_token', response.data.access)
        localStorage.setItem('refresh_token', response.data.refresh)
        setUser(response.data.user)
      },
      register: async ({ email, name, password }) => {
        const response = await client.post('/auth/register/', { email, name, password })
        localStorage.setItem('access_token', response.data.access)
        localStorage.setItem('refresh_token', response.data.refresh)
        setUser(response.data.user)
      },
      logout: async () => {
        const refresh = localStorage.getItem('refresh_token')
        if (refresh) {
          await client.post('/auth/logout/', { refresh })
        }
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setUser(null)
      },
    }),
    [loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
