-- =========================================================
-- PT Manager · 2026-05-28
-- 환불 시 추천인(referrer) 보너스 회수 RPC
--
-- 배경:
--   기존 토스 환불 자동화는 refundee 의 보너스만 유지하고 referrer 의 보너스는
--   회수하지 않았음 → "둘이 서로 추천 + 결제 + 환불" 패턴으로 +7일 무료 획득 가능.
--
-- 정책:
--   - refundee 자신의 쿠폰·받은 추천 보너스 → 유지 (사용자 친화적)
--   - refundee 의 결제로 인해 referrer 가 받은 보너스 → 회수 (결제가 reversed 됐으므로)
-- =========================================================

CREATE OR REPLACE FUNCTION public.revoke_referrer_bonus_on_refund(p_referee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_red record;
  v_referrer_status text;
BEGIN
  -- referee_id 의 awarded 행 (이 referee 의 결제로 referrer 가 받은 보너스)
  SELECT * INTO v_red FROM public.referral_redemptions
   WHERE referee_id = p_referee_id AND status = 'awarded' FOR UPDATE;
  IF v_red IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_awarded');
  END IF;

  SELECT status INTO v_referrer_status FROM public.trainer_subscriptions
   WHERE trainer_id = v_red.referrer_id;

  -- bonus_days_pending 에서 회수 (active / cancelled / expired — 보너스가 누적된 컬럼)
  -- GREATEST 로 음수 방지.
  IF v_referrer_status IN ('active', 'cancelled', 'expired') THEN
    UPDATE public.trainer_subscriptions
       SET bonus_days_pending = GREATEST(0, COALESCE(bonus_days_pending, 0) - v_red.bonus_days_referrer)
     WHERE trainer_id = v_red.referrer_id;
  ELSIF v_referrer_status = 'trial' THEN
    -- trial 중 award 받은 경우는 trial_expires_at 에 누적돼있음
    UPDATE public.trainer_subscriptions
       SET trial_expires_at = trial_expires_at - (v_red.bonus_days_referrer || ' days')::interval
     WHERE trainer_id = v_red.referrer_id;
  END IF;

  -- 추천 행 cancelled 처리 (감사 흔적 남김)
  UPDATE public.referral_redemptions
     SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'refund'
   WHERE id = v_red.id;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_days_revoked', v_red.bonus_days_referrer,
    'referrer_id', v_red.referrer_id,
    'referrer_status', v_referrer_status
  );
END $$;

GRANT EXECUTE ON FUNCTION public.revoke_referrer_bonus_on_refund(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ===== 검증 =====
-- SELECT proname FROM pg_proc WHERE proname = 'revoke_referrer_bonus_on_refund';
--   → 1 row
