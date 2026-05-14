-- =========================================
-- PT Manager · 2026-05-13
-- 운영자(마스터) 계정 — 구독·회원 한도 검사 우회
--
-- ADMIN_EMAIL = 'dlgusghkek97@gmail.com'
-- 이 계정으로 로그인한 트레이너는 구독 상태/회원 한도 상관 없이 회원 추가 가능.
-- =========================================

CREATE OR REPLACE FUNCTION public.is_admin_trainer(_trainer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trainers
    WHERE id = _trainer_id
      AND lower(email) = 'dlgusghkek97@gmail.com'
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_trainer(uuid) TO anon, authenticated;

-- can_add_member 우회 — 마스터면 즉시 ok
CREATE OR REPLACE FUNCTION public.can_add_member(_trainer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_count int;
  v_now timestamptz := now();
  v_active boolean;
BEGIN
  -- 마스터 계정은 모든 검사 우회
  IF public.is_admin_trainer(_trainer_id) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'master');
  END IF;

  SELECT * INTO v_sub FROM public.trainer_subscriptions
   WHERE trainer_id = _trainer_id LIMIT 1;

  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', '구독 정보 없음');
  END IF;

  v_active := (
    (v_sub.status = 'trial' AND v_sub.trial_expires_at > v_now)
    OR (v_sub.status = 'active' AND v_sub.paid_expires_at > v_now)
  );

  IF NOT v_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', '구독 만료 — 결제 후 회원 추가 가능');
  END IF;

  IF v_sub.member_limit IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.members WHERE trainer_id = _trainer_id;
    IF v_count >= v_sub.member_limit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', '회원 한도 초과 (' || v_sub.member_limit || '명) — 상위 플랜으로 업그레이드 필요'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.can_add_member(uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT public.is_admin_trainer(id) AS is_admin, name, email
--   FROM public.trainers
--   WHERE lower(email) = 'dlgusghkek97@gmail.com';
