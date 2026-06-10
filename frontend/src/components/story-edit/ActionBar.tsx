import { Link } from 'react-router-dom'

interface Props {
  saving: boolean
  status: { text: string; ok: boolean } | null
  isEdit: boolean
  onSave: () => void
  onExport: () => void
}

export default function ActionBar({ saving, status, isEdit, onSave, onExport }: Props) {
  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
      {status && (
        <span style={{ fontSize: 13, padding: '6px 12px', borderRadius: 6, background: status.ok ? 'rgba(125,255,158,.1)' : 'rgba(255,85,119,.1)', color: status.ok ? '#7dff9e' : 'var(--destructive)' }}>
          {status.text}
        </span>
      )}
      <Link to="/admin" className="btn btn-secondary">취소</Link>
      {isEdit && <button className="btn btn-secondary" onClick={onExport}>JSON 익스포트</button>}
      <button className="btn btn-primary" onClick={onSave} disabled={saving}>저장</button>
    </div>
  )
}
