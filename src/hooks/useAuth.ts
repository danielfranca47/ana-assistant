'use client'

import { apiFetch } from '@/lib/apiFetch'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore()

  async function login(email: string, password: string): Promise<void> {
    const result = await apiFetch.post<{
      user: { id: string; name: string; email: string }
      token: string
    }>('/api/auth/login', { email, password })

    if (!result.data) throw new Error(result.error ?? 'Erro de autenticação')
    const { user: u, token } = result.data
    setAuth(token, u)
  }

  async function register(
    name: string,
    email: string,
    password: string,
  ): Promise<void> {
    const result = await apiFetch.post('/api/auth/register', { name, email, password })
    if (result.error) throw new Error(result.error)
    await login(email, password)
  }

  function logout(): void {
    clearAuth()
  }

  function mensagemDeErro(err: unknown): string {
    if (err instanceof Error) return err.message
    return 'Erro inesperado'
  }

  return { user, isAuthenticated, login, register, logout, mensagemDeErro }
}
