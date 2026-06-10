import { lazy, Suspense } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import Nav from './components/common/Nav'
import Home from './pages/Home'
import Chat from './pages/Chat'

// 비핵심 페이지는 route-level code-split (P4b-3 — 단일 번들 685kB 완화).
// Home/Chat 은 주 사용 경로라 eager 유지.
const Admin = lazy(() => import('./pages/Admin'))
const Story = lazy(() => import('./pages/Story'))
const StoryDetail = lazy(() => import('./pages/StoryDetail'))
const StoryEdit = lazy(() => import('./pages/StoryEdit'))
const History = lazy(() => import('./pages/History'))
const Login = lazy(() => import('./pages/Login'))
const Gallery = lazy(() => import('./pages/Gallery'))

function PageFallback() {
  return <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>
}

// 공통 셸: Nav 는 레이아웃에 고정, lazy 전환 시 본문(Outlet)만 fallback 으로 대체
// (Codex P4b-3 major: Routes 전체 Suspense 는 매 전환마다 Nav 가 사라지는 깜빡임)
function ShellLayout() {
  return (
    <>
      <Nav />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<ShellLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/story" element={<Story />} />
        <Route path="/story/:slug" element={<StoryDetail />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/story-edit" element={<StoryEdit />} />
        <Route path="/history" element={<History />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/gallery/:slug" element={<Gallery />} />
      </Route>
      {/* Nav 없는 풀스크린 라우트 */}
      <Route path="/chat/:slug" element={<Chat />} />
      <Route path="/login" element={
        <Suspense fallback={<PageFallback />}><Login /></Suspense>
      } />
    </Routes>
  )
}
