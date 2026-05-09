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
}

export default function BasicInfoTab({ name, setName, charName, setCharName, category, setCategory, tags, tagInput, handleTagChange, handleTagKeyDown, handleTagPaste, handleTagBlur, removeTag }: Props) {
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
    </div>
  )
}
