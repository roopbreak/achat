export type PromptSubTab = 'desc' | 'personality' | 'scenario' | 'firstMes' | 'postHistory' | 'narrationStyle'

interface Props {
  desc: string; setDesc: (v: string) => void
  personality: string; setPersonality: (v: string) => void
  scenario: string; setScenario: (v: string) => void
  firstMes: string; setFirstMes: (v: string) => void
  postHistoryInstructions: string; setPostHistoryInstructions: (v: string) => void
  narrationStyle: string; setNarrationStyle: (v: string) => void
  subTab: PromptSubTab
  onSubTabChange: (tab: PromptSubTab) => void
}

const FIELDS: { key: PromptSubTab; label: string; placeholder: string }[] = [
  { key: 'desc', label: '설명', placeholder: '캐릭터 및 스토리 설명...' },
  { key: 'personality', label: '성격', placeholder: '캐릭터 성격 묘사...' },
  { key: 'scenario', label: '시나리오', placeholder: '배경 상황 및 설정...' },
  { key: 'firstMes', label: '첫 메시지', placeholder: '첫 번째 AI 응답...' },
  { key: 'postHistory', label: '턴별 지시', placeholder: '매 턴 시스템에 주입될 핵심 지시사항...' },
  { key: 'narrationStyle', label: '서술 스타일', placeholder: '장르별 성적 서술 톤, 묘사 원칙, 대사 스타일...' },
]

function getFieldValue(props: Props, key: PromptSubTab): string {
  switch (key) {
    case 'desc': return props.desc
    case 'personality': return props.personality
    case 'scenario': return props.scenario
    case 'firstMes': return props.firstMes
    case 'postHistory': return props.postHistoryInstructions
    case 'narrationStyle': return props.narrationStyle
  }
}

function getFieldSetter(props: Props, key: PromptSubTab): (v: string) => void {
  switch (key) {
    case 'desc': return props.setDesc
    case 'personality': return props.setPersonality
    case 'scenario': return props.setScenario
    case 'firstMes': return props.setFirstMes
    case 'postHistory': return props.setPostHistoryInstructions
    case 'narrationStyle': return props.setNarrationStyle
  }
}

function formatLen(len: number): string {
  if (len === 0) return ''
  if (len >= 1000) return `${(len / 1000).toFixed(1)}k`
  return String(len)
}

export default function PromptTab(props: Props) {
  const { subTab, onSubTabChange } = props
  const value = getFieldValue(props, subTab)
  const setter = getFieldSetter(props, subTab)
  const activeField = FIELDS.find(f => f.key === subTab)!

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* 좌측 서브탭 사이드바 */}
      <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto' }}>
        {FIELDS.map(f => {
          const len = getFieldValue(props, f.key).length
          const isActive = f.key === subTab
          return (
            <button
              key={f.key}
              onClick={() => onSubTabChange(f.key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '12px 14px', border: 'none', cursor: 'pointer',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                background: isActive ? 'var(--surface2)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text-dim)',
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                textAlign: 'left',
              }}
            >
              {f.label}
              {len > 0 && <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>{formatLen(len)}</span>}
            </button>
          )
        })}
      </div>

      {/* 우측 편집 영역 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-dim)' }}>{activeField.label}</div>
        <textarea
          value={value}
          onChange={e => setter(e.target.value)}
          placeholder={activeField.placeholder}
          style={{
            flex: 1, minHeight: 0, resize: 'none',
            fontSize: 14, lineHeight: 1.7, padding: '12px 16px',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  )
}
