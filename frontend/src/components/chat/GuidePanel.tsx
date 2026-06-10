import type { StoryDetail } from '../../lib/api'
import CommandList from '../common/CommandList'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'

interface Props {
  open: boolean
  story: StoryDetail | null
  slug: string
  charName: string
  onClose: () => void
}

/** 채팅 화면 가이드 패널 — 캐릭터 소개 + 스토리 전용 !커맨드 목록 */
export default function GuidePanel({ open, story, slug, charName, onClose }: Props) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      {/* 모바일(<420px)에서 잘리지 않도록 w-full + max-w (Codex P4b-2 major 3) */}
      <SheetContent side="right" className="w-full max-w-[420px] gap-0">
        <SheetHeader>
          <SheetTitle>가이드</SheetTitle>
          <SheetDescription>{story?.char_name || charName || slug}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
          {!story ? (
            <p className="text-sm text-muted-foreground">스토리 정보를 불러오지 못했습니다.</p>
          ) : (
            <>
              {story.scenario && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-primary uppercase">시나리오</h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{story.scenario}</p>
                </section>
              )}
              {story.personality && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-primary uppercase">캐릭터</h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{story.personality}</p>
                </section>
              )}
              <section>
                <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-primary uppercase">커맨드</h4>
                <CommandList commands={story.commands} />
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
