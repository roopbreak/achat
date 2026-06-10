import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
// 순서 중요: index.css(Tailwind preflight + shadcn 토큰) → global.css(legacy 별칭·클래스 오버라이드)
import './index.css'
import './styles/global.css'

// 서버 상태 ownership: docs/plan/achat-v2-p4-contract-ui_2026-06-10.md §3.2 표 참조.
// 채팅 스트림(transient)은 Query 비관여 — useSSEStream/useSession 로컬 소유 유지.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 운영자 1인 앱 — 탭 전환마다 refetch 할 필요 없음
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
