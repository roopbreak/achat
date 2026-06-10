import { Link } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Download, HelpCircle, NotebookPen, RotateCcw, Save, Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  slug: string
  onReset: () => void
  onExport: () => void
  onToggleGuide: () => void
  onToggleSettings: () => void
  onToggleSlots: () => void
  onToggleNote: () => void
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="size-8 text-muted-foreground hover:text-foreground" onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export default function ChatHeader({
  slug, onReset, onExport,
  onToggleGuide, onToggleSettings, onToggleSlots, onToggleNote,
}: Props) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-background/80 px-3 py-2 backdrop-blur-md">
      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" asChild>
        <Link to="/"><ArrowLeft /></Link>
      </Button>
      <span className="font-serif-kr truncate text-[15px] font-bold tracking-tight">{slug}</span>
      <div className="ml-auto flex items-center gap-0.5">
        <IconAction label="가이드 (캐릭터·커맨드)" onClick={onToggleGuide}><HelpCircle /></IconAction>
        <IconAction label="저장 슬롯" onClick={onToggleSlots}><Save /></IconAction>
        <IconAction label="유저 노트" onClick={onToggleNote}><NotebookPen /></IconAction>
        <IconAction label="설정" onClick={onToggleSettings}><Settings /></IconAction>
        <IconAction label="대화 초기화" onClick={onReset}><RotateCcw /></IconAction>
        <IconAction label="내보내기" onClick={onExport}><Download /></IconAction>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="히스토리" className="size-8 text-muted-foreground hover:text-foreground" asChild>
              <Link to="/history"><BookOpen /></Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>히스토리</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
