import type { Choice } from '../../lib/status'
import { Button } from '@/components/ui/button'

interface Props {
  choices: Choice[]
  /** 일반 선택지 클릭 — marker 제거된 text 를 그대로 전송 */
  onChoose: (text: string) => void
  /** 자유 입력 선택지 클릭 — 입력창 포커스(전송 안 함) */
  onFreeInput: () => void
  disabled?: boolean
  fontSize?: number
}

/**
 * 상태창에서 분리한 선택지를 버튼으로 렌더(세로 스택, 모바일 친화).
 * - kind='cast' 선택지는 렌더하지 않음(AI 캐스팅은 버튼 제외).
 * - kind='free' 는 onFreeInput(입력창 포커스), kind='normal' 은 onChoose(전송).
 */
export default function ChoiceButtons({ choices, onChoose, onFreeInput, disabled, fontSize }: Props) {
  const visible = choices.filter(c => c.kind !== 'cast')
  if (visible.length === 0) return null

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-t border-border bg-card px-3 py-2.5">
      {visible.map((c, i) => (
        <Button
          key={i}
          variant="outline"
          disabled={disabled}
          onClick={() => (c.kind === 'free' ? onFreeInput() : onChoose(c.text))}
          className="h-auto w-full justify-start whitespace-normal py-2 text-left leading-relaxed"
          style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
        >
          <span className="mr-2 shrink-0 text-xs text-muted-foreground">{c.marker}</span>
          <span className="flex-1">{c.text}</span>
        </Button>
      ))}
    </div>
  )
}
