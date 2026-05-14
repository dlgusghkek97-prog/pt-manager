-- =========================================================
-- PT Manager · 2026-05-14 통합 마이그레이션 (idempotent)
--
-- 한 번만 실행하면 이번 세션 이후 추가된 모든 스키마 변경이 반영됨.
-- 반복 실행해도 안전 (IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS).
--
-- 포함 항목:
--   1) trainers macro_* 컬럼 추가 (members 와 정렬)
--   2) members/trainers macro_body_fat (체지방률) 컬럼
--   3) diet_day_favorites / trainer_diet_day_favorites (일일 식단 즐겨찾기) + RLS
--   4) is_my_trainer 헬퍼 + trainer_workout_logs/diet_logs SELECT 회원 허용
--   5) is_admin_trainer 헬퍼 + can_add_member 마스터 우회
--   6) 구독 v2 (member_limit + trial 트리거) — 안전하게 ALTER
--
-- 실행 후 맨 마지막 "검증" 블록의 결과로 모든 항목 정상 여부 확인 가능.
-- =========================================================

-- =========================================================
-- 1) trainers macro_* 컬럼
-- =========================================================
ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS macro_weight    numeric(5,2),
  ADD COLUMN IF NOT EXISTS macro_muscle    numeric(5,2),
  ADD COLUMN IF NOT EXISTS macro_body_fat  numeric(5,2),
  ADD COLUMN IF NOT EXISTS macro_activity  text,
  ADD COLUMN IF NOT EXISTS macro_intensity text,
  ADD COLUMN IF NOT EXISTS macro_cycle     text,
  ADD COLUMN IF NOT EXISTS goal            text,
  ADD COLUMN IF NOT EXISTS gender          text;

-- =========================================================
-- 2) members macro_body_fat (체지방률)
-- =========================================================
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS macro_body_fat numeric(5,2);

