import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME } from './utils'
import TrainerDashboard from './TrainerDashboard'
import MemberDashboard from './MemberDashboard'
import LandingPage from './LandingPage'
import LegalModal from './LegalModal'
import { TERMS_VERSION } from './legal'
import { identifyUser, resetUser } from './monitoring'

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

// 컴포넌트 평가 전(=Supabase 가 hash 처리하기 전) 동기적으로 recovery 진입 감지
// 또는 ?app=1 / ?login=1 / 토스 결제 콜백 등 직접 진입 시 랜딩 페이지 우회
const initialModeFromUrl = (() => {
  if (typeof window === 'undefined') return 'landing'
  try {
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    if (hash.includes('type=recovery') || hash.includes('access_token=') ||
        search.includes('type=recovery')) {
      return 'reset-password'
    }
    // 토스 결제 콜백 / 푸시 알림 / 명시적 앱 진입
    const params = new URLSearchParams(search)
    if (params.get('toss') || params.get('notif_link') || params.get('app') === '1') {
      return 'select'
    }
  } catch {}
  return 'landing'  // 기본값: 랜딩 페이지
})()

export default function App() {
  // mode: landing | select | trainer | member | signup | forgot-password | forgot-email | reset-password
  const [mode, setMode] = useState(initialModeFromUrl)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [signupReferralCode, setSignupReferralCode] = useState('')
  const [memberCode, setMemberCode] = useState('')
  const [memberName, setMemberName] = useState('')
  const [findName, setFindName] = useState('')
  const [findPhone, setFindPhone] = useState('')
  const [foundEmail, setFoundEmail] = useState('')

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
  // user 변경에 따라 모니터링 식별 동기화
  useEffect(() => {
    if (user) identifyUser(user)
    else resetUser()
  }, [user])

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

      // 트레이너면 name 보강 (옛 user 객체에 name 없을 수 있음)
      if (parsedUser.type === 'trainer' && !parsedUser.name) {
        const { data: trainerRow } = await supabase
          .from('trainers').select('name').eq('id', parsedUser.id).single()
        if (trainerRow?.name) {
          parsedUser.name = trainerRow.name
          localStorage.setItem('pt_user', JSON.stringify(parsedUser))
        }
      }

      // 세션 있으면 user 복원
      setUser(parsedUser)
      setLoading(false)
    }

    restoreSession()
  }, [])

  // ─── 토스페이먼츠 결제창 success/fail 리다이렉트 감지 ───
  // SubscriptionModal 의 requestBillingAuth 가 ?toss=billing-success&plan=...&authKey=...&customerKey=... 로 복귀
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const toss = params.get('toss')
    if (!toss) return

    const cleanUrl = () => {
      window.history.replaceState(null, '', window.location.pathname)
    }

    if (toss === 'billing-success') {
      const authKey = params.get('authKey')
      const customerKey = params.get('customerKey')
      const plan = params.get('plan')
      if (!authKey || !customerKey || !plan) { cleanUrl(); return }
      ;(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { alert('세션이 만료되어 결제 처리 못 했습니다. 다시 로그인 후 결제해주세요.'); cleanUrl(); return }
        try {
          const res = await fetch(
            `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/toss-issue-billing`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ authKey, customerKey, plan }),
            }
          )
          const result = await res.json()
          if (result.ok) {
            alert(`구독이 활성화됐습니다.\n다음 결제일: ${new Date(result.expires_at).toLocaleDateString()}`)
          } else {
            alert(`결제 실패: ${result.reason}\n\n다른 카드로 다시 시도하거나 문의해주세요.`)
          }
        } catch (e) {
          alert('결제 처리 중 오류: ' + e.message)
        } finally {
          cleanUrl()
          window.location.reload()  // SubscriptionGate 재검사
        }
      })()
    } else if (toss === 'billing-fail') {
      const msg = params.get('message') || params.get('code') || '카드 등록 취소됨'
      alert(`결제 실패: ${msg}`)
      cleanUrl()
    }
  }, [])

  // ─── 가입 후 첫 로그인 시 추천 코드 자동 적용 ───
  // 가입 폼에서 'pt_pending_referral' 로 저장된 코드 → 트레이너 로그인 성공 후 1회 적용
  useEffect(() => {
    if (user?.type !== 'trainer') return
    let code
    try { code = localStorage.getItem('pt_pending_referral') } catch {}
    if (!code) return
    ;(async () => {
      const { data, error } = await supabase.rpc('apply_referral_code', { p_code: code })
      try { localStorage.removeItem('pt_pending_referral') } catch {}
      if (!error && data?.success) {
        alert(`추천 코드 적용 완료! 무료 체험이 +${data.referee_bonus_days || 3}일 늘어났어요 🎁`)
      } else if (error) {
        const m = error.message || ''
        if (m.includes('invalid_referral_code')) console.warn('[apply_referral_code] invalid')
        else if (m.includes('self_referral')) console.warn('[apply_referral_code] self_referral')
        else if (m.includes('already_referred')) console.warn('[apply_referral_code] already_referred')
        else if (m.includes('max_referrals')) console.warn('[apply_referral_code] referrer max reached')
        else console.error('[apply_referral_code]', m)
      }
    })()
  }, [user?.id, user?.type])

  // ─── 비밀번호 재설정 메일 링크 진입 감지 ───
  // Supabase 가 #access_token=... 처리 후 onAuthStateChange 로 PASSWORD_RECOVERY 발생
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // dashboard 진입 차단하고 새 비번 설정 모드로
        try { localStorage.removeItem('pt_user') } catch {}
        setUser(null)
        setMode('reset-password')
        setError(''); setInfo('')
      }
    })
    return () => subscription.unsubscribe()
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

  // ─── 트레이너 회원가입 ───
  const trainerSignup = async () => {
    setLoading(true); setError(''); setInfo('')

    if (!email.trim() || !password || !signupName.trim()) {
      setError('이름·이메일·비밀번호를 모두 입력해주세요.'); setLoading(false); return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.'); setLoading(false); return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.'); setLoading(false); return
    }

    // 추천 코드는 로그인 후 RPC 호출이 필요하므로 임시 보관
    if (signupReferralCode.trim()) {
      try { localStorage.setItem('pt_pending_referral', signupReferralCode.trim().toUpperCase()) } catch {}
    }

    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: signupName.trim(),
          phone: signupPhone.trim(),
        },
      },
    })

    setLoading(false)

    if (signupError) {
      const msg = signupError.message || ''
      if (msg.toLowerCase().includes('already')) {
        setError('이미 가입된 이메일입니다. 로그인을 시도해주세요.')
      } else {
        setError('가입 실패: ' + msg)
      }
      return
    }

    // 이메일 확인 활성화 여부에 따라 분기
    // - session 있음 (즉시 로그인 가능): 자동 로그인 처리
    // - session 없음 (이메일 확인 필요): 안내 메시지
    if (data?.session) {
      // 본인 trainers row 보장 (없으면 INSERT, 있으면 skip)
      await supabase.from('trainers').upsert(
        {
          id: data.user.id,
          name: signupName.trim(),
          email: data.user.email,
          phone: signupPhone.trim() || null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      const u = { type: 'trainer', ...data.user, name: signupName.trim() }
      setUser(u)
      localStorage.setItem('pt_user', JSON.stringify(u))
    } else {
      setInfo('가입 신청 완료. 입력한 이메일로 확인 메일이 발송됐어요. 메일에서 인증 후 로그인해주세요.')
      setMode('trainer')
      setPassword(''); setPasswordConfirm('')
    }
  }

  // ─── 비밀번호 찾기 (재설정 메일 발송) ───
  const sendPasswordReset = async () => {
    setLoading(true); setError(''); setInfo('')
    if (!email.trim()) {
      setError('이메일을 입력해주세요.'); setLoading(false); return
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (resetError) {
      setError('재설정 메일 발송 실패: ' + resetError.message)
      return
    }
    setInfo('비밀번호 재설정 메일을 보냈어요. 메일에서 링크를 누르면 새 비밀번호를 설정할 수 있어요.')
  }

  // ─── 이메일 찾기 (이름 + 휴대폰 → RPC → 마스킹된 이메일) ───
  // RPC 가 SECURITY DEFINER 라 trainers RLS 우회. 비로그인 상태에서도 조회 가능.
  const findEmail = async () => {
    setLoading(true); setError(''); setInfo(''); setFoundEmail('')
    if (!findName.trim() || !findPhone.trim()) {
      setError('이름과 휴대폰 번호를 입력해주세요.'); setLoading(false); return
    }
    const phoneNorm = findPhone.replace(/[\s-]/g, '')
    const { data, error: findError } = await supabase.rpc('find_trainer_email', {
      name_input: findName.trim(),
      phone_input: phoneNorm,
    })
    setLoading(false)
    if (findError) {
      setError('조회 실패: ' + findError.message); return
    }
    if (!data) {
      setError('일치하는 트레이너 정보를 찾지 못했어요. 이름·휴대폰을 다시 확인해주세요.')
      return
    }
    setFoundEmail(data)
  }

  // ─── 비밀번호 재설정 (메일 링크 클릭 후) ───
  const updatePassword = async () => {
    setLoading(true); setError(''); setInfo('')
    if (!password || password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.'); setLoading(false); return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.'); setLoading(false); return
    }
    const { error: updError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updError) {
      setError('비밀번호 변경 실패: ' + updError.message); return
    }
    setInfo('비밀번호가 변경됐어요. 새 비밀번호로 다시 로그인해주세요.')
    await supabase.auth.signOut()
    setMode('trainer')
    setPassword(''); setPasswordConfirm('')
  }

  // ─── 트레이너 로그인 ───
  const trainerLogin = async () => {
    setLoading(true); setError(''); setInfo('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }
    // 본인 trainers row 보장 (메일 인증 후 첫 로그인 시 자동 생성)
    let trainerName = data.user.user_metadata?.name || data.user.email.split('@')[0]
    if (data?.user) {
      await supabase.from('trainers').upsert(
        {
          id: data.user.id,
          name: trainerName,
          email: data.user.email,
          phone: data.user.user_metadata?.phone || null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      // 기존 trainer 라면 trainers.name 이 신뢰할 만한 값 (옛 가입자는 metadata 없을 수 있음)
      const { data: trainerRow } = await supabase
        .from('trainers').select('name').eq('id', data.user.id).single()
      if (trainerRow?.name) trainerName = trainerRow.name
    }
    const u = { type: 'trainer', ...data.user, name: trainerName }
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

  // 비밀번호 재설정 모드 — recovery session 으로 들어왔을 때 dashboard 진입 차단
  if (mode === 'reset-password') {
    return (
      <div style={{ ...S.container, alignItems: 'center', justifyContent: 'center' }}>
        <div style={S.loginCard}>
          <div style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '10px' }}>
              <PTLogo size={42} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: '500', color: THEME.text, margin: '0 0 4px', letterSpacing: '-0.3px' }}>새 비밀번호 설정</h2>
            <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>새로 사용할 비밀번호를 입력해주세요</p>
          </div>
          {error && <p style={{ color: THEME.danger, fontSize: '12px', textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
          {info && <p style={{ color: THEME.primary, fontSize: '12px', textAlign: 'center', margin: '0 0 8px', lineHeight: 1.5 }}>{info}</p>}
          <input style={S.input} type="password" placeholder="새 비밀번호 (6자 이상)" value={password} onChange={e => setPassword(e.target.value)} />
          <input style={S.input} type="password" placeholder="비밀번호 확인" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && updatePassword()} />
          <button style={S.btnPrimary} onClick={updatePassword} disabled={loading}>{loading ? '변경 중...' : '비밀번호 변경'}</button>
        </div>
      </div>
    )
  }

  if (user?.type === 'trainer') return <TrainerDashboard user={user} onLogout={logout} />
  if (user?.type === 'member') return <MemberDashboard user={user} onLogout={logout} />

  // 랜딩 페이지 — 비로그인 첫 진입
  if (mode === 'landing') {
    return (
      <LandingPage
        onStart={() => { setMode('signup'); setError(''); setInfo('') }}
        onMemberLogin={() => { setMode('member'); setError(''); setInfo('') }}
        onTrainerLogin={() => { setMode('trainer'); setError(''); setInfo('') }}
      />
    )
  }

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
          <button
            onClick={() => { setMode('signup'); setError(''); setInfo('') }}
            style={{ background: 'none', border: 'none', color: THEME.textSub, padding: '8px 0', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', marginTop: '4px' }}
          >트레이너 회원가입</button>
        </div>
      )}

      {mode === 'signup' && (
        <div style={S.loginCard}>
          <div style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '10px' }}>
              <PTLogo size={42} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: '500', color: THEME.text, margin: '0 0 4px', letterSpacing: '-0.3px' }}>트레이너 회원가입</h2>
            <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>이메일로 가입하면 본인 계정에서 회원을 관리할 수 있어요</p>
          </div>
          {error && <p style={{ color: THEME.danger, fontSize: '12px', textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
          {info && <p style={{ color: THEME.primary, fontSize: '12px', textAlign: 'center', margin: '0 0 8px', lineHeight: 1.5 }}>{info}</p>}
          <input style={S.input} type="text" placeholder="이름" value={signupName} onChange={e => setSignupName(e.target.value)} />
          <input style={S.input} type="tel" placeholder="휴대폰 (예: 01012345678)" value={signupPhone} onChange={e => setSignupPhone(e.target.value.replace(/[^0-9]/g, ''))} maxLength={11} />
          <input style={S.input} type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={S.input} type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={e => setPassword(e.target.value)} />
          <input style={S.input} type="password" placeholder="비밀번호 확인" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && agreed && trainerSignup()} />
          <input
            style={S.input}
            type="text"
            placeholder="추천 코드 (선택)"
            value={signupReferralCode}
            onChange={e => setSignupReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9가-힣\-]/g, ''))}
            maxLength={20}
          />
          <p style={{ fontSize: '10px', color: THEME.textHint, margin: '-4px 4px 6px', lineHeight: 1.4 }}>
            추천 코드를 입력하면 무료 체험이 +3일 늘어나요
          </p>
          <ConsentRow agreed={agreed} setAgreed={markAgreed} onOpen={setLegalOpen} />
          <button style={S.btnPrimary} onClick={trainerSignup} disabled={loading || !agreed}>{loading ? '가입 중...' : '가입하기'}</button>
          <button style={S.btnSecondary} onClick={() => { setMode('select'); setError(''); setInfo('') }}>← 뒤로가기</button>
          <p style={{ fontSize: '10px', color: THEME.textHint, textAlign: 'center', margin: '8px 0 0', lineHeight: 1.5 }}>
            가입 후 입력한 이메일로 확인 메일이 발송될 수 있어요.<br/>메일에서 인증 링크를 누르면 로그인 가능합니다.
          </p>
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
          {info && <p style={{ color: THEME.primary, fontSize: '12px', textAlign: 'center', margin: '0 0 8px', lineHeight: 1.5 }}>{info}</p>}
          <input style={S.input} type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={S.input} type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && agreed && trainerLogin()} />
          <ConsentRow agreed={agreed} setAgreed={markAgreed} onOpen={setLegalOpen} />
          <button style={S.btnPrimary} onClick={trainerLogin} disabled={loading || !agreed}>{loading ? '로그인 중...' : '로그인'}</button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '6px 0 4px' }}>
            <button onClick={() => { setMode('forgot-email'); setError(''); setInfo(''); setFoundEmail('') }} style={{ background: 'none', border: 'none', color: THEME.textSub, padding: '4px', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>이메일 찾기</button>
            <span style={{ color: THEME.textHint, fontSize: '11px' }}>·</span>
            <button onClick={() => { setMode('forgot-password'); setError(''); setInfo('') }} style={{ background: 'none', border: 'none', color: THEME.textSub, padding: '4px', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>비밀번호 찾기</button>
          </div>
          <button style={S.btnSecondary} onClick={() => setMode('select')}>← 뒤로가기</button>
        </div>
      )}

      {mode === 'forgot-password' && (
        <div style={S.loginCard}>
          <div style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '10px' }}>
              <PTLogo size={42} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: '500', color: THEME.text, margin: '0 0 4px', letterSpacing: '-0.3px' }}>비밀번호 찾기</h2>
            <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>가입한 이메일로 재설정 링크를 보내드려요</p>
          </div>
          {error && <p style={{ color: THEME.danger, fontSize: '12px', textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
          {info && <p style={{ color: THEME.primary, fontSize: '12px', textAlign: 'center', margin: '0 0 8px', lineHeight: 1.5 }}>{info}</p>}
          <input style={S.input} type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendPasswordReset()} />
          <button style={S.btnPrimary} onClick={sendPasswordReset} disabled={loading}>{loading ? '발송 중...' : '재설정 메일 보내기'}</button>
          <button style={S.btnSecondary} onClick={() => { setMode('trainer'); setError(''); setInfo('') }}>← 뒤로가기</button>
        </div>
      )}

      {mode === 'forgot-email' && (
        <div style={S.loginCard}>
          <div style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '10px' }}>
              <PTLogo size={42} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: '500', color: THEME.text, margin: '0 0 4px', letterSpacing: '-0.3px' }}>이메일 찾기</h2>
            <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>가입 시 입력한 이름과 휴대폰 번호</p>
          </div>
          {error && <p style={{ color: THEME.danger, fontSize: '12px', textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
          {foundEmail && (
            <p style={{ color: THEME.primary, fontSize: '13px', textAlign: 'center', margin: '0 0 10px', padding: '10px', background: THEME.primaryLight, borderRadius: '8px', fontWeight: '500' }}>
              가입 이메일: {foundEmail}
            </p>
          )}
          <input style={S.input} type="text" placeholder="이름" value={findName} onChange={e => setFindName(e.target.value)} />
          <input style={S.input} type="tel" placeholder="휴대폰 (숫자만)" value={findPhone} onChange={e => setFindPhone(e.target.value.replace(/[^0-9]/g, ''))} maxLength={11} onKeyDown={e => e.key === 'Enter' && findEmail()} />
          <button style={S.btnPrimary} onClick={findEmail} disabled={loading}>{loading ? '조회 중...' : '이메일 찾기'}</button>
          <button style={S.btnSecondary} onClick={() => { setMode('trainer'); setError(''); setInfo(''); setFoundEmail('') }}>← 뒤로가기</button>
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