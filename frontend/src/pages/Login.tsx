import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAuthToken } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    <div className="mx-auto mt-[20vh] w-full max-w-sm px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-primary">achat-v2</CardTitle>
          <CardDescription>접속 코드를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="password"
              placeholder="접속 코드 입력"
              value={code}
              onChange={e => setCode(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full">입장</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
