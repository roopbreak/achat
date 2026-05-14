import { COMMAND_GROUPS, type Command } from '../../lib/api'

const KNOWN = new Set<string>(COMMAND_GROUPS)

/** 스토리 전용 !커맨드 목록 — 그룹별로 묶어 표시. 빈 목록이면 fallback 문구 */
export default function CommandList({ commands }: { commands: Command[] }) {
  if (!commands || commands.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>이 스토리에 등록된 커맨드가 없습니다.</p>
  }

  // 그룹별 묶기 — 알려진 그룹은 고정 순서, 그 외/빈 값은 "기타"
  const groups = new Map<string, Command[]>()
  for (const c of commands) {
    const g = c.group && KNOWN.has(c.group) ? c.group : '기타'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(c)
  }
  const orderedKeys = [...COMMAND_GROUPS, '기타'].filter(g => groups.has(g))

  return (
    <div className="command-list">
      {orderedKeys.map(g => (
        <div key={g} className="command-group">
          <div className="command-group-label">{g}</div>
          {groups.get(g)!.map((c, i) => (
            <div key={i} className="command-item">
              <code className="command-cmd">{c.cmd}</code>
              <span className="command-desc">{c.desc}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
