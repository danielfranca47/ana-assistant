'use client'

import { useState, useCallback } from 'react'

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

  const execute = useCallback(async (promise: Promise<T>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await promise
      setState({ data, loading: false, error: null })
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado'
      setState((prev) => ({ ...prev, loading: false, error: message }))
      return null
    }
  }, [])

  return { ...state, execute }
}
