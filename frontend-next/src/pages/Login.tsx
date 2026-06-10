import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAuthToken } from '../lib/api'
import { Button } from '@/components/ui/button'

/** NEXT 표제지 — 책의 속표지처럼 비어 있고 단정하게 */
export default function Login() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/stories', {
        headers: { Authorization: `Bearer ${code}` },
      })
      if (res.ok) {
        setAuthToken(code)
        navigate('/')
      } else {
        setError('잘못된 접속 코드입니다.')
      }
    } catch {
      setError('서버에 연결할 수 없습니다.')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="reveal w-full max-w-xs text-center">
        <p className="mb-2 text-[10px] tracking-[0.45em] text-primary uppercase">Interactive Fiction</p>
        <h1 className="font-serif-kr text-4xl font-black tracking-tight">심야 서재</h1>
        <div className="mx-auto mt-5 mb-10 flex items-center justify-center gap-2">
          <span className="h-px w-8 bg-primary/60" />
          <span className="size-1 rotate-45 bg-primary" />
          <span className="h-px w-8 bg-primary/60" />
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="접속 코드"
            className="border-b border-border bg-transparent py-2 text-center text-[15px] tracking-[0.3em] outline-none transition-colors placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:border-primary"
            value={code}
            onChange={e => setCode(e.target.value)}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="font-serif-kr mt-2 font-bold tracking-[0.35em]">입 장</Button>
        </form>
      </div>
    </div>
  )
}
