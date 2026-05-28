-- =========================================================
-- PT Manager · 2026-05-28
-- 보너스 일수 분리 누적 모델
--
-- 정책 변경:
--   - 'active' 상태에서 받은 쿠폰·추천 보너스는 paid_expires_at 에 합쳐지지 않고
--     bonus_days_pending 컬럼에 누적됨.
--   - 실효 만료일 = paid_expires_at + bonus_days_pending
--   - 환불 시: 결제 금액만 환불하고 bonus_days_pending 은 유지.
--     paid_expires_at 만료 후 보너스가 자동 소비됨 (expire_overdue_subscriptions 처리).
--   - 'trial' 상태에서 받은 보너스는 기존대로 trial_expires_at 에 누적 (free 라 분리 의미 없음).
-- =========================================================

-- ===== 1) 새 컬럼 =====
ALTER TABLE public.trainer_subscriptions
  ADD COLUMN IF NOT EXISTS bonus_days_pending int NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.trainer_subscriptions.bonus_days_pending IS
  '쿠폰/추천으로 부여된 미사용 보너스 일수. paid_expires_at 만료 시점에 자동 소비.';

-- ===== 2) redeem_coupon 재정의 — active 는 bonus_days_pending 누적 =====
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon record;
  v_trainer_email text;
  v_sub record;
  v_new_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_code IS NULL OR length(p_code) < 4 THEN RAISE EXCEPTION 'invalid_code'; END IF;

  SELECT * INTO v_coupon FROM public.coupons WHERE code = p_code FOR UPDATE;
  IF v_coupon IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF v_coupon.used_by IS NOT NULL THEN RAISE EXCEPTION 'already_used'; END IF;
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'coupon_expired';
  END IF;

  IF v_coupon.target_email IS NOT NULL THEN
    SELECT email INTO v_trainer_email FROM public.trainers WHERE id = auth.uid();
    IF v_trainer_email IS DISTINCT FROM v_coupon.target_email THEN
      RAISE EXCEPTION 'email_mismatch';
    END IF;
  END IF;

  SELECT * INTO v_sub FROM public.trainer_subscriptions WHERE trainer_id = auth.uid() FOR UPDATE;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'no_subscription_row'; END IF;

  IF v_sub.status = 'trial' THEN
    -- 무료 체험 중: trial_expires_at 에 직접 누적 (기존)
    v_new_expires := COALESCE(v_sub.trial_expires_at, now()) + (v_coupon.duration_days || ' days')::interval;
    UPDATE public.trainer_subscriptions
       SET trial_expires_at = v_new_expires
     WHERE trainer_id = auth.uid();
  ELSIF v_sub.status IN ('active', 'cancelled') THEN
    -- 결제 중: bonus_days_pending 누적 (paid_expires_at 안 건드림)
    UPDATE public.trainer_subscriptions
       SET bonus_days_pending = COALESCE(bonus_days_pending, 0) + v_coupon.duration_days
     WHERE trainer_id = auth.uid();
    -- 반환용 실효 만료일 계산
    v_new_expires := COALESCE(v_sub.paid_expires_at, now())
                   + ((COALESCE(v_sub.bonus_days_pending, 0) + v_coupon.duration_days) || ' days')::interval;
  ELSIF v_sub.status = 'expired' THEN
    -- 만료된 구독: trial 로 부활
    v_new_expires := now() + (v_coupon.duration_days || ' days')::interval;
    UPDATE public.trainer_subscriptions
       SET status = 'trial', trial_started_at = now(), trial_expires_at = v_new_expires
     WHERE trainer_id = auth.uid();
  ELSE
    RAISE EXCEPTION 'invalid_subscription_status';
  END IF;

  UPDATE public.coupons
     SET used_by = auth.uid(), used_at = now()
   WHERE code = p_code;

  RETURN jsonb_build_object(
    'success', true,
    'duration_days', v_coupon.duration_days,
    'applied_to', CASE WHEN v_sub.status IN ('active','cancelled') THEN 'bonus_pending' ELSE 'trial_expires_at' END,
    'new_expires_at', v_new_expires
  );
