import React, { useEffect, useState } from 'react'
import { loadTossPayments } from '@tosspayments/payment-sdk'
import { supabase } from './supabase'
import {
  THEME,
  loadSubscription, summarizeSubscription,
  SUBSCRIPTION_PLANS, getPlanByCode,
  ADMIN_EMAIL,
} from './utils'
import useModalBackButton from './useModalBackButton'
import LegalModal from './LegalModal'
import CloseButton from './CloseButton'

const TOSS_CLIENT_KEY = process.env.REACT_APP_TOSS_CLIENT_KEY || ''
const TOSS_ENABLED = TOSS_CLIENT_KEY && !TOSS_CLIENT_KEY.includes('PLACEHOLDER')

// 인프라 월 비용 (KRW) — 실제 청구액 들어오면 여기 업데이트
const MONTHLY_COSTS = [
  { name: 'Supabase',   krw: 0,    note: 'Free (DB 500MB / Storage 1GB / 50K MAU)' },
  { name: 'Vercel',     krw: 0,    note: 'Hobby (100GB bandwidth)' },
  { name: 'Resend',     krw: 0,    note: 'Free (3,000 mails/월)' },
  { name: 'Sentry',     krw: 0,    note: 'Developer (5K errors/월)' },
  { name: 'Cloudflare', krw: 1300, note: '도메인 연 $12 ÷ 12' },
]
const TOTAL_MONTHLY_COST = MONTHLY_COSTS.reduce((s, c) => s + c.krw, 0)

// 무료 티어 한도 (DB·Storage 는 자동 측정, 나머지는 외부 대시보드 확인 링크 제공)
const TIER_LIMITS = {
  db_bytes:      500 * 1024 * 1024,        // Supabase Free DB 500MB
  storage_bytes: 1024 * 1024 * 1024,       // Supabase Free Storage 1GB
}

// 외부에서 확인 필요한 서비스들 — 한도 + 대시보드 URL
const EXTERNAL_USAGE = [
  { name: 'Supabase Egress',       limitText: '월 5 GB',     url: 'https://supabase.com/dashboard/project/_/usage' },
  { name: 'Supabase Edge Functions', limitText: '월 500K invocations', url: 'https://supabase.com/dashboard/project/_/functions' },
  { name: 'Vercel Bandwidth',      limitText: '월 100 GB',   url: 'https://vercel.com/dashboard/usage' },
  { name: 'Resend 이메일',         limitText: '월 3,000건',  url: 'https://resend.com/emails' },
  { name: 'Sentry Errors',         limitText: '월 5,000건',  url: 'https://sentry.io/organizations/_/stats/' },
]

