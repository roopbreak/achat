import { Link } from 'react-router-dom'

interface Props {
  storyName: string
  onReset: () => void
  onExport: () => void
  onToggleGuide: () => void
  onToggleSettings: () => void
  onToggleSlots: () => void
  onToggleNote: () => void
}

export default function ChatHeader({
  storyName, onReset, onExport,
  onToggleGuide, onToggleSettings, onToggleSlots, onToggleNote,
}: Props) {
  return (
    <header className="chat-header">
      <Link to="/" style={{ color: 'var(--text-dim)', fontSize: 20, lineHeight: 1 }}>←</Link>
      <span className="story-title">{storyName}</span>
      <div className="session-actions">
        <button className="btn btn-secondary" onClick={onToggleGuide} style={{ fontSize: 13, padding: '6px 12px' }} title="가이드 (캐릭터·커맨드)">❓</button>
        <button className="btn btn-secondary" onClick={onToggleSlots} style={{ fontSize: 13, padding: '6px 12px' }}>
          <span>💾</span><span>슬롯</span>
        </button>
        <button className="btn btn-secondary" onClick={onToggleNote} style={{ fontSize: 13, padding: '6px 12px' }} title="유저 노트">📝</button>
        <button className="btn btn-secondary" onClick={onToggleSettings} style={{ fontSize: 13, padding: '6px 12px' }} title="설정">⚙️</button>
        <button className="btn btn-secondary" onClick={onReset} style={{ fontSize: 13, padding: '6px 12px' }}>
          <span>🔄</span><span>초기화</span>
        </button>
        <button className="btn btn-secondary" onClick={onExport} style={{ fontSize: 13, padding: '6px 12px' }} title="내보내기">
          <span>📥</span><span>내보내기</span>
        </button>
        <Link to="/history" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 12px' }}>
          <span>📖</span><span>히스토리</span>
        </Link>
      </div>
    </header>
  )
}
