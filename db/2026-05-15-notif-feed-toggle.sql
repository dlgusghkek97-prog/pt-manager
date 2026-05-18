-- =========================================================
-- PT Manager · 2026-05-15
-- 설정 페이지 — "일지 피드 알림" 별도 토글 컬럼 추가
--
-- · trainers / members 두 테이블에 notif_feed_enabled boolean
-- · 기본값 true (기존 사용자도 기본 ON)
-- · 푸시 전송 측에서 이 컬럼 false 면 일지 관련 알림 스킵
-- =========================================================

ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS notif_feed_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS notif_feed_enabled boolean NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT column_name, column_default
--   FROM information_schema.columns
--   WHERE table_schema='public'
--     AND column_name='notif_feed_enabled'
--     AND table_name IN ('trainers','members');
