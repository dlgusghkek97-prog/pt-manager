-- =========================================
-- PT Manager · 2026-05-13
-- 회원이 본인 담당 트레이너의 운동/식단 기록을 SELECT 할 수 있도록 RLS 완화
--
-- 변경:
-- 1) is_my_trainer(trainer_uuid) 헬퍼 추가 — 호출자가 회원이고 _trainer_id 가
--    본인 담당 트레이너이면 true.
-- 2) trainer_workout_logs / trainer_diet_logs 의 기존 "p5_all" 통합 정책을
--    SELECT(트레이너+회원) + 변경(트레이너만) 두 정책으로 분리.
--
-- INSERT/UPDATE/DELETE 는 여전히 트레이너 본인만. 회원은 읽기만 됨.
-- =========================================

-- 1) 헬퍼
CREATE OR REPLACE FUNCTION public.is_my_trainer(_trainer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE auth_user_id = auth.uid()
      AND trainer_id = _trainer_id
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_my_trainer(uuid) TO anon, authenticated;

-- 2) trainer_workout_logs — 기존 p5_all 제거 → split
DROP POLICY IF EXISTS "p5_all" ON public.trainer_workout_logs;

CREATE POLICY "p5_select" ON public.trainer_workout_logs FOR SELECT TO authenticated
  USING (trainer_id = auth.uid() OR public.is_my_trainer(trainer_id));

CREATE POLICY "p5_insert" ON public.trainer_workout_logs FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "p5_update" ON public.trainer_workout_logs FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "p5_delete" ON public.trainer_workout_logs FOR DELETE TO authenticated
  USING (trainer_id = auth.uid());

-- 3) trainer_diet_logs — 동일
DROP POLICY IF EXISTS "p5_all" ON public.trainer_diet_logs;

CREATE POLICY "p5_select" ON public.trainer_diet_logs FOR SELECT TO authenticated
  USING (trainer_id = auth.uid() OR public.is_my_trainer(trainer_id));

CREATE POLICY "p5_insert" ON public.trainer_diet_logs FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "p5_update" ON public.trainer_diet_logs FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "p5_delete" ON public.trainer_diet_logs FOR DELETE TO authenticated
  USING (trainer_id = auth.uid());

NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT polname, cmd FROM pg_policy
--   WHERE polrelid IN ('public.trainer_workout_logs'::regclass, 'public.trainer_diet_logs'::regclass)
--   ORDER BY polname;
