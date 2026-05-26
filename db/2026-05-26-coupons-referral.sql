-- =========================================================
-- PT Manager · 2026-05-26
-- 쿠폰 + 추천인 시스템
--
-- 정책:
--   1. 추천 보너스: 추천인 +7일 / 추천받은 사람 +3일 (가입 즉시)
--      → 추천인 보너스(+7)는 추천받은 사람이 첫 유료 결제 시점에만 부여
--   2. 쿠폰 누적 사용: 한 트레이너가 여러 쿠폰 사용 가능 (각 코드는 1회용)
--   3. 추천 한도: 평생 최대 20명 (= 보너스 최대 140일)
--   4. 마스터(dlgusghkek97@gmail.com) 는 referral_code 미발급
--   5. 환불 시: 추천 보너스 회수 + 쿠폰 보너스 회수
-- =========================================================

-- ===== 1) coupons 테이블 =====
CREATE TABLE IF NOT EXISTS public.coupons (
  code            text PRIMARY KEY,
  type            text NOT NULL CHECK (type IN ('free_month', 'extend_days')),
  duration_days   int  NOT NULL CHECK (duration_days > 0),
  target_email    text,                                    -- NULL = 누구나
  used_by         uuid REFERENCES public.trainers(id),
  used_at         timestamptz,
  expires_at      timestamptz,                             -- 쿠폰 자체 만료일
  notes           text,
  created_by      uuid REFERENCES public.trainers(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coupons_used_by ON public.coupons(used_by);
CREATE INDEX IF NOT EXISTS idx_coupons_target_email ON public.coupons(target_email);

-- ===== 2) trainers.referral_code =====
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- 가입 시 자동 발급 트리거 (마스터 제외)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_code text;
  v_attempt int := 0;
BEGIN
  IF NEW.email = 'dlgusghkek97@gmail.com' THEN
    RETURN NEW;
  END IF;

  v_base := UPPER(REGEXP_REPLACE(COALESCE(LEFT(NEW.name, 3), 'PT'), '[^A-Za-z가-힣]', '', 'g'));
  IF v_base = '' THEN v_base := 'PT'; END IF;

  LOOP
    v_code := v_base || '-' || UPPER(SUBSTRING(MD5(random()::text || NEW.id::text || clock_timestamp()::text), 1, 4));
    BEGIN
      NEW.referral_code := v_code;
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 10 THEN RAISE EXCEPTION 'referral_code_gen_failed'; END IF;
    END;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON public.trainers;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.trainers
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- 기존 trainers backfill (마스터 제외)
DO $$
DECLARE
  r record; v_code text; v_base text; v_attempt int;
BEGIN
  FOR r IN SELECT id, name, email FROM public.trainers
            WHERE referral_code IS NULL AND email <> 'dlgusghkek97@gmail.com'
  LOOP
    v_base := UPPER(REGEXP_REPLACE(COALESCE(LEFT(r.name, 3), 'PT'), '[^A-Za-z가-힣]', '', 'g'));
    IF v_base = '' THEN v_base := 'PT'; END IF;
    v_attempt := 0;
    LOOP
      v_code := v_base || '-' || UPPER(SUBSTRING(MD5(random()::text || r.id::text || clock_timestamp()::text), 1, 4));
      BEGIN
        UPDATE public.trainers SET referral_code = v_code WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        v_attempt := v_attempt + 1;
        IF v_attempt > 10 THEN EXIT; END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- ===== 3) referral_redemptions 테이블 =====
CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id           uuid NOT NULL REFERENCES public.trainers(id),
  referee_id            uuid NOT NULL UNIQUE REFERENCES public.trainers(id),
  bonus_days_referrer   int  NOT NULL DEFAULT 7,
  bonus_days_referee    int  NOT NULL DEFAULT 3,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'awarded', 'cancelled')),
  paid_at               timestamptz,
  awarded_at            timestamptz,
  cancelled_at          timestamptz,
  cancel_reason         text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_referrer ON public.referral_redemptions(referrer_id, status);

