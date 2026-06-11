import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'

interface Persona {
  id: number
  name: string
  is_default?: boolean
}

import type { OutputBand, StatusDisplay } from '@/hooks/useSettings'

interface Props {
  open: boolean
  fontSize: number
  model: string
  outputTarget: OutputBand
  autoContinue: boolean
  statusDisplay: StatusDisplay
  imagesEnabled: boolean
  loreDebug: boolean
  personas: Persona[]
  selectedPersonaId: number | null
  onChangeFontSize: (delta: number) => void
  onChangeModel: (model: string) => void
  onChangeOutputTarget: (band: OutputBand) => void
  onToggleAutoContinue: () => void
  onChangeStatusDisplay: (mode: StatusDisplay) => void
  onToggleImages: () => void
  onToggleLoreDebug: () => void
  onChangePersona: (id: number) => void
  onClose: () => void
}

const MODELS = [
  ['claude-sonnet-4-6', 'Sonnet 4.6'],
  ['claude-opus-4-6', 'Opus 4.6'],
  ['claude-haiku-4-5-20251001', 'Haiku 4.5'],
  ['gemini-2.5-flash', 'Gemini 2.5 Flash'],
  ['gemini-2.5-pro', 'Gemini 2.5 Pro'],
  ['gemini-3-flash-preview', 'Gemini 3 Flash'],
  ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite'],
  ['gemini-3.1-pro-preview', 'Gemini 3.1 Pro'],
  ['gemini-3.5-flash', 'Gemini 3.5 Flash'],
] as const

// 분량 목표 밴드(D5) — 프롬프트 목표만 결정, 상한(max_tokens)은 서버 고정 캡(16K)
const OUTPUT_BANDS = [
  ['story', '스토리 기본'],
  ['short', '짧게 (600~900자)'],
  ['light', '가볍게 (900~1,400자)'],
  ['medium', '보통 (1,400~1,800자)'],
  ['full', '충분히 (1,800~2,400자)'],
  ['epic', '길게 (2,400~3,600자)'],
] as const

export default function SettingsPanel({
  open, fontSize, model, outputTarget, autoContinue, statusDisplay, imagesEnabled, loreDebug,
  personas, selectedPersonaId,
  onChangeFontSize, onChangeModel, onChangeOutputTarget, onToggleAutoContinue, onChangeStatusDisplay,
  onToggleImages, onToggleLoreDebug, onChangePersona, onClose,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-80 gap-0">
        <SheetHeader>
          <SheetTitle>설정</SheetTitle>
          <SheetDescription>채팅 표시·생성 옵션</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-4">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground">글자 크기</Label>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="h-7 px-2 text-xs" onClick={() => onChangeFontSize(-1)}>A-</Button>
              <span className="min-w-10 text-center text-sm">{fontSize}px</span>
              <Button variant="secondary" size="sm" className="h-7 px-2 text-xs" onClick={() => onChangeFontSize(1)}>A+</Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">서술 분량</Label>
            <Select value={outputTarget} onValueChange={(v) => onChangeOutputTarget(v as OutputBand)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTPUT_BANDS.map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="opt-autocont" className="text-muted-foreground">자동 이어쓰기</Label>
            <Switch id="opt-autocont" checked={autoContinue} onCheckedChange={onToggleAutoContinue} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">상태창 표시</Label>
            <Select value={statusDisplay} onValueChange={(v) => onChangeStatusDisplay(v as StatusDisplay)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">본문에 표시</SelectItem>
                <SelectItem value="hud">화면 하단 고정</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">페르소나</Label>
            <Select
              value={selectedPersonaId != null ? String(selectedPersonaId) : undefined}
              onValueChange={(v) => onChangePersona(parseInt(v, 10))}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>
                {personas.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.is_default ? ' (기본)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">모델</Label>
            <Select value={model} onValueChange={onChangeModel}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELS.map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="opt-images" className="text-muted-foreground">이미지 표시</Label>
            <Switch id="opt-images" checked={imagesEnabled} onCheckedChange={onToggleImages} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="opt-lore" className="text-muted-foreground">로어북 디버그</Label>
            <Switch id="opt-lore" checked={loreDebug} onCheckedChange={onToggleLoreDebug} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
