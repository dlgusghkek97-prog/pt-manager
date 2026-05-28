// Supabase Edge Function — 환불 자동 처리
//
// 호출 흐름:
//   1. 클라(SubscriptionModal) 에서 [환불 신청] 클릭 → 7일 정책 안내 confirm
//   2. POST { reason? } (Authorization 헤더에 user JWT)
//   3. 이 함수:
//      a) 인증된 trainer 의 trainer_billing_history 에서 status='success' 가장 최근 row 조회
//      b) 결제일이 7일 이내인지 검증
//      c) 토스 /v1/payments/{paymentKey}/cancel 호출
//      d) 성공 시:
//         - trainer_billing_history INSERT (status='refunded', 원본 payment_key 참조)
//         - refund_revoke_bonuses RPC 호출 → 추천/쿠폰 보너스 회수
//         - trainer_subscriptions UPDATE (status='cancelled', paid_expires_at=now)
//      e) 결과 JSON 반환
//
// 배포: supabase functions deploy toss-refund-payment
// 시크릿: TOSS_SECRET_KEY (toss-issue-billing 과 동일)
//
// 인증: Supabase Auth JWT 검증. trainer 본인만 자기 결제 환불 가능.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOSS_SECRET  = Deno.env.get('TOSS_SECRET_KEY')!

const REFUND_WINDOW_DAYS = 7
const tossAuth = () => 'Basic ' + btoa(TOSS_SECRET + ':')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('method', { status: 405, headers: CORS })

  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    if (!TOSS_SECRET) throw new Error('TOSS_SECRET_KEY 미설정')

    // ─── 1) 인증 ───
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('인증 실패')

    const body = await req.json().catch(() => ({}))
    const reason: string = body?.reason || '사용자 환불 요청'

    // service role client (RLS 우회)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // ─── 2) 최근 성공 결제 조회 ───
    const { data: lastPayment, error: histErr } = await admin
      .from('trainer_billing_history')
      .select('id, amount, plan_code, toss_payment_key, toss_order_id, created_at')
      .eq('trainer_id', user.id)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (histErr) throw new Error('결제 내역 조회 실패: ' + histErr.message)
    if (!lastPayment) return json({ success: false, code: 'no_payment', message: '환불 가능한 결제 내역이 없습니다.' }, 400)
    if (!lastPayment.toss_payment_key) return json({ success: false, code: 'no_payment_key', message: '결제 키 누락 — 운영자에게 문의하세요.' }, 400)

    // ─── 3) 7일 정책 검증 ───
    const paidAt = new Date(lastPayment.created_at)
    const elapsedDays = (Date.now() - paidAt.getTime()) / (1000 * 60 * 60 * 24)
    if (elapsedDays > REFUND_WINDOW_DAYS) {
      return json({
        success: false,
        code: 'out_of_window',
        message: `환불 가능 기간(${REFUND_WINDOW_DAYS}일) 이 지났습니다. 1:1 카카오톡으로 문의해주세요.`,
        paid_at: lastPayment.created_at,
        elapsed_days: Math.floor(elapsedDays),
      }, 400)
    }

    // ─── 4) 이미 환불된 결제인지 확인 ───
    const { data: existingRefund } = await admin
      .from('trainer_billing_history')
      .select('id')
      .eq('trainer_id', user.id)
      .eq('status', 'refunded')
      .eq('toss_payment_key', lastPayment.toss_payment_key)
      .maybeSingle()

    if (existingRefund) {
      return json({ success: false, code: 'already_refunded', message: '이미 환불 처리된 결제입니다.' }, 400)
    }

    // ─── 5) 토스 환불 API ───
    const res = await fetch(`https://api.tosspayments.com/v1/payments/${lastPayment.toss_payment_key}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': tossAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancelReason: reason }),
    })
    const tossData = await res.json()

    if (!res.ok) {
      return json({
        success: false,
        code: tossData.code || 'toss_error',
        message: tossData.message || '토스 환불 처리 실패',
      }, 400)
    }

    const now = new Date()

    // ─── 6) 환불 이력 기록 ───
    await admin.from('trainer_billing_history').insert({
      trainer_id: user.id,
      status: 'refunded',
      amount: -lastPayment.amount,
      plan_code: lastPayment.plan_code,
      toss_payment_key: lastPayment.toss_payment_key,
      toss_order_id: lastPayment.toss_order_id,
      receipt_url: tossData.receipt?.url || null,
    })

    // ─── 7) 추천인 보너스 회수 ───
    // refundee 의 결제로 인해 referrer 가 받은 보너스는 결제가 reversed 됐으므로 회수.
    // (refundee 자신의 쿠폰·받은 추천 보너스는 유지 — 사용자 친화적 정책)
    let referrerRevoked: any = null
    try {
      const { data, error } = await admin.rpc('revoke_referrer_bonus_on_refund', {
        p_referee_id: user.id,
      })
      if (error) {
        console.warn('[revoke_referrer_bonus_on_refund]', error.message)
        referrerRevoked = { error: error.message }
      } else {
        referrerRevoked = data
      }
    } catch (e) {
      console.warn('[revoke_referrer_bonus_on_refund exception]', (e as Error).message)
      referrerRevoked = { error: (e as Error).message }
    }

    // ─── 8) 구독 상태 업데이트 ───
    // 보너스 모델: refundee 의 bonus_days_pending 은 그대로 유지 (자신이 받은 보너스).
    // paid_expires_at 만 즉시 now 로 만들고, bonus 가 있다면 cron 이 bonus 를 paid 로 흡수해서 사용 가능.
    // 다음 자동결제는 막음 (status='cancelled' + next_billing_at=null).
    const { data: subBefore } = await admin
      .from('trainer_subscriptions')
      .select('bonus_days_pending')
      .eq('trainer_id', user.id)
      .maybeSingle()
    const bonusKept = Math.max(0, parseInt(subBefore?.bonus_days_pending) || 0)

    await admin
      .from('trainer_subscriptions')
      .update({
        status: 'cancelled',
        paid_expires_at: now.toISOString(),
        next_billing_at: null,
        cancelled_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('trainer_id', user.id)

    return json({
      success: true,
      refunded_amount: lastPayment.amount,
      paid_at: lastPayment.created_at,
      bonus_days_kept: bonusKept,           // 환불 후 사용자가 계속 쓸 수 있는 보너스 일수
      referrer_bonus_revoked: referrerRevoked,  // 추천인에게서 회수한 보너스 정보 (감사용)
    })
  } catch (e) {
    const msg = (e as Error).message || 'unknown'
    console.error('[toss-refund-payment]', msg)
    return json({ success: false, code: 'exception', message: msg }, 500)
  }
})
