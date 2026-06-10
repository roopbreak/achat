import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/story', label: 'Story' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/admin', label: 'Admin' },
]

export default function Nav() {
  const { pathname } = useLocation()
  return (
    <nav className="sticky top-0 z-40 flex items-center gap-4 border-b border-border bg-card/95 px-5 py-3 backdrop-blur">
      <Link to="/" className="text-base font-bold text-primary hover:no-underline">
        achat-v2
      </Link>
      <div className="flex items-center gap-1">
        {LINKS.map(({ to, label }) => {
          // 경계 포함 매칭 — '/story-edit' 가 Story 탭을 활성화하지 않도록 (Codex P4b minor)
          const active = to === '/' ? pathname === '/' : (pathname === to || pathname.startsWith(`${to}/`))
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground hover:no-underline',
                active && 'bg-accent text-foreground',
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
