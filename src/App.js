import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME } from './utils'
import TrainerDashboard from './TrainerDashboard'
import MemberDashboard from './MemberDashboard'

const PTLogo = ({ size = 48 }) => (
  <div style={{
    width: size, height: size, background: THEME.primaryAccent, borderRadius: size * 0.25,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
    flexShrink: 0
  }}>
    <span style={{ color: THEME.primaryDark, fontSize: size * 0.34, fontWeight: '500', lineHeight: 1, letterSpacing: '-0.5px' }}>PT</span>
    <div style={{ width: size * 0.45, height: '0.5px', background: THEME.primaryDark, margin: `${size * 0.06}px 0 ${size * 0.04}px`, borderRadius: '1px' }} />
    <span style={{ color: THEME.primaryDark, fontSize: size * 0.13, letterSpacing: '0.6px', opacity: 0.85 }}>MANAGER</span>
  </div>
)

export default function App() {
  const [mode, setMode] = useState('select')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [memberCode, setMemberCode] = useState('')
  const [memberName, setMemberName] = useState('')

  // 자동로그인
  useEffect(() => {
    const savedUser = localStorage.getItem('pt_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const trainerLogin = async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('이메일 또는 비밀번호가 올바르지 않습니다.') }
    else {
      const u = { type: 'trainer', ...data.user }
      setUser(u)
      localStorage.setItem('pt_user', JSON.stringify(u))
    }
    setLoading(false)
  }

  const memberLogin = async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.from('members').select('*').eq('code', memberCode.toUpperCase()).single()
    if (error || !data) { setError('코드를 확인해주세요.') }
    else if (data.name !== memberName.trim()) { setError('이름이 일치하지 않습니다.') }
    else {
      const u = { type: 'member', ...data }
      setUser(u)
      localStorage.setItem('pt_user', JSON.stringify(u))
    }
    setLoading(false)
  }

  const logout = () => {
    localStorage.removeItem('pt_user')
    supabase.auth.signOut()
    setUser(null); setMode('select'); setEmail(''); setPassword(''); setMemberCode(''); setMemberName('')
  }

  if (loading) return (
    <div style={{ ...S.container, alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: THEME.primary, fontSize: '14px' }}>로딩 중...</p>
    </div>
  )

  if (user?.type === 'trainer') return <TrainerDashboard user={user} onLogout={logout} />
  if (user?.type === 'member') return <MemberDashboard user={user} onLogout={logout} />

  return (
    <div style={{ ...S.container, alignItems: 'center', justifyContent: 'center' }}>
      {mode === 'select' && (
        <div style={S.loginCard}>
          <div style={{ textAlign: 'center', marginBottom: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '14px' }}>
              <PTLogo size={56} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '500', color: THEME.primary, margin: '0 0 4px', letterSpacing: '-0.3px' }}>PT Manager</h1>
            <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>인천 체형교정 트레이닝</p>
          </div>
          <button style={S.btnPrimary} onClick={() => setMode('trainer')}>트레이너 로그인</button>
          <button style={S.btnSecondary} onClick={() => setMode('member')}>회원 접속</button>
        </div>
      )}

      {mode === 'trainer' && (
        <div style={S.loginCard}>
          <div style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '10px' }}>
              <PTLogo size={42} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: '500', color: THEME.text, margin: 0, letterSpacing: '-0.3px' }}>트레이너 로그인</h2>
          </div>
          {error && <p style={{ color: THEME.danger, fontSize: '12px', textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
          <input style={S.input} type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={S.input} type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && trainerLogin()} />
          <button style={S.btnPrimary} onClick={trainerLogin} disabled={loading}>{loading ? '로그인 중...' : '로그인'}</button>
          <button style={S.btnSecondary} onClick={() => setMode('select')}>← 뒤로가기</button>
        </div>
      )}

      {mode === 'member' && (
        <div style={S.loginCard}>
          <div style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '10px' }}>
              <PTLogo size={42} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: '500', color: THEME.text, margin: '0 0 4px', letterSpacing: '-0.3px' }}>회원 접속</h2>
            <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>트레이너에게 받은 코드를 입력해주세요</p>
          </div>
          {error && <p style={{ color: THEME.danger, fontSize: '12px', textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
          <input style={S.input} type="text" placeholder="이름" value={memberName} onChange={e => setMemberName(e.target.value)} />
          <input style={S.input} type="text" placeholder="접속 코드 (예: AB1234)" value={memberCode} onChange={e => setMemberCode(e.target.value.toUpperCase())} maxLength={6} />
          <button style={S.btnPrimary} onClick={memberLogin} disabled={loading}>{loading ? '확인 중...' : '접속하기'}</button>
          <button style={S.btnSecondary} onClick={() => setMode('select')}>← 뒤로가기</button>
        </div>
      )}
    </div>
  )
}