-- =========================================================
-- PT Manager · 2026-05-15
-- 4대 종목 PR 카드에 영상/사진 첨부 + 30일 자동삭제 예외
--
-- 1) personal_records / trainer_personal_records 에 media_url 컬럼
-- 2) cleanup_old_media() 함수를 수정 — storage 객체 이름이 'pr/' 로
--    시작하면 삭제 제외 (PR 영상은 영구 보존)
-- =========================================================

ALTER TABLE public.personal_records         ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.trainer_personal_records ADD COLUMN IF NOT EXISTS media_url text;

-- cleanup_old_media() 재정의 — pr/ prefix 인 storage 객체 보존
CREATE OR REPLACE FUNCTION public.cleanup_old_media()
RETURNS TABLE(scope text, deleted_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  cutoff timestamptz := now() - interval '30 days';
  v_count int;
BEGIN
  UPDATE public.workout_logs
     SET media_url = NULL
   WHERE media_url IS NOT NULL
     AND created_at < cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  scope := 'workout_logs.media_url'; deleted_count := v_count; RETURN NEXT;

  UPDATE public.diet_logs
     SET media_url = NULL
   WHERE media_url IS NOT NULL
     AND created_at < cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  scope := 'diet_logs.media_url'; deleted_count := v_count; RETURN NEXT;

  UPDATE public.messages
     SET media_url = NULL
   WHERE media_url IS NOT NULL
     AND created_at < cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  scope := 'messages.media_url'; deleted_count := v_count; RETURN NEXT;

  -- storage 객체 삭제 — 단, 이름이 'pr/' 로 시작하는 PR 영상은 영구 보존
  DELETE FROM storage.objects
   WHERE bucket_id = 'workout-media'
     AND created_at < cutoff
     AND name NOT LIKE 'pr/%';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  scope := 'storage.objects (pr/ excluded)'; deleted_count := v_count; RETURN NEXT;
END $$;

NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='personal_records' AND column_name='media_url';
