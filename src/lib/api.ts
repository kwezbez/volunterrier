// Thin fetch wrapper. Cookies are HttpOnly and sent automatically (same origin);
// every state-changing request echoes the CSRF cookie in the X-CSRF-Token header.
export class ApiError extends Error {
  status: number
  code?: string
  field?: string
  data: Record<string, unknown>
  constructor(status: number, data: Record<string, unknown>) {
    super(String(data.error || 'Something went wrong.'))
    this.status = status
    this.code = data.code as string | undefined
    this.field = data.field as string | undefined
    this.data = data
  }
}

// In production the API is served from the same origin. VITE_API_URL is only for split hosting.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)(?:__Host-)?vt_csrf=([^;]+)/)
  return m ? decodeURIComponent(m[1]!) : ''
}

export async function api<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRF-Token'] = csrf()
  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      credentials: BASE ? 'include' : 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, { error: 'Can’t reach VolunTerrier. Check your connection and try again.' })
  }
  let data: Record<string, unknown> = {}
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export const get = <T,>(p: string) => api<T>('GET', p)
export const post = <T,>(p: string, b: unknown = {}) => api<T>('POST', p, b)
export const put = <T,>(p: string, b: unknown = {}) => api<T>('PUT', p, b)
export const patch = <T,>(p: string, b: unknown = {}) => api<T>('PATCH', p, b)
export const del = <T,>(p: string) => api<T>('DELETE', p)
