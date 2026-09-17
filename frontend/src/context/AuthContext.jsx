import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => localStorage.getItem('tg_user') || null)

  const login = (username, token) => {
    localStorage.setItem('tg_token', token)
    localStorage.setItem('tg_user', username)
    setUser(username)
  }

  const logout = () => {
    localStorage.removeItem('tg_token')
    localStorage.removeItem('tg_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
