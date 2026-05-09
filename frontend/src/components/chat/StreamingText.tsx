import { useMemo } from 'react'
import { renderMarkdown, replaceTemplateVars } from '../../lib/markdown'

interface Props {
  text: string
  charName: string
  isStreaming: boolean
}

export default function StreamingText({ text, charName, isStreaming }: Props) {
  const processed = replaceTemplateVars(text, charName)

  const html = useMemo(() => {
    if (isStreaming) return null
    return renderMarkdown(processed)
  }, [processed, isStreaming])

  if (isStreaming) {
    return (
      <div className="msg-body" style={{ whiteSpace: 'pre-wrap' }}>
        {processed}
      </div>
    )
  }

  return (
    <div
      className="msg-body"
      dangerouslySetInnerHTML={{ __html: html! }}
    />
  )
}
