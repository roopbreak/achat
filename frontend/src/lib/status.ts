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

export interface Choice {
  /** 원본 마커(①, 1., 1) 등) — 표시용 */
  marker: string
  /** 마커 제거한 선택지 텍스트 — 클릭 시 이 텍스트를 그대로 전송 */
  text: string
  /** 특수 선택지: free=입력창 포커스, cast=AI 캐스팅(버튼 제외), null=일반 전송 */
  kind: 'normal' | 'free' | 'cast'
}

// 선택지 라인: ①~⑥ 또는 1. / 1) 시작 + 텍스트
const CHOICE_LINE = /^\s*([①②③④⑤⑥]|\d{1,2}[.)])\s*(.+?)\s*$/u
const FREE_INPUT = /자유\s*입력|직접\s*입력/
const AI_CAST = /AI\s*캐스팅|자동\s*캐스팅/

/**
 * 상태창(status)에서 **맨 아래 연속된 선택지 suffix**만 떼어낸다(Codex 권고 —
 * status 전체 스캔 금지: 카드형 상태창 중간 숫자 열거 오검출 방지).
 * 끝에서 위로 선택지 패턴 라인만 수집, 일반 status 라인을 만나면 중단.
 * 2개 미만이면 선택지 없음으로 보고 폴백({statusBody: status, choices: []}).
 *
 * @returns statusBody = 선택지 제외 상태창(HUD용, 없으면 null), choices = 선택지 버튼 데이터
 */
export function splitChoices(status: string | null): { statusBody: string | null; choices: Choice[] } {
  if (!status) return { statusBody: status, choices: [] }
  const lines = status.split('\n')

  const collected: Choice[] = []
  let i = lines.length - 1
  for (; i >= 0; i--) {
    const line = lines[i]
    if (line.trim() === '') {
      // 선택지 사이/경계 빈 줄: 이미 선택지를 모으는 중이면 건너뛰고, 아니면 무시하고 계속
      if (collected.length > 0) continue
      continue
    }
    const m = line.match(CHOICE_LINE)
    if (!m) break // 일반 status 라인 도달 → suffix 종료
    const text = m[2].trim()
    const kind: Choice['kind'] = FREE_INPUT.test(text) ? 'free' : AI_CAST.test(text) ? 'cast' : 'normal'
    collected.unshift({ marker: m[1], text, kind })
  }

  if (collected.length < 2) return { statusBody: status, choices: [] }

  const bodyLines = lines.slice(0, i + 1)
  const statusBody = bodyLines.join('\n').trim() || null
  return { statusBody, choices: collected }
}
