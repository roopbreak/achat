interface Persona {
  id: number
  name: string
  is_default?: boolean
}

interface Props {
  open: boolean
  fontSize: number
  model: string
  maxTokens: number
  imagesEnabled: boolean
  loreDebug: boolean
  personas: Persona[]
  selectedPersonaId: number | null
  onChangeFontSize: (delta: number) => void
  onChangeModel: (model: string) => void
  onChangeMaxTokens: (tokens: number) => void
  onToggleImages: () => void
  onToggleLoreDebug: () => void
  onChangePersona: (id: number) => void
  onClose: () => void
}

export default function SettingsPanel({
  open, fontSize, model, maxTokens, imagesEnabled, loreDebug,
  personas, selectedPersonaId,
  onChangeFontSize, onChangeModel, onChangeMaxTokens,
  onToggleImages, onToggleLoreDebug, onChangePersona, onClose,
}: Props) {
  if (!open) return null

  return (
    <div className="settings-panel open">
      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>글자 크기</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button className="btn btn-secondary" onClick={() => onChangeFontSize(-1)} style={{ fontSize: 12, padding: '4px 10px' }}>A-</button>
        <span style={{ fontSize: 13, minWidth: 32, textAlign: 'center' }}>{fontSize}px</span>
        <button className="btn btn-secondary" onClick={() => onChangeFontSize(1)} style={{ fontSize: 12, padding: '4px 10px' }}>A+</button>
      </div>

      <span style={{ fontSize: 13, color: 'var(--text-dim)', marginLeft: 8 }}>출력량</span>
      <select
        value={maxTokens}
        onChange={e => onChangeMaxTokens(parseInt(e.target.value, 10))}
        style={{ width: 'auto', fontSize: 13, padding: '5px 10px' }}
      >
        <option value={1024}>짧게 (1K)</option>
        <option value={2048}>보통 (2K)</option>
        <option value={3072}>기본 (3K)</option>
        <option value={4096}>길게 (4K)</option>
        <option value={8192}>매우 길게 (8K)</option>
      </select>

      <span style={{ fontSize: 13, color: 'var(--text-dim)', marginLeft: 8 }}>페르소나</span>
      <select
        value={selectedPersonaId ?? ''}
        onChange={e => onChangePersona(parseInt(e.target.value, 10))}
        style={{ width: 'auto', fontSize: 13, padding: '5px 10px' }}
      >
        {personas.map(p => (
          <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' (기본)' : ''}</option>
        ))}
      </select>

      <span style={{ fontSize: 13, color: 'var(--text-dim)', marginLeft: 8 }}>모델</span>
      <select
        value={model}
        onChange={e => onChangeModel(e.target.value)}
        style={{ width: 'auto', fontSize: 13, padding: '5px 10px' }}
      >
        <option value="claude-sonnet-4-6">Sonnet 4.6</option>
        <option value="claude-opus-4-6">Opus 4.6</option>
        <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
      </select>

      <label style={{ fontSize: 13, color: 'var(--text-dim)', marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={imagesEnabled}
          onChange={onToggleImages}
          style={{ accentColor: 'var(--accent)' }}
        />이미지
      </label>

      <label style={{ fontSize: 13, color: 'var(--text-dim)', marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={loreDebug}
          onChange={onToggleLoreDebug}
          style={{ accentColor: 'var(--accent)' }}
        />로어북 디버그
      </label>

      <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: '4px 10px', marginLeft: 'auto' }}>닫기</button>
    </div>
  )
}
