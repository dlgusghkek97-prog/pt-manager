-- =========================================
-- PT Manager · 2026-05-13
-- 일일 식단 즐겨찾기 — 하루 전체 끼니를 한 번에 저장·불러오기
--
-- 기존 diet_favorites/trainer_diet_favorites 는 끼니 1개 단위.
-- 매일 동일한 식단을 먹는 사용자가 많아 하루 전체(끼니 N개) 단위 즐겨찾기 추가.
-- =========================================

-- 회원용
CREATE TABLE IF NOT EXISTS public.diet_day_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  label text NOT NULL,
  meals jsonb NOT NULL,  -- [{ slot, name, carbs, protein, fat, calories }, ...]
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diet_day_favorites_member
  ON public.diet_day_favorites (member_id, created_at DESC);

-- 트레이너용
CREATE TABLE IF NOT EXISTS public.trainer_diet_day_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  label text NOT NULL,
  meals jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trainer_diet_day_favorites_trainer
  ON public.trainer_diet_day_favorites (trainer_id, created_at DESC);

-- RLS
ALTER TABLE public.diet_day_favorites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_diet_day_favorites ENABLE ROW LEVEL SECURITY;

-- 기존 정책 있으면 제거
DROP POLICY IF EXISTS "p5_all" ON public.diet_day_favorites;
DROP POLICY IF EXISTS "p5_all" ON public.trainer_diet_day_favorites;

-- 회원 본인 + 담당 트레이너 CRUD (다른 식단 테이블들과 동일 패턴)
CREATE POLICY "p5_all" ON public.diet_day_favorites FOR ALL TO authenticated
  USING (public.is_self_member(member_id) OR public.is_my_member(member_id))
  WITH CHECK (public.is_self_member(member_id) OR public.is_my_member(member_id));

-- 트레이너 본인만 CRUD
CREATE POLICY "p5_all" ON public.trainer_diet_day_favorites FOR ALL TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT polname, cmd FROM pg_policy
--   WHERE polrelid IN ('public.diet_day_favorites'::regclass,
--                      'public.trainer_diet_day_favorites'::regclass);
