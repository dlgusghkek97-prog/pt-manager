-- =========================================
-- PT Manager · 2026-05-13
-- 체지방률(%) 컬럼 추가 — BMR 공식의 LBM 직접 계산용
--
-- LBM = weight × (1 - body_fat / 100)   ← bodyFat 입력 시
-- LBM = muscle × 1.4                     ← fallback (기존)
-- BMR = 370 + 21.6 × LBM
-- =========================================

ALTER TABLE public.members  ADD COLUMN IF NOT EXISTS macro_body_fat numeric(5,2);
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS macro_body_fat numeric(5,2);

NOTIFY pgrst, 'reload schema';
