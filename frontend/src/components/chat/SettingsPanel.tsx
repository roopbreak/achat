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

interface Props {
  open: boolean
  fontSize: number
  model: string
  maxTokens: number
  imagesEnabled: boolean
  loreDebug: boolean
  personas: Persona[]
  selectedPersonaId: number | null
  onChangeFontSize: (delta: number) => void
  onChangeModel: (model: string) => void
  onChangeMaxTokens: (tokens: number) => void
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

const MAX_TOKENS = [
  [1024, '짧게 (1K)'],
  [2048, '보통 (2K)'],
  [3072, '기본 (3K)'],
  [4096, '길게 (4K)'],
  [8192, '매우 길게 (8K)'],
] as const

export default function SettingsPanel({
  open, fontSize, model, maxTokens, imagesEnabled, loreDebug,
  personas, selectedPersonaId,
  onChangeFontSize, onChangeModel, onChangeMaxTokens,
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
            <Label className="text-muted-foreground">출력량</Label>
            <Select value={String(maxTokens)} onValueChange={(v) => onChangeMaxTokens(parseInt(v, 10))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MAX_TOKENS.map(([v, label]) => (
                  <SelectItem key={v} value={String(v)}>{label}</SelectItem>
                ))}
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
