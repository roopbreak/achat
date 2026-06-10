import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/', label: '서재', exact: true },
  // '/story/:slug' 는 서재의 책(상세)이지 관리가 아님 — 관리 탭은 exact 만 활성
  { to: '/story', label: '관리', exact: true },
  { to: '/gallery', label: '화첩' },
  { to: '/admin', label: '설정' },
]

/** NEXT 셸 — 심야 서재의 표제부: 명조 로고 + 금박 활성 밑줄 */
export default function Nav() {
  const { pathname } = useLocation()
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-baseline gap-8 px-5 py-3.5">
        <Link to="/" className="font-serif-kr text-lg font-black tracking-tight text-foreground hover:no-underline">
          아챗<span className="ml-1 align-middle text-[10px] font-normal tracking-[0.3em] text-primary uppercase">next</span>
        </Link>
        <div className="flex items-baseline gap-6">
          {LINKS.map(({ to, label, exact }) => {
            const active = exact ? pathname === to : (pathname === to || pathname.startsWith(`${to}/`))
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'relative pb-0.5 text-[13.5px] tracking-wide text-muted-foreground transition-colors hover:text-foreground hover:no-underline',
                  'after:absolute after:right-0 after:-bottom-px after:left-0 after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300',
                  active && 'text-foreground after:scale-x-100',
                )}
              >
                {label}
              </Link>
            )
          })}
        </div>
        <a
          href="/"
          className="ml-auto text-[11px] tracking-wider text-muted-foreground/70 hover:text-primary hover:no-underline"
          title="현재 버전으로 돌아가기"
        >
          ← 현재 UI
        </a>
      </div>
    </nav>
  )
}
