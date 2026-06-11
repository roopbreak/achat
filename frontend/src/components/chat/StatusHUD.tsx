import { renderMarkdown } from '../../lib/markdown'

interface Props {
  /** 분리된 상태창 마크다운 — null/빈 문자열이면 렌더하지 않음 */
  status: string | null
}

/**
 * 화면 고정 상태 HUD. 채팅 메시지 영역과 입력창 사이에 항상 최신 상태창만 표시한다.
 * 본문(말풍선)에는 상태창이 안 보이고, 여기서만 최신 상태를 보여준다(게임 HUD 패턴).
 */
export default function StatusHUD({ status }: Props) {
  if (!status || status.trim() === '') return null

  return (
    <div className="shrink-0 border-t border-border bg-card px-4 py-2">
      <div
        className="status-hud max-h-32 overflow-y-auto text-[13px] leading-relaxed text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(status) }}
      />
    </div>
  )
}
