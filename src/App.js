import React, { useState } from 'react'
import { supabase } from './supabase'
import { S } from './utils'
import TrainerDashboard from './TrainerDashboard'
import MemberDashboard from './MemberDashboard'

export default function App() {
  const [mode, setMode] = useState('select')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [memberCode, setMemberCode] = useState('')
  const [memberName, setMemberName] = useState('')

  const trainerLogin = async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('이메일 또는 비밀번호가 올바르지 않습니다.') }
    else { setUser({ type: 'trainer', ...data.user }) }
    setLoading(false)
  }

  const memberLogin = async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.from('members').select('*').eq('code', memberCode.toUpperCase()).single()
    if (error || !data) { setError('코드를 확인해주세요.') }
    else { setUser({ type: 'member', ...data }) }
    setLoading(false)
  }

  const logout = () => { setUser(null); setMode('select'); setEmail(''); setPassword(''); setMemberCode(''); setMemberName('') }

  if (user?.type === 'trainer') return <TrainerDashboard user={user} onLogout={logout} />
  if (user?.type === 'member') return <MemberDashboard user={user} onLogout={logout} />

  return (
    <div style={S.container}>
      {mode === 'select' && (
        <div style={S.loginCard}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1A1A2E', textAlign: 'center', margin: '0 0 4px' }}>💪 PT Manager</h1>
          <p style={{ fontSize: '14px', color: '#888', textAlign: 'center', margin: '0 0 20px' }}>인천 체형교정 트레이닝</p>
          <button style={S.btnPrimary} onClick={() => setMode('trainer')}>트레이너 로그인</button>
          <button style={S.btnSecondary} onClick={() => setMode('member')}>회원 접속</button>
        </div>
      )}

      {mode === 'trainer' && (
        <div style={S.loginCard}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1A1A2E', textAlign: 'center', margin: '0 0 16px' }}>트레이너 로그인</h2>
          {error && <p style={{ color: '#E84747', fontSize: '13px', textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
          <input style={S.input} type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={S.input} type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && trainerLogin()} />
          <button style={S.btnPrimary} onClick={trainerLogin} disabled={loading}>{loading ? '로그인 중...' : '로그인'}</button>
          <button style={S.btnSecondary} onClick={() => setMode('select')}>뒤로가기</button>
        </div>
      )}

      {mode === 'member' && (
        <div style={S.loginCard}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1A1A2E', textAlign: 'center', margin: '0 0 8px' }}>회원 접속</h2>
          <p style={{ fontSize: '14px', color: '#888', textAlign: 'center', margin: '0 0 16px' }}>트레이너에게 받은 코드를 입력해주세요</p>
          {error && <p style={{ color: '#E84747', fontSize: '13px', textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
          <input style={S.input} type="text" placeholder="이름" value={memberName} onChange={e => setMemberName(e.target.value)} />
          <input style={S.input} type="text" placeholder="접속 코드 (예: AB1234)" value={memberCode} onChange={e => setMemberCode(e.target.value.toUpperCase())} maxLength={6} />
          <button style={S.btnPrimary} onClick={memberLogin} disabled={loading}>{loading ? '확인 중...' : '접속하기'}</button>
          <button style={S.btnSecondary} onClick={() => setMode('select')}>뒤로가기</button>
        </div>
      )}
    </div>
  )
}