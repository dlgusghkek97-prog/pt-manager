-- =========================================
-- PT Manager · 2026-05-13
-- trainers 테이블에 macro_* 컬럼 추가 — members 와 동일 구조로 정렬
--
-- 기존엔 macro_occupation, target_calories/carbs/protein/fat 만 있었음.
-- 회원 화면이 트레이너의 weight/muscle/bodyFat 까지 읽어 일일 소비 계산하므로
-- 모든 macro_* 컬럼을 trainers 에도 채워줘야 함.
-- =========================================

ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS macro_weight    numeric(5,2),
  ADD COLUMN IF NOT EXISTS macro_muscle    numeric(5,2),
  ADD COLUMN IF NOT EXISTS macro_body_fat  numeric(5,2),
  ADD COLUMN IF NOT EXISTS macro_activity  text,
  ADD COLUMN IF NOT EXISTS macro_intensity text,
  ADD COLUMN IF NOT EXISTS macro_cycle     text,
  ADD COLUMN IF NOT EXISTS goal            text,
  ADD COLUMN IF NOT EXISTS gender          text;

NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='trainers'
--     AND column_name LIKE 'macro%';
