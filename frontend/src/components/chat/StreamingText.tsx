import { useRef, useEffect, useCallback } from 'react'
import { renderMarkdown, replaceTemplateVars } from '../../lib/markdown'

interface Props {
  text: string
  charName: string
  isStreaming: boolean
}

export default function StreamingText({ text, charName, isStreaming }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stableRef = useRef<HTMLDivElement | null>(null)
  const tailRef = useRef<HTMLDivElement | null>(null)
  const lastStableCut = useRef('')
  const rafRef = useRef<number>(0)
  const pendingTextRef = useRef('')

  const processed = replaceTemplateVars(text, charName)

  const doRender = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const text = pendingTextRef.current

    if (!stableRef.current) {
      // 최초 — stable + tail 구조 생성
      stableRef.current = document.createElement('div')
      tailRef.current = document.createElement('div')
      el.innerHTML = ''
      el.appendChild(stableRef.current)
      el.appendChild(tailRef.current)
    }

    // 이미지 마크다운이 완결된 지점을 찾아 stable/tail 분리
    // 마지막 완결된 이미지 이후의 줄바꿈까지를 stable로 고정
    const imgPattern = /!\[[^\]]*\]\([^)]+\)/g
    let lastImgEnd = 0
    let match
    while ((match = imgPattern.exec(text)) !== null) {
      // 이미지 마크다운 다음 줄바꿈까지 포함
      const afterImg = text.indexOf('\n', match.index + match[0].length)
      lastImgEnd = afterImg === -1 ? match.index + match[0].length : afterImg + 1
    }

    if (lastImgEnd > 0 && text.substring(0, lastImgEnd) !== lastStableCut.current) {
      // stable 영역 업데이트 (이미지 포함 — 이후 변경 안 됨)
      lastStableCut.current = text.substring(0, lastImgEnd)
      stableRef.current.innerHTML = renderMarkdown(lastStableCut.current)
    } else if (lastImgEnd === 0 && lastStableCut.current === '') {
      // 이미지 없음 — stable 비우고 tail에만 렌더
      stableRef.current.innerHTML = ''
    }

    // tail 영역 — 이미지 이후 텍스트만 매번 업데이트 (이미지 없으므로 깜빡임 없음)
    const tailText = lastImgEnd > 0 ? text.substring(lastImgEnd) : text
    tailRef.current!.innerHTML = renderMarkdown(tailText)
  }, [])

  useEffect(() => {
    pendingTextRef.current = processed

    if (!isStreaming) {
      // 스트리밍 완료 — stable/tail 구조 해제, 전체 렌더
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      const el = containerRef.current
      if (el) {
        el.innerHTML = renderMarkdown(processed)
        stableRef.current = null
        tailRef.current = null
        lastStableCut.current = ''
      }
      return
    }

    // 스트리밍 중 — rAF throttle
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        doRender()
      })
    }
  }, [processed, isStreaming, doRender])

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div
      className={`msg-body${isStreaming ? ' streaming' : ''}`}
      ref={containerRef}
    />
  )
}
