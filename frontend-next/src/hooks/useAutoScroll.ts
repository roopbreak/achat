import { useRef, useCallback, useEffect } from 'react'

export function useAutoScroll(deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null)
  const shouldScroll = useRef(true)

  const checkScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    shouldScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = ref.current
    if (el && shouldScroll.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [])

  const forceScrollToBottom = useCallback(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ref, checkScroll, scrollToBottom, forceScrollToBottom }
}
