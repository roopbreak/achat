import type { StoryDetail } from '../../lib/api'
import CommandList from '../common/CommandList'

interface Props {
  open: boolean
  story: StoryDetail | null
  slug: string
  charName: string
  onClose: () => void
}

/** 채팅 화면 가이드 패널 — 캐릭터 소개 + 스토리 전용 !커맨드 목록 */
export default function GuidePanel({ open, story, slug, charName, onClose }: Props) {
  if (!open) return null

  return (
    <div className="guide-panel">
      <div className="guide-panel-head">
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          가이드 — {story?.char_name || charName || slug}
        </span>
        <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: '4px 10px' }}>닫기</button>
      </div>

      <div className="guide-panel-body">
        {!story ? (
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>스토리 정보를 불러오지 못했습니다.</p>
        ) : (
          <>
            {story.scenario && (
              <section>
                <h4 className="guide-section-label">시나리오</h4>
                <p className="guide-text">{story.scenario}</p>
              </section>
            )}
            {story.personality && (
              <section>
                <h4 className="guide-section-label">캐릭터</h4>
                <p className="guide-text">{story.personality}</p>
              </section>
            )}
            <section>
              <h4 className="guide-section-label">커맨드</h4>
              <CommandList commands={story.commands} />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
