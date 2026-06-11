// 상태창 분리 유틸 — 모델 응답은 `본문 ⟦STATUS⟧ 상태창` 형태(센티넬 U+27E6/27E7).
// 스트리밍 중 delta 는 센티넬 포함 원본이 흐르므로 프론트가 누적 텍스트를 분리한다.
export const STATUS_SENTINEL = '⟦STATUS⟧'

// 단독 라인 센티넬만 경계로 인정(서버 status-sentinel.mjs 와 동일 규칙).
const SENTINEL_LINE = /^\s*⟦STATUS⟧\s*$/

/**
 * 누적/원본 텍스트를 본문/상태창으로 분리.
 * **단독 라인** 센티넬 중 마지막 것을 경계로 가른다(서버와 동일 — 본문 중간 인라인
 * 센티넬은 경계로 보지 않음). 어느 쪽이든 본문의 잔여 센티넬은 모두 제거해 노출을 막는다.
 * 단독 라인 센티넬이 없으면 status=null, body=원문(센티넬 제거).
 */
export function splitBodyStatus(text: string): { body: string; status: string | null } {
  const lines = text.split('\n')
  let idx = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (SENTINEL_LINE.test(lines[i])) { idx = i; break }
  }
  if (idx < 0) {
    // 폴백: 경계 없음 — 통째 본문(잔여 인라인 센티넬만 제거)
    return { body: text.split(STATUS_SENTINEL).join('').trimEnd(), status: null }
  }
  const body = lines.slice(0, idx).join('\n').split(STATUS_SENTINEL).join('').trimEnd()
  const status = lines.slice(idx + 1).join('\n').split(STATUS_SENTINEL).join('').trim()
  return { body, status: status === '' ? null : status }
}

/**
 * 합본 content(본문\n\n상태창)에서 status 문자열을 떼어 본문만 반환.
 * status 가 없거나 content 와 불일치하면 content 통째.
 */
export function stripStatus(content: string, status: string | null | undefined): string {
  if (!status) return content
  const withGap = '\n\n' + status
  if (content.endsWith(withGap)) return content.slice(0, content.length - withGap.length)
  if (content.endsWith(status)) return content.slice(0, content.length - status.length).trimEnd()
  return content
}
