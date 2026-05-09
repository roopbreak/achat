import { useState, useCallback } from 'react'

const FONT_MIN = 12, FONT_MAX = 24, FONT_DEFAULT = 15

function read(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback
}

export interface Settings {
  fontSize: number
  model: string
  maxTokens: number
  imagesEnabled: boolean
  loreDebug: boolean
}

export function useSettings() {
  const [fontSize, setFontSize] = useState(() => parseInt(read('chat_font_size', String(FONT_DEFAULT)), 10))
  const [model, setModel] = useState(() => read('chat_model', 'claude-sonnet-4-6'))
  const [maxTokens, setMaxTokens] = useState(() => parseInt(read('chat_max_tokens', '4096'), 10))
  const [imagesEnabled, setImagesEnabled] = useState(() => read('chat_images', 'on') !== 'off')
  const [loreDebug, setLoreDebug] = useState(() => read('chat_lore_debug', 'off') === 'on')

  const changeFontSize = useCallback((delta: number) => {
    setFontSize(prev => {
      const next = Math.min(FONT_MAX, Math.max(FONT_MIN, prev + delta))
      localStorage.setItem('chat_font_size', String(next))
      return next
    })
  }, [])

  const changeModel = useCallback((m: string) => {
    setModel(m)
    localStorage.setItem('chat_model', m)
  }, [])

  const changeMaxTokens = useCallback((t: number) => {
    setMaxTokens(t)
    localStorage.setItem('chat_max_tokens', String(t))
  }, [])

  const toggleImages = useCallback(() => {
    setImagesEnabled(prev => {
      const next = !prev
      localStorage.setItem('chat_images', next ? 'on' : 'off')
      return next
    })
  }, [])

  const toggleLoreDebug = useCallback(() => {
    setLoreDebug(prev => {
      const next = !prev
      localStorage.setItem('chat_lore_debug', next ? 'on' : 'off')
      return next
    })
  }, [])

  return {
    fontSize, model, maxTokens, imagesEnabled, loreDebug,
    changeFontSize, changeModel, changeMaxTokens, toggleImages, toggleLoreDebug,
  }
}
