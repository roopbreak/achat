function getAuthToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

export function setAuthToken(token: string) {
  document.cookie = `auth_token=${encodeURIComponent(token)};path=/;max-age=${60 * 60 * 24 * 365}`
}

export async function api<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export async function apiRaw(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getAuthToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}