-- =========================================================
-- 3) 일일 식단 즐겨찾기 (하루 전체 끼니 set)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.diet_day_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  label text NOT NULL,
  meals jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diet_day_favorites_member
  ON public.diet_day_favorites (member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.trainer_diet_day_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  label text NOT NULL,
  meals jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trainer_diet_day_favorites_trainer
  ON public.trainer_diet_day_favorites (trainer_id, created_at DESC);

ALTER TABLE public.diet_day_favorites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_diet_day_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p5_all" ON public.diet_day_favorites;
DROP POLICY IF EXISTS "p5_all" ON public.trainer_diet_day_favorites;

CREATE POLICY "p5_all" ON public.diet_day_favorites FOR ALL TO authenticated
  USING (public.is_self_member(member_id) OR public.is_my_member(member_id))
  WITH CHECK (public.is_self_member(member_id) OR public.is_my_member(member_id));

CREATE POLICY "p5_all" ON public.trainer_diet_day_favorites FOR ALL TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- =========================================================
-- 4) 회원 → 본인 담당 트레이너의 운동·식단 로그 SELECT 허용
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_my_trainer(_trainer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE auth_user_id = auth.uid()
      AND trainer_id = _trainer_id
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_my_trainer(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "p5_all"    ON public.trainer_workout_logs;
DROP POLICY IF EXISTS "p5_select" ON public.trainer_workout_logs;
DROP POLICY IF EXISTS "p5_insert" ON public.trainer_workout_logs;
DROP POLICY IF EXISTS "p5_update" ON public.trainer_workout_logs;
DROP POLICY IF EXISTS "p5_delete" ON public.trainer_workout_logs;

CREATE POLICY "p5_select" ON public.trainer_workout_logs FOR SELECT TO authenticated
  USING (trainer_id = auth.uid() OR public.is_my_trainer(trainer_id));
CREATE POLICY "p5_insert" ON public.trainer_workout_logs FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "p5_update" ON public.trainer_workout_logs FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "p5_delete" ON public.trainer_workout_logs FOR DELETE TO authenticated
  USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "p5_all"    ON public.trainer_diet_logs;
DROP POLICY IF EXISTS "p5_select" ON public.trainer_diet_logs;
DROP POLICY IF EXISTS "p5_insert" ON public.trainer_diet_logs;
DROP POLICY IF EXISTS "p5_update" ON public.trainer_diet_logs;
DROP POLICY IF EXISTS "p5_delete" ON public.trainer_diet_logs;

CREATE POLICY "p5_select" ON public.trainer_diet_logs FOR SELECT TO authenticated
  USING (trainer_id = auth.uid() OR public.is_my_trainer(trainer_id));
CREATE POLICY "p5_insert" ON public.trainer_diet_logs FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "p5_update" ON public.trainer_diet_logs FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "p5_delete" ON public.trainer_diet_logs FOR DELETE TO authenticated
  USING (trainer_id = auth.uid());

-- =========================================================
-- 5) 구독 v2 — member_limit + trial 트리거
-- =========================================================
ALTER TABLE public.trainer_subscriptions
  ADD COLUMN IF NOT EXISTS member_limit int;

UPDATE public.trainer_subscriptions
   SET plan_code    = 'starter_10',
       plan_amount  = 9900,
       member_limit = 10
 WHERE plan_code = 'monthly_9900' OR plan_code IS NULL;

CREATE OR REPLACE FUNCTION public.create_trial_for_new_trainer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- =========================================================
-- 6) 운영자(마스터) 우회 — is_admin_trainer + can_add_member
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_admin_trainer(_trainer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trainers
    WHERE id = _trainer_id
      AND lower(email) = 'dlgusghkek97@gmail.com'
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_trainer(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_add_member(_trainer_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub RECORD;
  v_count int;
  v_now timestamptz := now();
  v_active boolean;
BEGIN
  IF public.is_admin_trainer(_trainer_id) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'master');
  END IF;

  SELECT * INTO v_sub FROM public.trainer_subscriptions
   WHERE trainer_id = _trainer_id LIMIT 1;

  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', '구독 정보 없음');
  END IF;

  v_active := (
    (v_sub.status = 'trial'  AND v_sub.trial_expires_at > v_now)
    OR (v_sub.status = 'active' AND v_sub.paid_expires_at > v_now)
  );

  IF NOT v_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', '구독 만료 — 결제 후 회원 추가 가능');
  END IF;

  IF v_sub.member_limit IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.members WHERE trainer_id = _trainer_id;
    IF v_count >= v_sub.member_limit THEN
      RETURN jsonb_build_object('ok', false,
        'reason', '회원 한도 초과 (' || v_sub.member_limit || '명) — 상위 플랜으로 업그레이드 필요');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.can_add_member(uuid) TO anon, authenticated;

-- =========================================================
-- PostgREST 스키마 캐시 재로드
-- =========================================================
NOTIFY pgrst, 'reload schema';

-- =========================================================
-- 검증 — 결과 한 번에 확인
-- =========================================================
SELECT
  -- trainers macro_* 컬럼
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='trainers'
     AND column_name IN ('macro_weight','macro_muscle','macro_body_fat','macro_activity','macro_intensity','macro_cycle','macro_occupation','goal','gender'))
   AS trainers_macro_cols,                 -- 9 (정상)

  -- members.macro_body_fat
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='members' AND column_name='macro_body_fat')
   AS members_body_fat_col,                -- 1

  -- 일일 즐겨찾기 테이블
  (SELECT count(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_name IN ('diet_day_favorites','trainer_diet_day_favorites'))
   AS day_fav_tables,                       -- 2

  -- 핵심 함수 5종
  (SELECT count(*) FROM pg_proc
   WHERE proname IN ('is_my_trainer','is_admin_trainer','can_add_member','create_trial_for_new_trainer','is_my_member'))
   AS core_functions,                       -- 5

  -- trainer_workout_logs / trainer_diet_logs SELECT 정책 (회원 허용)
  (SELECT count(*) FROM pg_policy
   WHERE polname='p5_select'
     AND polrelid IN ('public.trainer_workout_logs'::regclass, 'public.trainer_diet_logs'::regclass))
   AS trainer_logs_select_policies;         -- 2
