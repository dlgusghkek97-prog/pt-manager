-- =========================================================
-- PT Manager · 2026-05-24
-- 회원이 담당 트레이너의 즐겨찾기 운동(trainer_favorite_exercises)을
-- 읽을 수 있도록 SELECT RLS 정책 갱신
--
-- 배경: 회원이 "내 트레이너 → 운동 → PR" 탭 진입 시 트레이너의 즐겨찾기
--      기반 PR 추이 라인 차트를 보여줘야 하는데, 기존 p5_all 정책이
--      trainer_id = auth.uid() 만 허용해 회원이 빈 목록을 받던 문제.
--
-- 기존 p5_all (ALL command): trainer_id = auth.uid()
-- 갱신                 : SELECT 만 회원도 허용 (is_my_trainer)
--                        INSERT/UPDATE/DELETE 는 그대로 트레이너 본인만
-- =========================================================

DROP POLICY IF EXISTS p5_all ON public.trainer_favorite_exercises;

CREATE POLICY p5_select ON public.trainer_favorite_exercises
  FOR SELECT TO authenticated
  USING (
    trainer_id = auth.uid()
    OR public.is_my_trainer(trainer_id)
  );

CREATE POLICY p5_insert ON public.trainer_favorite_exercises
  FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY p5_update ON public.trainer_favorite_exercises
  FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY p5_delete ON public.trainer_favorite_exercises
  FOR DELETE TO authenticated
  USING (trainer_id = auth.uid());

NOTIFY pgrst, 'reload schema';

-- 검증:
--   SELECT polname, polcmd FROM pg_policy
--   WHERE polrelid = 'public.trainer_favorite_exercises'::regclass;
--   → p5_select / p5_insert / p5_update / p5_delete 4 rows
