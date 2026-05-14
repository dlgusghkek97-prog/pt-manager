// Supabase Edge Function — 토스페이먼츠 빌링키 발급 + 첫 결제
//
// 호출 흐름:
//   1. 클라가 SubscriptionModal 에서 toss.requestBillingAuth → 카드 등록 결제창
//   2. 성공 시 successUrl?authKey=...&customerKey=... 로 리다이렉트
//   3. App.js 의 redirect 핸들러가 이 함수 호출 (POST {authKey, customerKey, plan})
//   4. 이 함수: 토스 /v1/billing/authorizations/issue → billingKey 발급
//   5. 받은 billingKey 로 즉시 첫 결제 → /v1/billing/{billingKey}
//   6. 성공 시 trainer_subscriptions 업데이트 + trainer_billing_history INSERT
//
// 배포:
//   supabase functions deploy toss-issue-billing
// 시크릿:
//   supabase secrets set TOSS_SECRET_KEY=test_sk_... (또는 live_sk_...)
//
// CORS 처리 포함. 인증은 Supabase Auth JWT 검증 (호출자가 본인 trainer_id 만 처리 가능)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TOSS_API = 'https://api.tosspayments.com/v1/billing'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOSS_SECRET  = Deno.env.get('TOSS_SECRET_KEY')!  // 가맹 가입 후 채워야 함

// 플랜별 금액 매핑 (서버 측 검증용)
const PLAN_AMOUNTS: Record<string, { amount: number; member_limit: number | null }> = {
  starter_10:    { amount: 9900,  member_limit: 10 },
  standard_30:   { amount: 19900, member_limit: 30 },
  pro_unlimited: { amount: 39900, member_limit: null },
}

const tossAuth = () => 'Basic ' + btoa(TOSS_SECRET + ':')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('method', { status: 405, headers: CORS })

  try {
    if (!TOSS_SECRET) throw new Error('TOSS_SECRET_KEY 미설정')

    // 호출자 인증
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('인증 실패')

    const { authKey, customerKey, plan } = await req.json()
    if (!authKey || !customerKey || !plan) throw new Error('필수 인자 누락')
    if (customerKey !== user.id) throw new Error('customerKey 가 본인 id 와 다름')

    const planInfo = PLAN_AMOUNTS[plan]
    if (!planInfo) throw new Error('유효하지 않은 플랜')

    // 1. 빌링키 발급
    const issueRes = await fetch(`${TOSS_API}/authorizations/issue`, {
      method: 'POST',
      headers: { 'Authorization': tossAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ authKey, customerKey }),
    })
    const issueData = await issueRes.json()
    if (!issueRes.ok) throw new Error(`빌링키 발급 실패: ${issueData.message}`)
    const billingKey = issueData.billingKey
    const cardNumber = issueData.card?.number || ''

    // 2. 즉시 첫 결제 (이번 달분)
    const orderId = `pt-${user.id.slice(0, 8)}-${Date.now()}`
    const chargeRes = await fetch(`${TOSS_API}/${billingKey}`, {
      method: 'POST',
      headers: { 'Authorization': tossAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerKey,
        amount: planInfo.amount,
        orderId,
        orderName: `PT Manager 구독 · ${plan}`,
        customerEmail: user.email,
      }),
    })
    const chargeData = await chargeRes.json()

    // 3. service_role 로 DB 업데이트
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const now = new Date()
    const expiresAt = new Date(now); expiresAt.setMonth(expiresAt.getMonth() + 1)

    if (chargeRes.ok) {
      await admin.from('trainer_subscriptions').upsert({
        trainer_id:        user.id,
        status:            'active',
        plan_code:         plan,
        plan_amount:       planInfo.amount,
        member_limit:      planInfo.member_limit,
        toss_customer_key: customerKey,
        toss_billing_key:  billingKey,
        toss_card_number:  cardNumber,
        paid_expires_at:   expiresAt.toISOString(),
        next_billing_at:   expiresAt.toISOString(),
        last_billing_at:   now.toISOString(),
        last_billing_error: null,
        billing_retry_count: 0,
        updated_at:        now.toISOString(),
      }, { onConflict: 'trainer_id' })

      await admin.from('trainer_billing_history').insert({
        trainer_id: user.id,
        status: 'success',
        amount: planInfo.amount,
        plan_code: plan,
        toss_payment_key: chargeData.paymentKey,
        toss_order_id: orderId,
        receipt_url: chargeData.receipt?.url || null,
      })

      return new Response(JSON.stringify({ ok: true, plan, expires_at: expiresAt }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    } else {
      await admin.from('trainer_billing_history').insert({
        trainer_id: user.id,
        status: 'failed',
        amount: planInfo.amount,
        plan_code: plan,
        toss_order_id: orderId,
        error_code: chargeData.code,
        error_message: chargeData.message,
      })
      return new Response(JSON.stringify({ ok: false, reason: chargeData.message }), {
        status: 402,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: e.message || String(e) }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
