import { useRef, useEffect, useCallback } from 'react'
import { renderMarkdown, replaceTemplateVars } from '../../lib/markdown'

interface Props {
  text: string
  charName: string
  isStreaming: boolean
}

export default function StreamingText({ text, charName, isStreaming }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renderedHtmlRef = useRef('')
  const rafRef = useRef<number>(0)
  const pendingTextRef = useRef('')

  const processed = replaceTemplateVars(text, charName)

  const doRender = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const html = renderMarkdown(pendingTextRef.current)
    if (html === renderedHtmlRef.current) return
    renderedHtmlRef.current = html

    // 기존 이미지 src 목록 저장
    const existingImgs = new Map<string, HTMLImageElement>()
    el.querySelectorAll('img').forEach(img => {
      if (img.src && img.naturalWidth > 0) {
        existingImgs.set(img.src, img)
      }
    })

    el.innerHTML = html

    // 이미 로드된 이미지는 깜빡임 방지를 위해 로드 상태 유지
    if (existingImgs.size > 0) {
      el.querySelectorAll('img').forEach(img => {
        if (existingImgs.has(img.src)) {
          // 이미 로드된 이미지 — 브라우저 캐시에서 즉시 로드되므로 깜빡임 최소화
          img.loading = 'eager'
        }
      })
    }
  }, [])

  useEffect(() => {
    pendingTextRef.current = processed

    if (!isStreaming) {
      // 스트리밍 완료 — 즉시 최종 렌더
      cancelAnimationFrame(rafRef.current)
      doRender()
      return
    }

    // 스트리밍 중 — throttle (rAF 기반, ~16ms)
    // 이미 예약된 rAF가 있으면 스킵 (다음 프레임에서 최신 텍스트로 렌더)
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        doRender()
      })
    }
  }, [processed, isStreaming, doRender])

  // cleanup
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