END $$;

-- ===== 3) award_referral_bonus 재정의 — referrer 가 active 면 bonus_days_pending =====
CREATE OR REPLACE FUNCTION public.award_referral_bonus(p_referee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_red record;
  v_referrer_status text;
BEGIN
  SELECT * INTO v_red FROM public.referral_redemptions
   WHERE referee_id = p_referee_id AND status = 'pending' FOR UPDATE;
  IF v_red IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'no_pending'); END IF;

  SELECT status INTO v_referrer_status FROM public.trainer_subscriptions
   WHERE trainer_id = v_red.referrer_id;

  IF v_referrer_status IN ('active', 'cancelled') THEN
    -- 결제 중 referrer: bonus_days_pending 누적
    UPDATE public.trainer_subscriptions
       SET bonus_days_pending = COALESCE(bonus_days_pending, 0) + v_red.bonus_days_referrer
     WHERE trainer_id = v_red.referrer_id;
  ELSIF v_referrer_status = 'trial' THEN
    -- 무료 체험 referrer: trial_expires_at 누적 (기존)
    UPDATE public.trainer_subscriptions
       SET trial_expires_at = COALESCE(trial_expires_at, now())
                            + (v_red.bonus_days_referrer || ' days')::interval
     WHERE trainer_id = v_red.referrer_id;
  END IF;
  -- expired/cancelled referrer 는 보너스 부여 X (silently skip)

  UPDATE public.referral_redemptions
     SET status = 'awarded', paid_at = now(), awarded_at = now()
   WHERE id = v_red.id;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_days', v_red.bonus_days_referrer,
    'applied_to', CASE WHEN v_referrer_status IN ('active','cancelled') THEN 'bonus_pending'
                       WHEN v_referrer_status = 'trial' THEN 'trial_expires_at'
                       ELSE 'skipped' END
  );
END $$;

-- ===== 4) expire_overdue_subscriptions 재정의 — bonus_days_pending 우선 소비 =====
-- paid_expires_at 가 만료된 active/cancelled 행 중 bonus_days_pending > 0 이면
-- paid_expires_at 을 bonus_days_pending 만큼 연장하고 bonus_days_pending = 0 으로 차감.
-- 그래도 paid_expires_at 가 만료 상태면 expired 로 전이.
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consumed int;
  v_expired int;
BEGIN
  -- 1) bonus_days_pending 소비 (paid 만료 + bonus 잔액 있는 케이스)
  UPDATE public.trainer_subscriptions
     SET paid_expires_at = paid_expires_at + (bonus_days_pending || ' days')::interval,
         bonus_days_pending = 0
   WHERE status IN ('active', 'cancelled')
     AND paid_expires_at IS NOT NULL
     AND paid_expires_at < now()
     AND bonus_days_pending > 0;
  GET DIAGNOSTICS v_consumed = ROW_COUNT;

  -- 2) 그래도 paid/trial 만료된 행 → expired 로 전이
  UPDATE public.trainer_subscriptions
     SET status = 'expired'
   WHERE status IN ('trial', 'active', 'cancelled')
     AND COALESCE(paid_expires_at, trial_expires_at) < now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  RETURN v_consumed + v_expired;
END $$;

-- ===== 5) refund_revoke_bonuses 는 그대로 두되 더 이상 자동 호출 안 함 =====
-- (관리자가 수동으로 회수가 필요한 케이스 — 사기 환불 등 — 에 직접 호출)
-- COMMENT ON FUNCTION public.refund_revoke_bonuses IS 'deprecated for auto-flow';

NOTIFY pgrst, 'reload schema';

-- ===== 검증 =====
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='trainer_subscriptions' AND column_name='bonus_days_pending';
-- SELECT proname, prosrc FROM pg_proc WHERE proname IN ('redeem_coupon','award_referral_bonus','expire_overdue_subscriptions');
