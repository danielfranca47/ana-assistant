export type ApiResult<T> = { data: T; error: null } | { data: null; error: string }

async function request<T>(url: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const isFormData = init.body instanceof FormData
  const headers: HeadersInit = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers ?? {}),
  }

  let res: Response
  try {
    res = await fetch(url, { ...init, headers })
  } catch {
    return { data: null, error: 'Sem conexão com o servidor' }
  }

  if (res.status === 401) {
    const { useAuthStore } = await import('@/store/authStore')
    useAuthStore.getState().clearAuth()
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { data: null, error: 'Resposta inválida do servidor' }
  }

  if (!res.ok) {
    const msg = (json as { error?: string })?.error ?? 'Erro inesperado'
    return { data: null, error: msg }
  }

  const data = (json as { data?: T })?.data ?? (json as T)
  return { data, error: null }
}

export const apiFetch = {
  get:      <T>(url: string)                    => request<T>(url),
  post:     <T>(url: string, body: unknown)     => request<T>(url, { method: 'POST',  body: JSON.stringify(body) }),
  patch:    <T>(url: string, body: unknown)     => request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete:       (url: string)                   => request(url,   { method: 'DELETE' }),
  postForm: <T>(url: string, form: FormData)    => request<T>(url, { method: 'POST',  body: form }),
}
