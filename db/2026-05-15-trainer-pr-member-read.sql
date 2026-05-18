-- =========================================================
-- PT Manager · 2026-05-15
-- 회원이 담당 트레이너의 4대 종목 PR(trainer_personal_records)을
-- 읽을 수 있도록 SELECT RLS 정책 갱신
--
-- 기존 p5_select: trainer_id = auth.uid()
-- 갱신       : trainer_id = auth.uid()  OR  is_my_trainer(trainer_id)
--
-- INSERT/UPDATE/DELETE 는 그대로 트레이너 본인만.
-- =========================================================

DROP POLICY IF EXISTS p5_select ON public.trainer_personal_records;

CREATE POLICY p5_select ON public.trainer_personal_records
  FOR SELECT
  TO authenticated
  USING (
    trainer_id = auth.uid()
    OR public.is_my_trainer(trainer_id)
  );

NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT polname, polcmd FROM pg_policy
--   WHERE polrelid = 'public.trainer_personal_records'::regclass;
