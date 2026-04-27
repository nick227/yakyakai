import { useEffect, useState } from 'react'
import { getMe, logout } from '../api/authApi.js'

export function useAuth() {
  const [user, setUser] = useState(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then((data) => {
        setUser(data.user || null)
        setLoading(false)
      })
      .catch(() => {
        setUser(null)
        setLoading(false)
      })
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {}
    document.title = 'YakyakAI'
    setUser(null)
  }

  return {
    user,
    loading,
    logout: handleLogout,
    setUser,
  }
}