-- ===== 4) RPC: 마스터 쿠폰 발급 =====
CREATE OR REPLACE FUNCTION public.master_create_coupon(
  p_type           text DEFAULT 'free_month',
  p_duration_days  int  DEFAULT 30,
  p_target_email   text DEFAULT NULL,
  p_expires_at     timestamptz DEFAULT NULL,
  p_notes          text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_attempt int := 0;
BEGIN
  IF NOT public.is_admin_trainer(auth.uid()) THEN
    RAISE EXCEPTION 'master_only';
  END IF;
  IF p_duration_days <= 0 THEN
    RAISE EXCEPTION 'invalid_duration';
  END IF;

  LOOP
    v_code := 'PT' || TO_CHAR(now(), 'YYMM') || '-' ||
              UPPER(SUBSTRING(MD5(random()::text || clock_timestamp()::text), 1, 4));
    BEGIN
      INSERT INTO public.coupons (code, type, duration_days, target_email, expires_at, notes, created_by)
      VALUES (v_code, p_type, p_duration_days, p_target_email, p_expires_at, p_notes, auth.uid());
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 10 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

-- ===== 5) RPC: 쿠폰 사용 =====
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
    v_new_expires := COALESCE(v_sub.trial_expires_at, now()) + (v_coupon.duration_days || ' days')::interval;
    UPDATE public.trainer_subscriptions
       SET trial_expires_at = v_new_expires
     WHERE trainer_id = auth.uid();
  ELSIF v_sub.status = 'active' THEN
    v_new_expires := COALESCE(v_sub.paid_expires_at, now()) + (v_coupon.duration_days || ' days')::interval;
    UPDATE public.trainer_subscriptions
       SET paid_expires_at = v_new_expires
     WHERE trainer_id = auth.uid();
  ELSIF v_sub.status IN ('expired', 'cancelled') THEN
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
    'new_expires_at', v_new_expires
  );
END $$;

-- ===== 6) RPC: 추천 코드 적용 (가입 직후 호출) =====
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_referee_id  uuid := auth.uid();
  v_count       int;
  v_max         int := 20;  -- 평생 최대 20명 (= 보너스 최대 140일)
BEGIN
  IF v_referee_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_code IS NULL OR length(p_code) < 4 THEN RAISE EXCEPTION 'invalid_code'; END IF;

  SELECT id INTO v_referrer_id FROM public.trainers WHERE referral_code = p_code;
  IF v_referrer_id IS NULL THEN RAISE EXCEPTION 'invalid_referral_code'; END IF;

  IF v_referrer_id = v_referee_id THEN RAISE EXCEPTION 'self_referral'; END IF;

  IF EXISTS (SELECT 1 FROM public.referral_redemptions WHERE referee_id = v_referee_id) THEN
    RAISE EXCEPTION 'already_referred';
  END IF;

  SELECT count(*) INTO v_count
    FROM public.referral_redemptions
   WHERE referrer_id = v_referrer_id AND status IN ('awarded', 'pending');
  IF v_count >= v_max THEN RAISE EXCEPTION 'max_referrals_reached'; END IF;

  -- 추천받은 사람 즉시 +3일 (trial)
  UPDATE public.trainer_subscriptions
     SET trial_expires_at = COALESCE(trial_expires_at, now()) + interval '3 days'
   WHERE trainer_id = v_referee_id AND status = 'trial';

  INSERT INTO public.referral_redemptions (referrer_id, referee_id, status)
  VALUES (v_referrer_id, v_referee_id, 'pending');

  RETURN jsonb_build_object('success', true, 'referee_bonus_days', 3);
END $$;

-- ===== 7) RPC: 추천 보너스 부여 (Edge Function 결제 성공 시) =====
CREATE OR REPLACE FUNCTION public.award_referral_bonus(p_referee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_red record;
BEGIN
  SELECT * INTO v_red FROM public.referral_redemptions
   WHERE referee_id = p_referee_id AND status = 'pending' FOR UPDATE;
  IF v_red IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'no_pending'); END IF;

  UPDATE public.trainer_subscriptions
     SET paid_expires_at = COALESCE(paid_expires_at, now()) + (v_red.bonus_days_referrer || ' days')::interval
   WHERE trainer_id = v_red.referrer_id AND status = 'active';
  UPDATE public.trainer_subscriptions
     SET trial_expires_at = COALESCE(trial_expires_at, now()) + (v_red.bonus_days_referrer || ' days')::interval
   WHERE trainer_id = v_red.referrer_id AND status = 'trial';

  UPDATE public.referral_redemptions
     SET status = 'awarded', paid_at = now(), awarded_at = now()
   WHERE id = v_red.id;

  RETURN jsonb_build_object('success', true, 'bonus_days', v_red.bonus_days_referrer);
