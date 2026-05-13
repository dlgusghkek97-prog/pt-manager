-- =========================================
-- PT Manager · 2026-05-13 · 구독 플랜 (회원수 차등 + 환불)
--
-- 플랜:
--  starter_10     : 회원 10명까지   · ₩9,900/월
--  standard_30    : 회원 30명까지   · ₩19,900/월
--  pro_unlimited  : 회원 무제한      · ₩39,900/월
-- =========================================

ALTER TABLE public.trainer_subscriptions
  ADD COLUMN IF NOT EXISTS member_limit int;
  -- NULL = 무제한 (pro_unlimited)

-- 기존 row 정리: 기본 trial → starter_10 (회원 10명 한도 무료 체험)
UPDATE public.trainer_subscriptions
   SET plan_code   = 'starter_10',
       plan_amount = 9900,
       member_limit = 10
 WHERE plan_code = 'monthly_9900' OR plan_code IS NULL;

-- 새 trial 생성 트리거도 starter_10 으로 시작
CREATE OR REPLACE FUNCTION public.create_trial_for_new_trainer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trainer_subscriptions
    (trainer_id, status, plan_code, plan_amount, member_limit,
     trial_started_at, trial_expires_at)
  VALUES (NEW.id, 'trial', 'starter_10', 9900, 10,
          now(), now() + interval '30 days')
  ON CONFLICT (trainer_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_trial_for_new_trainer] %, %', SQLSTATE, SQLERRM;
  RETURN NEW;
END $$;

-- 회원 수 추가 제한 RPC (서버 측 강제) — 회원 INSERT 전 호출.
-- 반환: { ok: bool, reason: text }
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
  SELECT * INTO v_sub FROM public.trainer_subscriptions
   WHERE trainer_id = _trainer_id LIMIT 1;

  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', '구독 정보 없음');
  END IF;

  -- 활성 상태 판단: trial 또는 active 중에 만료일이 아직 안 지남
  v_active := (
    (v_sub.status = 'trial' AND v_sub.trial_expires_at > v_now)
    OR (v_sub.status = 'active' AND v_sub.paid_expires_at > v_now)
  );

  IF NOT v_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', '구독 만료 — 결제 후 회원 추가 가능');
  END IF;

  -- 회원 수 한도 검사 (member_limit IS NULL 이면 무제한)
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

-- 확인
SELECT t.name, t.email, s.status, s.plan_code, s.member_limit, s.plan_amount,
       to_char(s.trial_expires_at, 'YYYY-MM-DD') AS trial_until
FROM public.trainers t
LEFT JOIN public.trainer_subscriptions s ON s.trainer_id = t.id
ORDER BY t.created_at;
