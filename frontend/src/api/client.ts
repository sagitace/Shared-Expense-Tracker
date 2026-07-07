import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

const client = axios.create({
  baseURL,
})

let refreshPromise: Promise<string | null> | null = null

function getTokens() {
  return {
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
  }
}

client.interceptors.request.use((config) => {
  const { access } = getTokens()
  if (access) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${access}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const { refresh } = getTokens()
      if (!refresh) {
        return Promise.reject(error)
      }
      refreshPromise = refreshPromise ?? client.post('/auth/refresh/', { refresh }).then((response) => response.data.access)
      try {
        const access = await refreshPromise
        refreshPromise = null
        if (access) {
          localStorage.setItem('access_token', access)
          originalRequest.headers.Authorization = `Bearer ${access}`
          return client(originalRequest)
        }
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      }
    }
    return Promise.reject(error)
  },
)

export default client