END $$;

-- ===== 8) RPC: 환불 시 추천 + 쿠폰 보너스 회수 =====
CREATE OR REPLACE FUNCTION public.refund_revoke_bonuses(p_trainer_id uuid, p_reason text DEFAULT 'refund')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_red record;
  v_coupon record;
  v_total_revoked int := 0;
  v_referral_revoked int := 0;
BEGIN
  -- 1) 이 트레이너가 추천받았던 보너스 → 추천인 회수
  SELECT * INTO v_red FROM public.referral_redemptions
   WHERE referee_id = p_trainer_id AND status = 'awarded' FOR UPDATE;
  IF v_red IS NOT NULL THEN
    UPDATE public.trainer_subscriptions
       SET paid_expires_at = paid_expires_at - (v_red.bonus_days_referrer || ' days')::interval
     WHERE trainer_id = v_red.referrer_id AND status = 'active';
    UPDATE public.trainer_subscriptions
       SET trial_expires_at = trial_expires_at - (v_red.bonus_days_referrer || ' days')::interval
     WHERE trainer_id = v_red.referrer_id AND status = 'trial';
    UPDATE public.referral_redemptions
       SET status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
     WHERE id = v_red.id;
    v_referral_revoked := v_red.bonus_days_referrer;
  END IF;

  -- 2) 이 트레이너가 사용한 모든 쿠폰 → 회수
  FOR v_coupon IN
    SELECT * FROM public.coupons WHERE used_by = p_trainer_id
  LOOP
    v_total_revoked := v_total_revoked + v_coupon.duration_days;
    UPDATE public.coupons
       SET notes = COALESCE(notes, '') || ' [REFUNDED ' || COALESCE(p_reason, '') || ' @ ' || now()::text || ']'
     WHERE code = v_coupon.code;
  END LOOP;

  IF v_total_revoked > 0 THEN
    UPDATE public.trainer_subscriptions
       SET paid_expires_at = paid_expires_at - (v_total_revoked || ' days')::interval
     WHERE trainer_id = p_trainer_id AND status = 'active';
    UPDATE public.trainer_subscriptions
       SET trial_expires_at = trial_expires_at - (v_total_revoked || ' days')::interval
     WHERE trainer_id = p_trainer_id AND status = 'trial';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'coupon_days_revoked', v_total_revoked,
    'referral_days_revoked', v_referral_revoked
  );
END $$;

-- ===== 9) RLS =====
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

-- coupons: master 전체 / 본인 used 만 SELECT
DROP POLICY IF EXISTS p_coupon_select_master ON public.coupons;
DROP POLICY IF EXISTS p_coupon_select_self   ON public.coupons;
CREATE POLICY p_coupon_select_master ON public.coupons FOR SELECT TO authenticated
  USING (public.is_admin_trainer(auth.uid()));
CREATE POLICY p_coupon_select_self ON public.coupons FOR SELECT TO authenticated
  USING (used_by = auth.uid());
-- INSERT/UPDATE/DELETE 없음 (RPC 만 사용)

-- referral_redemptions: 본인이 referrer 또는 referee 일 때 SELECT
DROP POLICY IF EXISTS p_ref_select ON public.referral_redemptions;
CREATE POLICY p_ref_select ON public.referral_redemptions FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid());

-- ===== 10) Grant =====
GRANT EXECUTE ON FUNCTION public.master_create_coupon(text, int, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_referral_bonus(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refund_revoke_bonuses(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ===== 검증 =====
-- SELECT count(*) FROM public.coupons;
-- SELECT name, referral_code FROM public.trainers WHERE referral_code IS NOT NULL LIMIT 5;
-- SELECT proname FROM pg_proc WHERE proname IN (
--   'generate_referral_code','master_create_coupon','redeem_coupon',
--   'apply_referral_code','award_referral_bonus','refund_revoke_bonuses'
-- );
