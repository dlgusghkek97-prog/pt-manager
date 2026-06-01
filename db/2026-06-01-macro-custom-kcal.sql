-- =========================================================
-- PT Manager · 2026-06-01
-- 자가설정 칼로리 조정 컬럼
--
-- 기존엔 macro_intensity 가 '완만'/'일반'/'공격적' 3종 (각각 ±300/400/500 등 프리셋).
-- 사용자가 직접 ± kcal 을 입력하고 싶은 경우를 위해 자가설정 모드 추가.
-- macro_intensity = '자가설정' 일 때만 macro_custom_kcal 값을 사용 (절댓값으로 저장,
-- 부호는 goal 에 따라 자동 결정: 벌크업=+, 다이어트=-).
-- =========================================================

ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS macro_custom_kcal int;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS macro_custom_kcal int;

COMMENT ON COLUMN public.trainers.macro_custom_kcal IS
  'macro_intensity=''자가설정'' 일 때 사용할 칼로리 조정 절댓값. 부호는 goal 로 결정.';
COMMENT ON COLUMN public.members.macro_custom_kcal IS
  'macro_intensity=''자가설정'' 일 때 사용할 칼로리 조정 절댓값. 부호는 goal 로 결정.';

NOTIFY pgrst, 'reload schema';

-- 검증:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name IN ('trainers','members') AND column_name='macro_custom_kcal';
-- → 2 rows
