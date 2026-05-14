-- =========================================================
-- PT Manager · 2026-05-14 출시 직전 준비 통합 마이그레이션 (idempotent)
--
-- (A) diet_favorites / trainer_diet_favorites RLS 임시 "allow all" → 소유 패턴으로
-- (B) trainer_subscriptions 에 토스페이먼츠 정기결제용 컬럼 추가
-- (C) trainer_subscriptions 의 expired 자동 전이 헬퍼 (Edge Function 에서 호출)
-- =========================================================

-- =========================================================
-- (A) diet_favorites / trainer_diet_favorites RLS 좁히기
-- =========================================================
DROP POLICY IF EXISTS "p5_all"      ON public.diet_favorites;
DROP POLICY IF EXISTS "allow_all"   ON public.diet_favorites;
DROP POLICY IF EXISTS "p5_all"      ON public.trainer_diet_favorites;
DROP POLICY IF EXISTS "allow_all"   ON public.trainer_diet_favorites;

ALTER TABLE public.diet_favorites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_diet_favorites ENABLE ROW LEVEL SECURITY;

-- 회원 본인 + 담당 트레이너 모두 CRUD (다른 식단 테이블들과 동일)
CREATE POLICY "p5_all" ON public.diet_favorites FOR ALL TO authenticated
  USING (public.is_self_member(member_id) OR public.is_my_member(member_id))
  WITH CHECK (public.is_self_member(member_id) OR public.is_my_member(member_id));

-- 트레이너 본인만
CREATE POLICY "p5_all" ON public.trainer_diet_favorites FOR ALL TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- =========================================================
-- (B) trainer_subscriptions — 토스페이먼츠 정기결제 컬럼
-- =========================================================
ALTER TABLE public.trainer_subscriptions
  ADD COLUMN IF NOT EXISTS toss_customer_key text,    -- 트레이너별 unique customerKey (uuid 권장)
  ADD COLUMN IF NOT EXISTS toss_billing_key  text,    -- 토스 발급 billingKey (정기결제용)
  ADD COLUMN IF NOT EXISTS toss_card_number  text,    -- 마스킹된 카드번호 (UI 표시용)
  ADD COLUMN IF NOT EXISTS next_billing_at   timestamptz, -- 다음 자동결제 예정일
  ADD COLUMN IF NOT EXISTS last_billing_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_billing_error text,   -- 마지막 결제 실패 사유
  ADD COLUMN IF NOT EXISTS billing_retry_count int DEFAULT 0;

-- 결제 이력 (영수증, 환불 등 추적용)
CREATE TABLE IF NOT EXISTS public.trainer_billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  status text NOT NULL,                  -- success | failed | refunded | cancelled
  amount int NOT NULL,
  plan_code text,
  toss_payment_key text,                 -- 토스 paymentKey
  toss_order_id text,                    -- 토스 orderId
  error_code text,
  error_message text,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_history_trainer
  ON public.trainer_billing_history (trainer_id, created_at DESC);

ALTER TABLE public.trainer_billing_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p5_select" ON public.trainer_billing_history;
CREATE POLICY "p5_select" ON public.trainer_billing_history FOR SELECT TO authenticated
  USING (trainer_id = auth.uid());
-- INSERT/UPDATE 는 service_role 만 (Edge Function 에서 service key 사용)

-- =========================================================
-- (C) 만료 자동 전이 헬퍼 — pg_cron 매일 호출, 만료된 trial/active 를 expired 로
-- =========================================================
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.trainer_subscriptions
     SET status = 'expired'
   WHERE status IN ('trial', 'active', 'cancelled')
     AND COALESCE(paid_expires_at, trial_expires_at) < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- 매일 KST 03:00 (UTC 18:00) 만료 처리
DO $$
DECLARE v_id int;
BEGIN
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'expire-overdue-subs';
  IF v_id IS NOT NULL THEN PERFORM cron.unschedule(v_id); END IF;
END $$;

SELECT cron.schedule(
  'expire-overdue-subs',
  '0 18 * * *',  -- UTC 18:00 = KST 03:00
  $$ SELECT public.expire_overdue_subscriptions(); $$
);

NOTIFY pgrst, 'reload schema';

-- 검증:
--   SELECT polname, cmd FROM pg_policy WHERE polrelid='public.diet_favorites'::regclass;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='trainer_subscriptions'
--       AND column_name LIKE 'toss%';
--   SELECT jobname, schedule FROM cron.job WHERE jobname='expire-overdue-subs';
