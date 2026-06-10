import { useState, useCallback, useEffect } from 'react'

let openLightbox: ((src: string) => void) | null = null

export function showLightbox(src: string) {
  openLightbox?.(src)
}

export default function Lightbox() {
  const [src, setSrc] = useState<string | null>(null)

  const open = useCallback((s: string) => setSrc(s), [])
  const close = useCallback(() => setSrc(null), [])

  useEffect(() => {
    openLightbox = open
    return () => { openLightbox = null }
  }, [open])

  useEffect(() => {
    if (!src) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [src, close])

  if (!src) return null

  return (
    <div className="lightbox open" onClick={close}>
      <img src={src} alt="" />
    </div>
  )
}
