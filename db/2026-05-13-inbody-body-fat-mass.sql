-- =========================================
-- PT Manager · 2026-05-13
-- 인바디 체지방량(body_fat_mass, kg) 컬럼 추가
-- =========================================

ALTER TABLE public.member_inbody  ADD COLUMN IF NOT EXISTS body_fat_mass numeric(6,2);
ALTER TABLE public.trainer_inbody ADD COLUMN IF NOT EXISTS body_fat_mass numeric(6,2);

NOTIFY pgrst, 'reload schema';
