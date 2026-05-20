-- =========================================================
-- PT Manager · 2026-05-20
-- 일일 운동 즐겨찾기 — 하루 전체 운동을 한 라벨로 묶어 저장·불러오기
--
-- exercises: jsonb 배열 — [{ slot, exercise_type, body_part, exercise_name,
--                           memo, description, sets: [{ weight, reps }] }, ...]
-- 회원·트레이너 분리 (트레이너 본인 기록용 별도 테이블).
-- =========================================================

CREATE TABLE IF NOT EXISTS public.workout_day_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  label       text NOT NULL,
  exercises   jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workout_day_fav_member ON public.workout_day_favorites (member_id);

CREATE TABLE IF NOT EXISTS public.trainer_workout_day_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  label       text NOT NULL,
  exercises   jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trainer_workout_day_fav_trainer
  ON public.trainer_workout_day_favorites (trainer_id);

ALTER TABLE public.workout_day_favorites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_workout_day_favorites  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_wdf_member  ON public.workout_day_favorites;
CREATE POLICY p_wdf_member ON public.workout_day_favorites
  FOR ALL TO authenticated
  USING (public.is_my_user_id(member_id))
  WITH CHECK (public.is_my_user_id(member_id));

DROP POLICY IF EXISTS p_twdf_trainer ON public.trainer_workout_day_favorites;
CREATE POLICY p_twdf_trainer ON public.trainer_workout_day_favorites
  FOR ALL TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

NOTIFY pgrst, 'reload schema';
