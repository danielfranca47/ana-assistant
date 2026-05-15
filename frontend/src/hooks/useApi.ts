import { useState, useCallback } from 'react'
import type { AxiosError } from 'axios'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async (promise: Promise<{ data: { data: T } }>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = await promise
      setState({ data: response.data.data, loading: false, error: null })
      return response.data.data
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>
      const message = axiosError.response?.data?.error ?? 'Erro inesperado'
      setState((prev) => ({ ...prev, loading: false, error: message }))
      return null
    }
  }, [])

  return { ...state, execute }
}
