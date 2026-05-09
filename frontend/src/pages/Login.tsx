import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAuthToken } from '../lib/api'

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
    <div className="page" style={{ maxWidth: 400, marginTop: '20vh' }}>
      <h1 style={{ marginBottom: 24, color: 'var(--accent)' }}>AChat</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="접속 코드 입력"
          value={code}
          onChange={e => setCode(e.target.value)}
          autoFocus
        />
        {error && <p style={{ color: 'var(--danger)', marginTop: 8, fontSize: 13 }}>{error}</p>}
        <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: 12 }}>
          입장
        </button>
      </form>
    </div>
  )
}
