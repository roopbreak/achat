import type { SystemCommand } from '../../lib/api'
import type { SystemCommandRow } from '../../hooks/useStoryEditForm'

// 분량 목표 밴드 라벨 (SettingsPanel 과 동일 의미 — 스토리 기본값용)
const OUTPUT_BANDS = [
  ['', '유저 설정 따름'],
  ['short', '짧게 (600~900자)'],
  ['light', '가볍게 (900~1,400자)'],
  ['medium', '보통 (1,400~1,800자)'],
  ['full', '충분히 (1,800~2,400자)'],
  ['epic', '길게 (2,400~3,600자)'],
] as const

const KINDS = [
  ['mode_toggle', '모드 토글'],
  ['client_toggle', '클라 토글'],
  ['server_action', '서버 액션'],
] as const

interface Props {
  statusMode: string; setStatusMode: (v: string) => void
  choicesMode: string; setChoicesMode: (v: string) => void
  outputTarget: string; setOutputTarget: (v: string) => void
  systemCommands: SystemCommandRow[]
  addSystemCommand: () => void
  updateSystemCommand: (index: number, field: keyof SystemCommand, value: unknown) => void
  removeSystemCommand: (index: number) => void
}

export default function ResponseTab({
  statusMode, setStatusMode, choicesMode, setChoicesMode, outputTarget, setOutputTarget,
  systemCommands, addSystemCommand, updateSystemCommand, removeSystemCommand,
}: Props) {
  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      {/* 3분할 응답 구성 (011) */}
      <div className="admin-section">
        <h2>응답 구성</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
          AI 응답의 info부(상태창)·선택지부·분량을 스토리별로 설정합니다.
        </p>
        <div className="form-row">
          <label>상태창 (info부)</label>
          <select value={statusMode} onChange={e => setStatusMode(e.target.value)}>
            <option value="bottom">표시 (응답 하단 생성·HUD 고정)</option>
            <option value="off">끄기 (순수 서사 — 상태 기억 주입도 중단)</option>
          </select>
        </div>
        <div className="form-row">
          <label>선택지</label>
          <select value={choicesMode} onChange={e => setChoicesMode(e.target.value)}>
            <option value="on">표시 (기본 선택지 규칙)</option>
            <option value="off">끄기</option>
          </select>
        </div>
        <div className="form-row">
          <label>분량 기본값</label>
          <select value={outputTarget} onChange={e => setOutputTarget(e.target.value)}>
            {OUTPUT_BANDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>

      {/* `!`-시스템 명령어 */}
      <div className="admin-section">
        <h2>시스템 명령어</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
          앱이 가로채 실행하는 <code>!명령어</code>입니다 (기본 제공: <code>!디버그</code>·<code>!요약</code>·<code>!음란모드</code>).
          기본 명령어와 같은 trigger 를 등록하면 덮어쓰며(라벨 변경·비활성), 새 trigger 는 이 스토리 전용 명령어가 됩니다.
          모드 토글의 "주입 텍스트"는 모드 ON 일 때 프롬프트에 추가됩니다.
        </p>
        {systemCommands.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {systemCommands.map((c, i) => (
              <div key={c._cid} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    value={c.trigger}
                    onChange={e => updateSystemCommand(i, 'trigger', e.target.value)}
                    placeholder="!트리거"
                    style={{ width: 120, flexShrink: 0, fontFamily: 'monospace' }}
                  />
                  <input
                    value={c.label}
                    onChange={e => updateSystemCommand(i, 'label', e.target.value)}
                    placeholder="라벨"
                    style={{ width: 110, flexShrink: 0 }}
                  />
                  <select
                    value={c.kind}
                    onChange={e => updateSystemCommand(i, 'kind', e.target.value)}
                    style={{ width: 110, flexShrink: 0, fontSize: 13 }}
                  >
                    {KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                  <input
                    value={c.action}
                    onChange={e => updateSystemCommand(i, 'action', e.target.value)}
                    placeholder="action 키 (영문)"
                    style={{ width: 140, flexShrink: 0, fontFamily: 'monospace' }}
                  />
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-dim)' }}>
                    <input
                      type="checkbox"
                      checked={c.enabled !== false}
                      onChange={e => updateSystemCommand(i, 'enabled', e.target.checked ? undefined : false)}
                    /> 활성
                  </label>
                  <button onClick={() => removeSystemCommand(i)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, marginLeft: 'auto' }}>&times;</button>
                </div>
                <input
                  value={c.desc ?? ''}
                  onChange={e => updateSystemCommand(i, 'desc', e.target.value || undefined)}
                  placeholder="설명 (팔레트 툴팁)"
                  style={{ fontSize: 13 }}
                />
                {c.kind === 'mode_toggle' && (
                  <textarea
                    value={c.directive ?? ''}
                    onChange={e => updateSystemCommand(i, 'directive', e.target.value || undefined)}
                    placeholder="주입 텍스트 — 이 모드가 ON 일 때 프롬프트에 추가될 지시 (기본 !음란모드 는 비워둠)"
                    rows={3}
                    style={{ fontSize: 13, resize: 'vertical' }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <button className="btn-secondary" onClick={addSystemCommand}>+ 명령어 추가</button>
      </div>
    </div>
  )
}
