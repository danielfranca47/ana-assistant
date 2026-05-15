import type { AxiosError } from 'axios'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore()

  async function login(email: string, password: string): Promise<void> {
    const response = await api.post<{
      data: { user: { id: string; name: string; email: string }; token: string }
    }>('/auth/login', { email, password })
    const { user: u, token } = response.data.data
    setAuth(token, u)
  }

  async function register(
    name: string,
    email: string,
    password: string,
  ): Promise<void> {
    // Cria a conta e em seguida faz login para obter o token
    await api.post('/auth/register', { name, email, password })
    await login(email, password)
  }

  function logout(): void {
    clearAuth()
  }

  function mensagemDeErro(err: unknown): string {
    const axiosErr = err as AxiosError<{ error: string }>
    return axiosErr.response?.data?.error ?? 'Erro inesperado'
  }

  return { user, isAuthenticated, login, register, logout, mensagemDeErro }
}
