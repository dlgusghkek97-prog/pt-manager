import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { THEME, S, ADMIN_EMAIL, isAdminEmail } from './utils'

// 구독 만료 시 화면 접근 차단.
// 트레이너: 본인 구독이 expired/cancelled+만료 → 결제 안내 화면만 노출
// 회원: 담당 트레이너의 구독이 expired 면 → 동일 차단 (회원 본인 결제 불가능, 트레이너에게 문의)
// 마스터 (ADMIN_EMAIL) 는 항상 통과.
//
// 사용:
//   <SubscriptionGate user={user} userType="trainer|member" onOpenPay={() => setShowSubscription(true)}>
//     <대시보드 내용>
//   </SubscriptionGate>
export default function SubscriptionGate({ user, userType, onOpenPay, onLogout, refreshKey = 0, children }) {
  const [state, setState] = useState({ loading: true, active: true, info: null })

  useEffect(() => {
    if (!user) return
    let alive = true

    const check = async () => {
      // 마스터 우회 — 클라이언트 빠른 패스 (서버는 is_admin_trainer 가 막아줌)
      if (userType === 'trainer' && isAdminEmail(user.email)) {
        if (alive) setState({ loading: false, active: true, info: { state: 'admin' } })
        return
      }

      // 검사 대상 trainer_id 결정
      const trainerId = userType === 'trainer' ? user.id : user.trainer_id
      if (!trainerId) {
        if (alive) setState({ loading: false, active: true, info: null })
        return
      }

      const { data, error } = await supabase
        .from('trainer_subscriptions')
        .select('status, trial_expires_at, paid_expires_at, plan_code')
        .eq('trainer_id', trainerId)
        .maybeSingle()

      if (!alive) return
      if (error) {
        console.error('[SubscriptionGate]', error)
        // 에러는 일단 통과 — 사용자 차단보다 가시성 우선
        setState({ loading: false, active: true, info: null })
        return
      }
      if (!data) {
        // 구독 row 없음 → 신규/오래된 트레이너. 차단.
        setState({ loading: false, active: false, info: { state: 'none' } })
        return
      }

      const now = Date.now()
      const trialEnd = data.trial_expires_at ? Date.parse(data.trial_expires_at) : 0
      const paidEnd  = data.paid_expires_at  ? Date.parse(data.paid_expires_at)  : 0
      const isActive = (
        (data.status === 'trial'  && trialEnd > now) ||
        (data.status === 'active' && paidEnd  > now)
      )
      setState({
        loading: false,
        active: !!isActive,
        info: { state: data.status, trialEnd, paidEnd },
      })
    }

    check()
    return () => { alive = false }
    // refreshKey 갱신으로 결제 후 즉시 재검사
  }, [user, userType, refreshKey])

  if (state.loading) {
    return (
      <div style={{ ...S.container, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ fontSize: '13px', color: THEME.textSub }}>구독 상태 확인 중…</p>
      </div>
    )
  }

  if (state.active) return children

  // 차단 화면
  const isTrainer = userType === 'trainer'
  return (
    <div style={{ ...S.container, padding: '40px 16px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', background: '#FFF', borderRadius: '16px', padding: '28px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🔒</div>
          <h2 style={{ fontSize: '17px', fontWeight: '500', color: THEME.text, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
            {isTrainer ? '구독이 만료됐어요' : '담당 트레이너의 구독이 만료됐어요'}
          </h2>
          <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0, lineHeight: 1.6 }}>
            {isTrainer
              ? '구독을 결제하면 회원 관리·기록·통계 모든 기능이 즉시 활성화됩니다.'
              : '운동·식단·인바디 등 모든 데이터 열람이 일시적으로 제한됩니다. 담당 트레이너에게 구독 갱신을 요청해주세요.'}
          </p>
        </div>

        {isTrainer ? (
          <>
            <button
              onClick={onOpenPay}
              style={{
                width: '100%', padding: '13px', borderRadius: '12px',
                background: THEME.primary, color: '#FFF', border: 'none',
                fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                fontFamily: 'inherit', marginBottom: '10px',
              }}
            >구독 결제하기</button>
            <div style={{ background: THEME.cardAlt, borderRadius: '10px', padding: '12px', marginTop: '10px' }}>
              <p style={{ fontSize: '11px', color: THEME.textSub, margin: '0 0 4px', fontWeight: '500' }}>플랜 안내</p>
              <p style={{ fontSize: '10px', color: THEME.textHint, margin: 0, lineHeight: 1.6 }}>
                Starter ₩9,900/월 · 회원 10명<br/>
                Standard ₩19,900/월 · 회원 30명<br/>
                Pro ₩39,900/월 · 회원 무제한
              </p>
            </div>
            <p style={{ fontSize: '10px', color: THEME.textHint, textAlign: 'center', margin: '14px 0 0', lineHeight: 1.6 }}>
              문의: {ADMIN_EMAIL}
            </p>
          </>
        ) : (
          <div style={{ background: THEME.cardAlt, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: THEME.textSub, margin: 0, lineHeight: 1.7 }}>
              차단된 기능: 운동 기록 / 식단 기록 / 통계 / 인바디 / 채팅<br/>
              트레이너가 결제하면 즉시 복구됩니다.
            </p>
          </div>
        )}

        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              width: '100%', marginTop: '14px', padding: '11px',
              background: '#FFF', color: THEME.textSub, border: `0.5px solid ${THEME.border}`,
              borderRadius: '10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >로그아웃</button>
        )}
      </div>
    </div>
  )
}