const fmtKRW = (n) => '₩' + (n || 0).toLocaleString()
const fmtBytes = (b) => {
  if (b == null || b === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0; let v = Number(b)
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`
}
const PLAN_LABEL = { starter_10: 'Starter', standard_30: 'Standard', pro_unlimited: 'Pro' }
const STATUS_LABEL = { trial: '무료체험', active: '결제중', cancelled: '취소', expired: '만료', refunded: '환불' }

// 사용률 → 색상/상태
const pctState = (pct) => {
  if (pct >= 90) return { color: '#C25555', bg: '#FBE8E8', label: '⚠️ 업그레이드 권장' }
  if (pct >= 70) return { color: '#B88030', bg: '#FFF7E6', label: '주의' }
  return { color: THEME.primary, bg: THEME.primaryLight, label: '정상' }
}

// 구독 관리 모달
// - 현재 상태(trial / active / expired) + 사용 중인 플랜
// - 3개 플랜 비교 카드 (Starter / Standard / Pro) + 플랜 선택·변경
// - 환불 정책 보기
// - 환불 신청 (이메일 mailto, 운영자 수동 처리)
// - 구독 취소 (다음 결제 차단, status=cancelled)
export default function SubscriptionModal({ trainerId, trainerEmail, onClose }) {
  useModalBackButton(true, onClose)

  // ghost-click 가드 — 부모 모달의 row 클릭이 이 모달로 전파되어 즉시 닫히는 사고 방지
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 400)
    return () => clearTimeout(t)
  }, [])

  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [legalOpen, setLegalOpen] = useState(false)
  const [memberCount, setMemberCount] = useState(null)
  // 쿠폰 / 추천 코드 관련
  const [trainerInfo, setTrainerInfo] = useState({ referral_code: null })
  const [referralStats, setReferralStats] = useState({ pending: 0, awarded: 0 })
  const [couponInput, setCouponInput] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  // 마스터 쿠폰 발급 폼
  const [adminCouponOpen, setAdminCouponOpen] = useState(false)
  const [acDays, setAcDays] = useState(30)
  const [acTargetEmail, setAcTargetEmail] = useState('')
  const [acExpiresAt, setAcExpiresAt] = useState('')  // YYYY-MM-DD
  const [acNotes, setAcNotes] = useState('')
  const [acGenerated, setAcGenerated] = useState(null)
  const [acIssuing, setAcIssuing] = useState(false)

  // 마스터 운영 현황
  const [adminStats, setAdminStats] = useState(null)
  const [adminStatsLoading, setAdminStatsLoading] = useState(false)
  const [adminStatsError, setAdminStatsError] = useState(null)

  const reload = async () => {
    setLoading(true)
    const [s, { count }, tInfo, refStats] = await Promise.all([
      loadSubscription(trainerId),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('trainer_id', trainerId),
      supabase.from('trainers').select('referral_code').eq('id', trainerId).single(),
      supabase.from('referral_redemptions').select('status').eq('referrer_id', trainerId),
    ])
    setSub(s)
    setMemberCount(count || 0)
    setTrainerInfo(tInfo?.data || { referral_code: null })
    const rows = refStats?.data || []
    setReferralStats({
      pending: rows.filter(r => r.status === 'pending').length,
      awarded: rows.filter(r => r.status === 'awarded').length,
    })
    setLoading(false)
  }
  useEffect(() => { reload() /* eslint-disable-next-line */ }, [trainerId])

  // 마스터 — 운영 현황 로드 (모달 열릴 때 1회)
  const loadAdminStats = async () => {
    setAdminStatsLoading(true)
    setAdminStatsError(null)
    const { data, error } = await supabase.rpc('master_dashboard_stats')
    setAdminStatsLoading(false)
    if (error) { setAdminStatsError(error.message); return }
    setAdminStats(data)
  }
  useEffect(() => {
    if (trainerEmail === ADMIN_EMAIL) loadAdminStats()
    /* eslint-disable-next-line */
  }, [trainerEmail])

  const handleRedeemCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) { alert('쿠폰 코드를 입력해주세요.'); return }
    setRedeeming(true)
    const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code })
    setRedeeming(false)
    if (error) {
      const m = error.message || ''
      let msg
      if (m.includes('invalid_code')) msg = '존재하지 않는 쿠폰입니다.'
      else if (m.includes('already_used')) msg = '이미 사용된 쿠폰입니다.'
      else if (m.includes('coupon_expired')) msg = '만료된 쿠폰입니다.'
      else if (m.includes('email_mismatch')) msg = '이 쿠폰은 다른 이메일 전용입니다.'
      else if (m.includes('no_subscription_row')) msg = '구독 정보가 없습니다. 관리자에게 문의하세요.'
      else msg = '쿠폰 적용 실패: ' + m
      alert(msg)
      return
    }
    setCouponInput('')
    alert(`쿠폰이 적용됐어요. ${data?.duration_days || ''}일 연장 🎁`)
    reload()
  }

  const handleIssueCoupon = async () => {
    if (!acDays || acDays < 1) { alert('일수는 1 이상이어야 합니다.'); return }
    setAcIssuing(true)
    const { data, error } = await supabase.rpc('master_create_coupon', {
      p_type: 'free_month',
      p_duration_days: parseInt(acDays, 10),
      p_target_email: acTargetEmail.trim() || null,
      p_expires_at: acExpiresAt ? new Date(acExpiresAt + 'T23:59:59').toISOString() : null,
      p_notes: acNotes.trim() || null,
    })
    setAcIssuing(false)
    if (error) {
      alert('쿠폰 발급 실패: ' + (error.message || ''))
      return
    }
    setAcGenerated(data)
  }

  const copyAcCoupon = async () => {
    if (!acGenerated) return
    try {
      await navigator.clipboard.writeText(acGenerated)
      alert('쿠폰 코드가 복사됐어요.')
    } catch { alert(`코드: ${acGenerated}`) }
  }

  const closeAdminCoupon = () => {
    setAdminCouponOpen(false)
    setAcDays(30); setAcTargetEmail(''); setAcExpiresAt(''); setAcNotes(''); setAcGenerated(null)
  }

  const copyReferralCode = async () => {
    if (!trainerInfo?.referral_code) return
    const url = window.location.origin || 'https://pt-manager-v2.vercel.app'
    const text =
`💪 PT Manager 추천드려요!

회원 운동·식단·인바디·PT 스케줄을 한 곳에서 관리하는 트레이너 전용 서비스예요.
가입 시 30일 무료 체험 + 제 추천 코드 입력하면 +3일 추가!

🎁 내 추천 코드
${trainerInfo.referral_code}

🔗 가입 주소
${url}

[ 가입 방법 ]
1. 위 주소 접속 → "트레이너 회원가입"
2. 이름·이메일·비번 입력
3. "추천 코드 (선택)" 칸에 ${trainerInfo.referral_code} 입력
4. 가입 완료 + 인증 메일 클릭 → 33일 무료 체험 시작`
    try {
      await navigator.clipboard.writeText(text)
      alert('추천 안내문이 복사됐어요. 카톡에서 붙여넣기 해주세요!')
    } catch (e) {
      alert(`아래 내용을 복사해서 보내주세요!\n\n${text}`)
    }
  }

  const info = summarizeSubscription(sub, trainerEmail)
  const currentPlanCode = sub?.plan_code || 'starter_10'
  const isAdmin = info.state === 'admin'

  const stateConfig = {
    admin:    { bg: '#2D4A3E', color: '#FFF', icon: '★' },
    trial:    { bg: '#FFF7E6', color: '#8B6F2A', icon: '⏳' },
    active:   { bg: '#E6F4EB', color: THEME.primaryDark, icon: '✓' },
    expired:  { bg: THEME.dangerLight, color: THEME.dangerDark, icon: '!' },
    cancelled:{ bg: THEME.borderLight, color: THEME.textSub, icon: '×' },
  }
  const cfg = stateConfig[info.state] || stateConfig.expired

  // 플랜 선택 → 토스 결제 / 토스 비활성 시 plan_code 만 변경 (테스트키 등록 전 fallback)
  const handleSelectPlan = async (plan) => {
    if (plan.code === currentPlanCode && info.state === 'active') return

    // 토스 활성화: billingKey 발급용 결제창 띄우기 (정기결제)
    if (TOSS_ENABLED) {
      if (!window.confirm(`${plan.label} 플랜으로 구독을 시작합니다.\n\n· ₩${plan.amount.toLocaleString()}/월 · 매월 자동 결제\n· 다음 화면에서 카드를 등록하면 즉시 활성화됩니다.\n· 언제든 [구독 취소] 가능합니다.\n\n진행할까요?`)) return
      setWorking(true)
      try {
        const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
        const customerKey = trainerId  // 토스 customerKey 는 회원 unique id
        await tossPayments.requestBillingAuth('카드', {
          customerKey,
          successUrl: `${window.location.origin}/?toss=billing-success&plan=${plan.code}`,
          failUrl:    `${window.location.origin}/?toss=billing-fail`,
        })
        // 위 호출은 페이지 리다이렉트 — 이 아래 코드는 실행되지 않음
      } catch (e) {
        setWorking(false)
        alert('결제창 실패: ' + (e.message || e))
      }
      return
    }

    // 토스 비활성 (베타 테스트키 미입력) — plan_code 만 변경
    if (!window.confirm(`${plan.label} 플랜으로 변경할까요? (₩${plan.amount.toLocaleString()}/월)\n\n정식 결제 연동 전이라 plan_code 만 변경됩니다.`)) return
    setWorking(true)
    const { error } = await supabase
      .from('trainer_subscriptions')
      .update({
        plan_code: plan.code,
        plan_amount: plan.amount,
        member_limit: plan.memberLimit,
        updated_at: new Date().toISOString(),
      })
      .eq('trainer_id', trainerId)
    setWorking(false)
    if (error) { alert('플랜 변경 실패: ' + error.message); return }
    await reload()
  }

  // 환불 신청 → Edge Function 자동 처리 (7일 이내 + 보너스 회수)
  // 윈도우 지났거나 실패 시 운영자 이메일 fallback
  const openRefundMailto = () => {
    const body = encodeURIComponent(
      `안녕하세요.\n\n환불 신청합니다.\n\n` +
      `· 트레이너 ID: ${trainerId}\n` +
      `· 현재 플랜: ${info.plan.label} (₩${info.plan.amount.toLocaleString()})\n` +
      `· 상태: ${info.label}\n\n` +
      `환불 사유:\n(자유롭게 작성)\n\n감사합니다.`
    )
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=PT Manager 환불 신청&body=${body}`
  }

  const handleRefund = async () => {
    if (!window.confirm(
      '환불을 진행하시겠습니까?\n\n' +
      '· 최근 결제(7일 이내)의 금액만 자동 환불됩니다.\n' +
      '· 다음 자동결제는 즉시 중단됩니다.\n' +
      '· 받아둔 쿠폰·추천 보너스 일수는 유지되어 계속 사용 가능합니다.\n' +
      '· 7일이 지났거나 환불 가능 결제가 없으면 운영자 이메일로 안내됩니다.'
    )) return

    setWorking(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { alert('인증 만료 — 다시 로그인해주세요.'); setWorking(false); return }

      const resp = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/toss-refund-payment`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: '사용자 환불 요청' }),
        }
      )
      const result = await resp.json().catch(() => ({}))
      setWorking(false)

      if (result?.success) {
        const refundedAmt = result.refunded_amount?.toLocaleString?.() || result.refunded_amount || ''
        const kept = result.bonus_days_kept || 0
        const bonusMsg = kept > 0
          ? `\n\n남아있는 보너스: ${kept}일 (계속 사용 가능)`
          : ''
        alert(`환불이 완료되었습니다.\n· 환불 금액: ₩${refundedAmt}${bonusMsg}`)
        await reload()
        return
      }

      // 실패 케이스별 안내
      const code = result?.code || ''
      if (code === 'out_of_window' || code === 'no_payment' || code === 'no_payment_key' || code === 'already_refunded') {
        const msg = result.message || '자동 환불 불가'
        if (window.confirm(`${msg}\n\n운영자 이메일로 환불 신청하시겠습니까?`)) {
          openRefundMailto()
        }
        return
      }

      alert('환불 처리 실패: ' + (result?.message || '알 수 없는 오류'))
    } catch (e) {
      setWorking(false)
      if (window.confirm(`자동 환불 처리 중 오류가 발생했어요.\n${e?.message || ''}\n\n운영자 이메일로 진행하시겠습니까?`)) {
        openRefundMailto()
      }
    }
  }

  // 구독 취소 — 다음 결제 막음 (status=cancelled). 현재 만료일까지는 사용 가능.
  const handleCancel = async () => {
    if (!window.confirm('정말 구독을 취소하시겠습니까?\n\n· 현재 만료일까지는 그대로 사용 가능합니다.\n· 다음 결제가 자동으로 발생하지 않습니다.\n· 환불을 원하시면 [환불 신청] 을 이용해주세요.')) return
    setWorking(true)
    const { error } = await supabase
      .from('trainer_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('trainer_id', trainerId)
    setWorking(false)
    if (error) { alert('취소 실패: ' + error.message); return }
    alert('구독이 취소됐습니다. 현재 만료일까지는 정상 사용 가능합니다.')
    await reload()
  }

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 1700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        pointerEvents: armed ? 'auto' : 'none',
      }}>
        <div style={{
          background: '#FFF', borderRadius: '14px',
          width: '100%', maxWidth: '420px', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box',
          pointerEvents: 'auto',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px', borderBottom: `0.5px solid ${THEME.border}`, flexShrink: 0,
          }}>
            <p style={{ fontSize: '14px', fontWeight: '500', color: THEME.primary, margin: 0 }}>구독 관리</p>
            <CloseButton onClick={onClose} />
          </div>

          <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <p style={{ fontSize: '12px', color: THEME.textHint, textAlign: 'center', padding: '20px 0' }}>로딩 중…</p>
            ) : (
              <>
                {/* 현재 상태 */}
                <div style={{
                  background: cfg.bg, borderRadius: '12px', padding: '12px',
                  textAlign: 'center', marginBottom: '12px',
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{cfg.icon}</div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: cfg.color, margin: '0 0 3px' }}>
                    {info.state === 'cancelled' ? `취소됨 · ${info.plan.label}` : info.label}
                  </p>
                  {info.expiresAt && (
                    <p style={{ fontSize: '11px', color: cfg.color, opacity: 0.8, margin: '0 0 3px' }}>
                      만료일: {info.expiresAt.toISOString().slice(0, 10).replace(/-/g, '.')}
                    </p>
                  )}
                  {memberCount != null && (
                    <p style={{ fontSize: '11px', color: cfg.color, opacity: 0.75, margin: 0 }}>
                      회원 {memberCount}명{info.plan.memberLimit != null ? ` / ${info.plan.memberLimit}명` : ' / 무제한'}
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <>
                    <p style={{ fontSize: '11px', color: THEME.textSub, textAlign: 'center', margin: '0 0 10px', lineHeight: 1.5 }}>
                      운영자(마스터) 계정 — 구독·회원 한도 검사가 적용되지 않습니다.
                    </p>

                    {/* 운영 현황 대시보드 */}
                    <AdminDashboard
                      stats={adminStats}
                      loading={adminStatsLoading}
                      error={adminStatsError}
                      onReload={loadAdminStats}
                    />

                    <button
                      onClick={() => setAdminCouponOpen(true)}
                      style={{
                        width: '100%', background: '#2D4A3E', color: '#FFF',
                        border: 'none', padding: '11px', borderRadius: '8px',
                        fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                        fontFamily: 'inherit', marginBottom: '14px',
                      }}
                    >🎟️ 쿠폰 발급 (마스터 전용)</button>
                  </>
                )}

                {/* 플랜 3개 카드 — 마스터는 숨김 */}
                {!isAdmin && (<>
                <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '0 0 6px' }}>플랜 선택</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {SUBSCRIPTION_PLANS.map(plan => {
                    const isCurrent = plan.code === currentPlanCode
                    return (
                      <button
                        key={plan.code}
                        onClick={() => handleSelectPlan(plan)}
                        disabled={working}
                        style={{
                          background: isCurrent ? '#E6F4EB' : '#FFF',
                          border: `0.5px solid ${isCurrent ? THEME.primary : THEME.primaryAccent}`,
                          borderRadius: '10px', padding: '12px 14px',
                          cursor: working || isCurrent ? 'default' : 'pointer',
                          textAlign: 'left', fontFamily: 'inherit',
                          opacity: working ? 0.7 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: isCurrent ? THEME.primaryDark : THEME.text }}>
                            {plan.label}{isCurrent && ' · 사용 중'}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: THEME.primary }}>
                            ₩{plan.amount.toLocaleString()}<span style={{ fontSize: '10px', color: THEME.textSub, fontWeight: '400' }}>/월</span>
                          </span>
                        </div>
                        <p style={{ fontSize: '11px', color: THEME.textSub, margin: 0 }}>{plan.desc}</p>
                      </button>
                    )
                  })}
                </div>
                </>)}

                {/* 쿠폰 / 추천 코드 — 마스터(admin) 는 의미 X 라 숨김 */}
                {!isAdmin && (
                  <div style={{ background: THEME.cardAlt, borderRadius: '10px', padding: '12px', marginBottom: '10px', border: `0.5px solid ${THEME.border}` }}>
                    {/* 쿠폰 사용 */}
                    <div style={{ marginBottom: trainerInfo.referral_code ? '12px' : 0 }}>
                      <p style={{ fontSize: '11px', fontWeight: '500', color: THEME.text, margin: '0 0 6px' }}>🎟️ 쿠폰 코드 사용</p>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          value={couponInput}
                          onChange={e => setCouponInput(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ''))}
                          placeholder="예: PT2605-X3K9"
                          maxLength={20}
                          style={{
                            flex: 1, padding: '7px 10px', borderRadius: '6px',
                            border: `0.5px solid ${THEME.border}`, fontSize: '12px',
                            fontFamily: 'inherit', outline: 'none', background: '#FFF', color: THEME.text,
                          }}
                        />
                        <button
                          onClick={handleRedeemCoupon}
                          disabled={redeeming || !couponInput.trim()}
                          style={{
                            background: couponInput.trim() ? THEME.primary : THEME.borderLight,
                            color: couponInput.trim() ? '#FFF' : THEME.textHint,
                            border: 'none', padding: '7px 14px', borderRadius: '6px',
                            fontSize: '11px', fontWeight: '500',
                            cursor: redeeming ? 'wait' : (couponInput.trim() ? 'pointer' : 'not-allowed'),
                            fontFamily: 'inherit', whiteSpace: 'nowrap',
                          }}
                        >{redeeming ? '적용 중…' : '적용'}</button>
                      </div>
                    </div>

                    {/* 본인 추천 코드 */}
                    {trainerInfo.referral_code && (
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: '500', color: THEME.text, margin: '0 0 6px' }}>📣 내 추천 코드</p>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <div style={{
                            flex: 1, padding: '7px 10px', borderRadius: '6px',
                            background: THEME.primaryLight, border: `0.5px solid ${THEME.primaryAccent}`,
                            fontSize: '13px', fontWeight: '500', color: THEME.primaryDark,
                            letterSpacing: '1px', textAlign: 'center',
                          }}>{trainerInfo.referral_code}</div>
                          <button
                            onClick={copyReferralCode}
                            style={{
                              background: THEME.primary, color: '#FFF',
                              border: 'none', padding: '7px 14px', borderRadius: '6px',
                              fontSize: '11px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                            }}
                          >복사하기</button>
                        </div>
                        <p style={{ fontSize: '10px', color: THEME.textSub, margin: '6px 0 0', lineHeight: 1.5 }}>
                          친구가 이 코드로 가입 + 첫 결제 시 <b style={{ color: THEME.primary }}>+7일</b> 추가돼요
                          {(referralStats.awarded > 0 || referralStats.pending > 0) && (
                            <> · 추천 현황: <b>완료 {referralStats.awarded}</b> / 대기 {referralStats.pending}</>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 관리 버튼들 — 마스터는 환불 정책만 노출 */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setLegalOpen(true)}
                    style={{
                      flex: 1, minWidth: '100px',
                      background: '#FFF', border: `0.5px solid ${THEME.border}`,
                      color: THEME.text, padding: '9px', borderRadius: '8px',
                      fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >환불 정책</button>
                  {(info.state === 'active' || info.state === 'trial') && (
                    <button
                      onClick={handleRefund}
                      style={{
                        flex: 1, minWidth: '100px',
                        background: THEME.warningLight, border: `0.5px solid ${THEME.warning}`,
                        color: THEME.warningDark, padding: '9px', borderRadius: '8px',
                        fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '500',
                      }}
                    >환불 신청</button>
                  )}
                  {info.state === 'active' && (
                    <button
                      onClick={handleCancel}
                      disabled={working}
                      style={{
                        flex: 1, minWidth: '100px',
                        background: '#FFF', border: `0.5px solid ${THEME.danger}`,
                        color: THEME.danger, padding: '9px', borderRadius: '8px',
                        fontSize: '11px', cursor: working ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: '500',
                      }}
                    >구독 취소</button>
                  )}
                </div>

                {!isAdmin && (
                  <p style={{ fontSize: '10px', color: THEME.textHint, textAlign: 'center', margin: '8px 0 0', lineHeight: 1.5 }}>
                    정식 결제 시스템은 사업자 등록·토스페이먼츠 가맹점 가입 완료 후 오픈됩니다.<br/>
                    베타 기간 동안 무료 체험이 유지됩니다.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {legalOpen && <LegalModal kind="refund" onClose={() => setLegalOpen(false)} />}

      {/* 마스터 전용 쿠폰 발급 다이얼로그 */}
      {adminCouponOpen && (
        <div
          onClick={closeAdminCoupon}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 14, padding: 18, width: '100%', maxWidth: 380, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: THEME.primary, margin: 0 }}>🎟️ 쿠폰 발급</p>
              <CloseButton onClick={closeAdminCoupon} />
            </div>

            {!acGenerated ? (
              <>
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: THEME.textSub, margin: '0 0 4px', fontWeight: 500 }}>기간 (일)</p>
                  <input
                    type="number" min="1" max="365"
                    value={acDays}
                    onChange={e => setAcDays(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `0.5px solid ${THEME.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: THEME.textSub, margin: '0 0 4px', fontWeight: 500 }}>이메일 잠금 (선택)</p>
                  <input
                    type="email"
                    value={acTargetEmail}
                    onChange={e => setAcTargetEmail(e.target.value)}
                    placeholder="비워두면 누구나 사용 가능"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `0.5px solid ${THEME.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: THEME.textSub, margin: '0 0 4px', fontWeight: 500 }}>쿠폰 만료일 (선택)</p>
                  <input
                    type="date"
                    value={acExpiresAt}
                    onChange={e => setAcExpiresAt(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `0.5px solid ${THEME.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: THEME.textSub, margin: '0 0 4px', fontWeight: 500 }}>메모 (선택)</p>
                  <input
                    type="text"
                    value={acNotes}
                    onChange={e => setAcNotes(e.target.value)}
                    placeholder="예: 5월 베타 이벤트 - 김OO"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `0.5px solid ${THEME.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  onClick={handleIssueCoupon}
                  disabled={acIssuing}
                  style={{ width: '100%', background: THEME.primary, color: '#FFF', border: 'none', padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: acIssuing ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                >{acIssuing ? '발급 중…' : '쿠폰 발급'}</button>
              </>
            ) : (
              <>
                <div style={{ background: THEME.primaryLight, border: `0.5px solid ${THEME.primaryAccent}`, borderRadius: 10, padding: 16, textAlign: 'center', marginBottom: 12 }}>
                  <p style={{ fontSize: 10, color: THEME.textSub, margin: '0 0 4px' }}>발급된 쿠폰 코드</p>
                  <p style={{ fontSize: 22, fontWeight: 600, color: THEME.primaryDark, letterSpacing: '2px', margin: '0 0 4px' }}>{acGenerated}</p>
                  <p style={{ fontSize: 10, color: THEME.textSub, margin: 0 }}>{acDays}일 무료 체험 연장</p>
                </div>
                <button
                  onClick={copyAcCoupon}
                  style={{ width: '100%', background: THEME.primary, color: '#FFF', border: 'none', padding: 11, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6 }}
                >코드 복사</button>
                <button
                  onClick={() => { setAcGenerated(null); setAcNotes('') }}
                  style={{ width: '100%', background: '#FFF', color: THEME.text, border: `0.5px solid ${THEME.border}`, padding: 11, borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >+ 하나 더 발급</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── 마스터 운영 현황 대시보드 ─────────────────────────────
function AdminDashboard({ stats, loading, error, onReload }) {
  const cardBg = '#F8F7F0'
  const sectionBg = '#FFF'
  const border = `0.5px solid ${THEME.border}`

  if (loading) {
    return (
      <div style={{ background: cardBg, border, borderRadius: 10, padding: 14, marginBottom: 12, textAlign: 'center', fontSize: 11, color: THEME.textHint }}>
        운영 현황 로드 중…
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ background: cardBg, border, borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 11, color: THEME.danger }}>
        운영 현황 조회 실패: {error}
        <button onClick={onReload} style={{ marginLeft: 8, fontSize: 10, background: 'transparent', border: `0.5px solid ${THEME.border}`, padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>재시도</button>
      </div>
    )
  }
  if (!stats) return null

  const revMonth = stats.revenue_month || 0
  const revTotal = stats.revenue_total || 0
  const refMonth = stats.refunded_month || 0
  const refTotal = stats.refunded_total || 0
  const netMonth = revMonth - refMonth - TOTAL_MONTHLY_COST
  const netTotal = revTotal - refTotal  // 누적은 비용은 알 수 없어 매출-환불만

  const trainerStatus = stats.trainer_by_status || {}
  const trainerPlan = stats.trainer_by_plan || {}

  const SectionHeader = ({ children }) => (
    <p style={{ fontSize: 10, fontWeight: 500, color: THEME.textSub, margin: '0 0 6px', letterSpacing: '-0.2px' }}>{children}</p>
  )
  const Row = ({ label, value, accent }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0', fontSize: 11 }}>
      <span style={{ color: THEME.textSub }}>{label}</span>
      <span style={{ color: accent || THEME.text, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
  const SubCard = ({ children, title }) => (
    <div style={{ background: sectionBg, border, borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
      {title && <SectionHeader>{title}</SectionHeader>}
      {children}
    </div>
  )

  // 진행률 바 — DB / Storage 사용률
  const UsageBar = ({ label, used, limit, fmt }) => {
    const pct = Math.min(100, Math.round((used / limit) * 1000) / 10)  // 0.1% 정밀도
    const state = pctState(pct)
    return (
      <div style={{ padding: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11 }}>
          <span style={{ color: THEME.textSub }}>{label}</span>
          <span style={{ color: state.color, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(used)} / {fmt(limit)} · {pct}%
          </span>
        </div>
        <div style={{ height: 6, background: THEME.borderLight, borderRadius: 3, marginTop: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: state.color, transition: 'width 0.3s' }} />
        </div>
        {pct >= 70 && (
          <p style={{ fontSize: 9, color: state.color, margin: '3px 0 0', fontWeight: 500 }}>
            {state.label}
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: cardBg, border, borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: THEME.primaryDark, margin: 0 }}>📊 운영 현황</p>
        <button onClick={onReload} style={{ fontSize: 10, background: 'transparent', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>새로고침</button>
      </div>

      {/* 트레이너 & 회원 */}
      <SubCard title="트레이너 · 회원">
        <Row label="총 트레이너" value={`${stats.trainer_total || 0}명`} />
        {Object.entries(trainerStatus).map(([s, c]) => (
          <Row key={s} label={`└ ${STATUS_LABEL[s] || s}`} value={`${c}명`} />
        ))}
        <Row label="총 회원" value={`${stats.member_total || 0}명`} />
      </SubCard>

      {/* 플랜 분포 (결제중 트레이너만) */}
      {Object.keys(trainerPlan).length > 0 && (
        <SubCard title="결제중 플랜 분포">
          {Object.entries(trainerPlan).map(([code, c]) => (
            <Row key={code} label={PLAN_LABEL[code] || code} value={`${c}명`} />
          ))}
        </SubCard>
      )}

      {/* 매출 / 환불 */}
      <SubCard title="매출 · 환불">
        <Row label="이번 달 매출" value={fmtKRW(revMonth)} accent={THEME.primary} />
        <Row label="이번 달 환불" value={fmtKRW(refMonth)} accent={refMonth > 0 ? THEME.danger : THEME.text} />
        <Row label="누적 매출" value={fmtKRW(revTotal)} />
        <Row label="누적 환불" value={fmtKRW(refTotal)} />
      </SubCard>

      {/* 인프라 비용 (월) */}
      <SubCard title={`인프라 월 비용 (합계 ${fmtKRW(TOTAL_MONTHLY_COST)})`}>
        {MONTHLY_COSTS.map(c => (
          <div key={c.name} style={{ padding: '3px 0', fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: THEME.textSub }}>{c.name}</span>
              <span style={{ color: c.krw > 0 ? THEME.text : THEME.textHint, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmtKRW(c.krw)}</span>
            </div>
            <p style={{ fontSize: 9, color: THEME.textHint, margin: '1px 0 0', lineHeight: 1.4 }}>{c.note}</p>
          </div>
        ))}
      </SubCard>

      {/* 순수익 */}
      <SubCard title="순수익">
        <Row
          label="이번 달 (매출 − 환불 − 비용)"
          value={fmtKRW(netMonth)}
          accent={netMonth >= 0 ? THEME.primary : THEME.danger}
        />
        <Row
          label="누적 (매출 − 환불)"
          value={fmtKRW(netTotal)}
          accent={netTotal >= 0 ? THEME.primary : THEME.danger}
        />
      </SubCard>

      {/* 데이터 사용량 — DB / Storage 자동 측정 + 진행률 바 */}
      <SubCard title="데이터 사용량 (Supabase Free Tier)">
        <UsageBar label="DB" used={stats.db_size_bytes || 0} limit={TIER_LIMITS.db_bytes} fmt={fmtBytes} />
        <UsageBar label="Storage" used={stats.storage_bytes || 0} limit={TIER_LIMITS.storage_bytes} fmt={fmtBytes} />
        <div style={{ borderTop: `0.5px dashed ${THEME.border}`, margin: '8px 0 6px' }} />
        <Row label="운동 로그" value={`${(stats.workout_log_count || 0).toLocaleString()}건`} />
        <Row label="식단 로그" value={`${(stats.diet_log_count || 0).toLocaleString()}건`} />
        <Row label="PT 세션" value={`${(stats.class_session_count || 0).toLocaleString()}건`} />
      </SubCard>

      {/* 외부 서비스 사용량 — 외부 대시보드 링크 */}
      <SubCard title="외부 서비스 (대시보드에서 직접 확인)">
        {EXTERNAL_USAGE.map(s => (
          <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 11 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: THEME.text }}>{s.name}</div>
              <div style={{ color: THEME.textHint, fontSize: 9 }}>한도 {s.limitText}</div>
            </div>
            <a href={s.url} target="_blank" rel="noreferrer"
              style={{ fontSize: 10, color: THEME.primary, textDecoration: 'none', border: `0.5px solid ${THEME.primaryAccent}`, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
              확인 →
            </a>
          </div>
        ))}
        <p style={{ fontSize: 9, color: THEME.textHint, margin: '6px 2px 0', lineHeight: 1.5 }}>
          외부 서비스는 자체 대시보드에서만 정확한 사용량 확인 가능.
          ≥80% 도달 시 알림 메일이 각 서비스 등록 이메일로 발송됨.
        </p>
      </SubCard>

      {stats.generated_at && (
        <p style={{ fontSize: 9, color: THEME.textHint, textAlign: 'right', margin: '4px 2px 0' }}>
          기준: {new Date(stats.generated_at).toLocaleString('ko-KR')}
        </p>
      )}
    </div>
  )
}
