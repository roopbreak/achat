import { useMemo } from 'react'
import { renderMarkdown, replaceTemplateVars } from '../../lib/markdown'

interface Props {
  text: string
  charName: string
  isStreaming: boolean
}

export default function StreamingText({ text, charName, isStreaming }: Props) {
  const processed = replaceTemplateVars(text, charName)

  // 스트리밍 중에도 마크다운 렌더링 — React Virtual DOM이 변경된 부분만 패치하므로 깜빡임 없음
  const html = useMemo(() => renderMarkdown(processed), [processed])

  return (
    <div
      className={`msg-body${isStreaming ? ' streaming' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
