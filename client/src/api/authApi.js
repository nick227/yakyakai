import { get, post } from './client.js'

export const getMe    = () => get('/api/auth/me')
export const getUsage = () => get('/api/usage/me')
export const logout   = () => post('/api/auth/logout')
export const login    = ({ email, password }) => post('/api/auth/login', { email, password })
export const register = ({ name, email, password }) => post('/api/auth/register', { name, email, password })
