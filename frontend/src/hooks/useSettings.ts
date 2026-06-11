import { useState, useCallback } from 'react'

const FONT_MIN = 12, FONT_MAX = 24, FONT_DEFAULT = 15

function read(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback
}

/** 분량 목표 밴드(D5) — 'story' = 스토리 기본(서버가 stories.output_target → 기본 밴드 해석) */
export type OutputBand = 'story' | 'short' | 'light' | 'medium' | 'full' | 'epic'

const OUTPUT_BANDS: OutputBand[] = ['story', 'short', 'light', 'medium', 'full', 'epic']

// 구 maxTokens 다이얼(localStorage chat_max_tokens) → 밴드 1회 마이그레이션
const LEGACY_TOKENS_BAND: Record<string, OutputBand> = {
  '1024': 'short', '2048': 'light', '3072': 'medium', '4096': 'full', '8192': 'epic',
}

function readOutputTarget(): OutputBand {
  const stored = localStorage.getItem('chat_output_target')
  if (stored && OUTPUT_BANDS.includes(stored as OutputBand)) return stored as OutputBand
  const legacy = localStorage.getItem('chat_max_tokens')
  if (legacy && LEGACY_TOKENS_BAND[legacy]) {
    const band = LEGACY_TOKENS_BAND[legacy]
    localStorage.setItem('chat_output_target', band)
    return band
  }
  return 'story'
}

/** 상태창 표시 방식 — inline=본문 말풍선에 녹임(모바일 가독성), hud=화면 하단 고정 */
export type StatusDisplay = 'inline' | 'hud'

export interface Settings {
  fontSize: number
  model: string
  outputTarget: OutputBand
  autoContinue: boolean
  statusDisplay: StatusDisplay
  imagesEnabled: boolean
  loreDebug: boolean
}

export function useSettings() {
  const [fontSize, setFontSize] = useState(() => parseInt(read('chat_font_size', String(FONT_DEFAULT)), 10))
  const [model, setModel] = useState(() => read('chat_model', 'claude-sonnet-4-6'))
  const [outputTarget, setOutputTarget] = useState<OutputBand>(readOutputTarget)
  // 자동 이어쓰기: 기본 on(현행 백스톱 유지). 사용자가 끄면 1회 생성만.
  const [autoContinue, setAutoContinue] = useState(() => read('chat_auto_continue', 'on') !== 'off')
  // 상태창 표시: 기본 inline(본문에 녹임 — 모바일 가독성). 'hud'로 화면 고정 전환 가능.
  const [statusDisplay, setStatusDisplay] = useState<StatusDisplay>(() => read('chat_status_display', 'inline') === 'hud' ? 'hud' : 'inline')
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

  const changeOutputTarget = useCallback((band: OutputBand) => {
    setOutputTarget(band)
    localStorage.setItem('chat_output_target', band)
  }, [])

  const toggleAutoContinue = useCallback(() => {
    setAutoContinue(prev => {
      const next = !prev
      localStorage.setItem('chat_auto_continue', next ? 'on' : 'off')
      return next
    })
  }, [])

  const changeStatusDisplay = useCallback((mode: StatusDisplay) => {
    setStatusDisplay(mode)
    localStorage.setItem('chat_status_display', mode)
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
    fontSize, model, outputTarget, autoContinue, statusDisplay, imagesEnabled, loreDebug,
    changeFontSize, changeModel, changeOutputTarget, toggleAutoContinue, changeStatusDisplay, toggleImages, toggleLoreDebug,
  }
}
