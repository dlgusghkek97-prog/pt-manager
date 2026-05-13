import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME } from './utils'
import TrainerDashboard from './TrainerDashboard'
import MemberDashboard from './MemberDashboard'
import LegalModal from './LegalModal'
import { TERMS_VERSION } from './legal'

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

  // 약관 동의 (localStorage 에 pt_agreed_{TERMS_VERSION}='1' 저장)
  const agreedKey = `pt_agreed_${TERMS_VERSION}`
  const [agreed, setAgreed] = useState(() => {
    try { return localStorage.getItem(agreedKey) === '1' } catch { return false }
  })
  const [legalOpen, setLegalOpen] = useState(null) // 'terms' | 'privacy' | null

  const markAgreed = (v) => {
    setAgreed(v)
    try {
      if (v) localStorage.setItem(agreedKey, '1')
      else localStorage.removeItem(agreedKey)
    } catch {}
  }

  // ─── 자동 로그인 ───
  // 1. localStorage에서 user 정보 복원
  // 2. Supabase Auth 세션도 같이 복원 (RLS 작동을 위해)
  useEffect(() => {
    const restoreSession = async () => {
      const savedUser = localStorage.getItem('pt_user')
      if (!savedUser) {
        setLoading(false)
        return
      }

      const parsedUser = JSON.parse(savedUser)

      // Supabase Auth 세션 확인
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // Auth 세션이 없는데 localStorage에는 user 정보가 있음 → 만료된 세션
        // → 로그아웃 처리
        localStorage.removeItem('pt_user')
        setLoading(false)
        return
      }

      // 세션 있으면 user 복원
      setUser(parsedUser)
      setLoading(false)
    }

    restoreSession()
  }, [])

  // ─── 푸시 알림 URL 쿼리 처리 ───
  // SW가 앱 닫힌 상태에서 푸시 클릭 시 ?notif_link=... 로 새 창 열어줌
  // user 로그인 완료 후 1번만 dispatch (3번 시도 X)
  useEffect(() => {
    if (!user) return

    const params = new URLSearchParams(window.location.search)
    const notifLink = params.get('notif_link')
    if (!notifLink) return

    // 쿼리 즉시 제거 (재진입 시 중복 방지)
    window.history.replaceState({}, '', window.location.pathname)

    // dashboard listener가 등록될 시간 확보 후 1번만 dispatch
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pt-notification-navigate', {
        detail: { link: notifLink }
      }))
    }, 800)

    return () => clearTimeout(timer)
  }, [user?.id])  // user 객체 전체 아닌 id만 — 불필요한 재실행 방지

  // ─── 트레이너 로그인 ───
  const trainerLogin = async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { 
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }
    const u = { type: 'trainer', ...data.user }
    setUser(u)
    localStorage.setItem('pt_user', JSON.stringify(u))
    setLoading(false)
  }

  // ─── 회원 로그인 (익명 Auth + claim_member RPC) ───
  // RPC 가 서버에서 code+name 검증 후 auth_user_id 를 세팅함.
  // 직접 UPDATE 하던 옛 방식과 달리 — 외부에서 코드/이름 모르고 가로채기 불가.
  const memberLogin = async () => {
    setLoading(true); setError('')

    try {
      // 1. 익명 Auth 세션 확보 (RPC 가 auth.uid() 사용)
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      if (!existingSession) {
        const { error: anonError } = await supabase.auth.signInAnonymously()
        if (anonError) {
          console.error('[memberLogin] anonymous auth error:', anonError)
          setError('로그인에 실패했습니다. 다시 시도해주세요.')
          setLoading(false)
          return
        }
      }

      // 2. RPC 로 code+name 검증 + auth_user_id 세팅 (서버 측, SECURITY DEFINER)
      const { data: memberId, error: claimError } = await supabase.rpc('claim_member', {
        code_input: memberCode.toUpperCase(),
        name_input: memberName.trim(),
      })

      if (claimError || !memberId) {
        const msg = claimError?.message || ''
        if (msg.includes('mismatch')) {
          setError('코드 또는 이름을 확인해주세요.')
        } else if (msg.includes('no auth session')) {
          setError('인증 세션이 없습니다. 다시 시도해주세요.')
        } else {
          console.error('[memberLogin] claim_member error:', claimError)
          setError('로그인 실패: ' + (claimError?.message || '알 수 없는 오류'))
        }
        setLoading(false)
        return
      }

      // 3. 클레임 성공 → 전체 회원 정보 조회
      const { data: memberData, error: fetchError } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single()

      if (fetchError || !memberData) {
        console.error('[memberLogin] 회원 정보 조회 실패:', fetchError)
        setError('회원 정보를 불러오지 못했습니다.')
        setLoading(false)
        return
      }

      // 4. user 세팅 + localStorage 저장
      const u = { type: 'member', ...memberData }
      setUser(u)
      localStorage.setItem('pt_user', JSON.stringify(u))
      setLoading(false)
    } catch (e) {
      console.error('[memberLogin] unexpected error:', e)
      setError('로그인 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  // ─── 로그아웃 ───
  const logout = async () => {
    localStorage.removeItem('pt_user')
    await supabase.auth.signOut()
    setUser(null)
    setMode('select')
    setEmail('')
    setPassword('')
    setMemberCode('')
    setMemberName('')
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
          <input style={S.input} type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && agreed && trainerLogin()} />
          <ConsentRow agreed={agreed} setAgreed={markAgreed} onOpen={setLegalOpen} />
          <button style={S.btnPrimary} onClick={trainerLogin} disabled={loading || !agreed}>{loading ? '로그인 중...' : '로그인'}</button>
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
          <ConsentRow agreed={agreed} setAgreed={markAgreed} onOpen={setLegalOpen} />
          <button style={S.btnPrimary} onClick={memberLogin} disabled={loading || !agreed}>{loading ? '확인 중...' : '접속하기'}</button>
          <button style={S.btnSecondary} onClick={() => setMode('select')}>← 뒤로가기</button>
        </div>
      )}

      {legalOpen && (
        <LegalModal kind={legalOpen} onClose={() => setLegalOpen(null)} />
      )}
    </div>
  )
}

// 약관 동의 체크박스 + 약관/개인정보 링크
function ConsentRow({ agreed, setAgreed, onOpen }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 4px',
      marginBottom: '4px',
      flexWrap: 'wrap',
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: THEME.primary }}
        />
        <span style={{ fontSize: '11px', color: THEME.text }}>아래에 동의합니다</span>
      </label>
      <span style={{ fontSize: '11px', color: THEME.textSub, display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onOpen('terms')} style={{ background: 'none', border: 'none', color: THEME.primary, textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '11px', fontFamily: 'inherit' }}>이용약관</button>
        <span>·</span>
        <button type="button" onClick={() => onOpen('privacy')} style={{ background: 'none', border: 'none', color: THEME.primary, textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '11px', fontFamily: 'inherit' }}>개인정보 처리방침</button>
      </span>
    </div>
  )
}