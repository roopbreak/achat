// 스토리 전용 !커맨드 — DB의 stories.commands(JSON 배열) 항목 shape
export interface Command {
  cmd: string
  desc: string
  group?: string
}

// 알려진 커맨드 그룹 (UI 표시 순서). 그 외/빈 값은 "기타"로 묶임
export const COMMAND_GROUPS = ['기능', '모드', '분기'] as const

// GET /api/stories/:slug 응답 — 상세 페이지·채팅 가이드 패널 공용
export interface StoryDetail {
  id: number
  slug: string
  title: string
  char_name: string
  description: string
  scenario: string
  personality: string
  category: string | null
  tags: string | null
  first_mes: string
  commands: Command[]
}

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
  if (!res.ok) {
    // 서버가 본문에 담은 사유(action/error/reason)를 살려 표면화 — 'HTTP 409'만으론 운영 불가
    let detail = ''
    try {
      const body = await res.json() as { error?: string; reason?: string; action?: string }
      detail = [body.action, body.error, body.reason].filter(Boolean).join(' — ')
    } catch { /* JSON 본문 아님 → 상태코드만 */ }
    throw new Error(detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`)
  }
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
