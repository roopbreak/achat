import { useRef, useEffect, useCallback } from 'react'
import { renderMarkdown, replaceTemplateVars } from '../../lib/markdown'

interface Props {
  text: string
  charName: string
  isStreaming: boolean
}

export default function StreamingText({ text, charName, isStreaming }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const segmentsRef = useRef<HTMLDivElement[]>([])
  const imgCountRef = useRef(0)
  const rafRef = useRef<number>(0)
  const pendingTextRef = useRef('')
  const wasStreamingRef = useRef(false)

  const processed = replaceTemplateVars(text, charName)

  // 텍스트를 이미지 마크다운 기준으로 분할
  const splitByImages = useCallback((text: string) => {
    const imgPattern = /!\[[^\]]*\]\([^)]+\)/g
    const segments: string[] = []
    let lastIdx = 0
    let match
    while ((match = imgPattern.exec(text)) !== null) {
      // 이미지 다음 줄바꿈까지 포함
      const afterImg = text.indexOf('\n', match.index + match[0].length)
      const end = afterImg === -1 ? match.index + match[0].length : afterImg + 1
      segments.push(text.substring(lastIdx, end))
      lastIdx = end
    }
    // 이미지 이후 나머지 텍스트
    if (lastIdx < text.length) {
      segments.push(text.substring(lastIdx))
    }
    if (segments.length === 0) segments.push(text)
    return segments
  }, [])

  const doRender = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const text = pendingTextRef.current
    const segments = splitByImages(text)

    // 이미지가 포함된 세그먼트 수 (마지막 세그먼트는 tail이므로 제외)
    const stableCount = segments.length - 1

    // 기존 stable 세그먼트는 건드리지 않음 — 새로 추가된 것만 렌더
    while (segmentsRef.current.length < segments.length) {
      const div = document.createElement('div')
      el.appendChild(div)
      segmentsRef.current.push(div)
    }

    // 새로 확정된 stable 세그먼트만 렌더 (이미 렌더된 것은 스킵)
    for (let i = imgCountRef.current; i < stableCount; i++) {
      segmentsRef.current[i].innerHTML = renderMarkdown(segments[i])
    }
    imgCountRef.current = stableCount

    // tail (마지막 세그먼트) — 매번 업데이트 (이미지 없으므로 깜빡임 없음)
    const tailIdx = segments.length - 1
    segmentsRef.current[tailIdx].innerHTML = renderMarkdown(segments[tailIdx])
  }, [splitByImages])

  useEffect(() => {
    pendingTextRef.current = processed

    if (!isStreaming) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0

      if (wasStreamingRef.current) {
        // 스트리밍 → 완료 전환: 기존 DOM 유지, tail만 최종 렌더
        // 전체 innerHTML 교체하지 않음!
        doRender()
        wasStreamingRef.current = false
      } else {
        // 초기 로드 (스트리밍 아닌 상태로 메시지 표시)
        const el = containerRef.current
        if (el) {
          el.innerHTML = renderMarkdown(processed)
        }
      }
      return
    }

    wasStreamingRef.current = true

    // 스트리밍 중 — rAF throttle
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        doRender()
      })
    }
  }, [processed, isStreaming, doRender])

  // 스트리밍 시작 시 구조 초기화
  useEffect(() => {
    if (isStreaming) {
      const el = containerRef.current
      if (el) {
        el.innerHTML = ''
        segmentsRef.current = []
        imgCountRef.current = 0
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming && processed === ''])

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
