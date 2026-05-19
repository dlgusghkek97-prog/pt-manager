-- =========================================================
-- PT Manager · 2026-05-19
-- 스케줄 슬롯 출석/결석 시 PT 차감 추적용 컬럼
--
-- · class_sessions.pt_charged : 이 슬롯으로 PT 1회가 이미 차감됐는지.
--   - 출석/결석(차감 선택) 처리 시 false→true + members.pt_used_sessions +1
--   - 취소/되돌리기 시 true 였으면 pt_used_sessions -1 + true→false
--   - 중복 차감 / 중복 복구 방지용 단일 기준값
-- =========================================================

ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS pt_charged boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='class_sessions' AND column_name='pt_charged';
