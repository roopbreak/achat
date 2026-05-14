import { COMMAND_GROUPS, type Command } from '../../lib/api'
import type { CommandRow } from '../../hooks/useStoryEditForm'

interface Props {
  name: string; setName: (v: string) => void
  charName: string; setCharName: (v: string) => void
  category: string; setCategory: (v: string) => void
  tags: string[]; tagInput: string
  handleTagChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleTagKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleTagPaste: (e: React.ClipboardEvent) => void
  handleTagBlur: () => void
  removeTag: (tag: string) => void
  commands: CommandRow[]
  addCommand: () => void
  updateCommand: (index: number, field: keyof Command, value: string) => void
  removeCommand: (index: number) => void
}

export default function BasicInfoTab({
  name, setName, charName, setCharName, category, setCategory,
  tags, tagInput, handleTagChange, handleTagKeyDown, handleTagPaste, handleTagBlur, removeTag,
  commands, addCommand, updateCommand, removeCommand,
}: Props) {
  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div className="admin-section">
        <div className="form-row"><label>스토리명</label><input value={name} onChange={e => setName(e.target.value)} placeholder="예: 퍼스트 러브" /></div>
        <div className="form-row"><label>캐릭터명</label><input value={charName} onChange={e => setCharName(e.target.value)} placeholder="예: 윤서진" /></div>
        <div className="form-row"><label>카테고리</label><input value={category} onChange={e => setCategory(e.target.value)} placeholder="예: 현대 로맨스" /></div>
        <div className="form-row">
          <label>태그</label>
          <div>
            <input
              value={tagInput}
              onChange={handleTagChange}
              onKeyDown={handleTagKeyDown}
              onPaste={handleTagPaste}
              onBlur={handleTagBlur}
              placeholder="Enter 또는 쉼표로 추가"
            />
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {tags.map(tag => (
                  <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 스토리 전용 !커맨드 */}
      <div className="admin-section">
        <h2>커맨드</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
          이 스토리에서 쓸 수 있는 <code>!커맨드</code>(예: <code>!깨톡</code>, <code>!여행</code>)를 등록합니다. 상세 페이지·채팅 가이드에 표시됩니다.
        </p>
        {commands.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {commands.map((c, i) => (
              <div key={c._cid} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  value={c.cmd}
                  onChange={e => updateCommand(i, 'cmd', e.target.value)}
                  placeholder="!커맨드"
                  style={{ width: 130, flexShrink: 0, fontFamily: 'monospace' }}
                />
                <select
                  value={COMMAND_GROUPS.includes(c.group as typeof COMMAND_GROUPS[number]) ? c.group : ''}
                  onChange={e => updateCommand(i, 'group', e.target.value)}
                  style={{ width: 90, flexShrink: 0, fontSize: 13 }}
                >
                  {COMMAND_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="">기타</option>
                </select>
                <input
                  value={c.desc}
                  onChange={e => updateCommand(i, 'desc', e.target.value)}
                  placeholder="커맨드 설명"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  className="btn btn-danger"
                  onClick={() => removeCommand(i)}
                  style={{ padding: '6px 10px', fontSize: 12, flexShrink: 0 }}
                >삭제</button>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-secondary" onClick={addCommand} style={{ fontSize: 13, padding: '6px 14px' }}>+ 커맨드 추가</button>
      </div>
    </div>
  )
}
