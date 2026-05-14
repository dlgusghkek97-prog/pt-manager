// Supabase Edge Function — 정기결제 (월 1회 자동)
//
// 호출자: pg_cron 매일 KST 09:00, 또는 수동 호출
// 동작:
//   1. trainer_subscriptions 에서 next_billing_at <= now() AND status='active'
//      AND toss_billing_key IS NOT NULL 인 row 조회
//   2. 각 row 마다 토스 /v1/billing/{billingKey} POST
//   3. 성공 시 paid_expires_at += 1 month, next_billing_at += 1 month
//   4. 실패 시 billing_retry_count++, 3회 초과 시 status='expired'
//
// 배포: supabase functions deploy toss-charge-monthly

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOSS_SECRET  = Deno.env.get('TOSS_SECRET_KEY')!

const TOSS_API = 'https://api.tosspayments.com/v1/billing'
const tossAuth = () => 'Basic ' + btoa(TOSS_SECRET + ':')
const MAX_RETRY = 3

serve(async (_req) => {
  if (!TOSS_SECRET) return new Response('TOSS_SECRET_KEY 미설정', { status: 500 })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // 청구 대상 조회
  const { data: rows, error } = await admin
    .from('trainer_subscriptions')
    .select('trainer_id, plan_code, plan_amount, toss_billing_key, toss_customer_key, billing_retry_count, paid_expires_at, next_billing_at')
    .eq('status', 'active')
    .not('toss_billing_key', 'is', null)
    .lte('next_billing_at', new Date().toISOString())

  if (error) return new Response('조회 실패: ' + error.message, { status: 500 })
  if (!rows || rows.length === 0) return new Response('청구 대상 없음', { status: 200 })

  const results: any[] = []

  for (const row of rows) {
    const orderId = `pt-recur-${row.trainer_id.slice(0, 8)}-${Date.now()}`
    try {
      const res = await fetch(`${TOSS_API}/${row.toss_billing_key}`, {
        method: 'POST',
        headers: { 'Authorization': tossAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerKey: row.toss_customer_key,
          amount: row.plan_amount,
          orderId,
          orderName: `PT Manager 정기결제 · ${row.plan_code}`,
        }),
      })
      const data = await res.json()
      const now = new Date()

      if (res.ok) {
        const newExpires = new Date(row.paid_expires_at || now)
        newExpires.setMonth(newExpires.getMonth() + 1)

        await admin.from('trainer_subscriptions').update({
          paid_expires_at:    newExpires.toISOString(),
          next_billing_at:    newExpires.toISOString(),
          last_billing_at:    now.toISOString(),
          last_billing_error: null,
          billing_retry_count: 0,
          updated_at:         now.toISOString(),
        }).eq('trainer_id', row.trainer_id)

        await admin.from('trainer_billing_history').insert({
          trainer_id: row.trainer_id,
          status: 'success',
          amount: row.plan_amount,
          plan_code: row.plan_code,
          toss_payment_key: data.paymentKey,
          toss_order_id: orderId,
          receipt_url: data.receipt?.url || null,
        })

        results.push({ trainer_id: row.trainer_id, status: 'success' })
      } else {
        const newRetry = (row.billing_retry_count || 0) + 1
        const update: any = {
          last_billing_error:  `${data.code}: ${data.message}`,
          billing_retry_count: newRetry,
          updated_at:          now.toISOString(),
        }
        // 3회 초과 → expired (그 후 회원/트레이너 모두 차단)
        if (newRetry >= MAX_RETRY) {
          update.status = 'expired'
        } else {
          // 3일 후 재시도
          const retryAt = new Date(now); retryAt.setDate(retryAt.getDate() + 3)
          update.next_billing_at = retryAt.toISOString()
        }
        await admin.from('trainer_subscriptions').update(update).eq('trainer_id', row.trainer_id)

        await admin.from('trainer_billing_history').insert({
          trainer_id: row.trainer_id,
          status: 'failed',
          amount: row.plan_amount,
          plan_code: row.plan_code,
          toss_order_id: orderId,
          error_code: data.code,
          error_message: data.message,
        })

        results.push({ trainer_id: row.trainer_id, status: 'failed', retry: newRetry })
      }
    } catch (e) {
      results.push({ trainer_id: row.trainer_id, status: 'error', message: (e as Error).message })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
