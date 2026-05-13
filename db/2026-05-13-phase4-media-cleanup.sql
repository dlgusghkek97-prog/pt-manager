-- =========================================
-- PT Manager · 2026-05-13 · Phase 4
-- 30일 지난 미디어 자동 삭제
--
-- 적용:
-- 1) 이 SQL 한 번 실행 (확장 + 함수 + cron 등록)
-- 2) 확인 쿼리로 cron job 등록 확인
-- =========================================

-- 1) pg_cron 확장 (Supabase 기본 제공, 활성화만)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) 30일 지난 미디어 청소 함수
--    - DB: workout_logs / diet_logs / messages 의 media_url 을 NULL 로
--    - Storage: workout-media 버킷의 30일 이상 된 객체 행 DELETE
--    (storage.objects 행 삭제 시 Supabase 가 실제 파일도 함께 제거)
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

  -- storage 객체 삭제 (실제 파일도 함께 제거됨)
  DELETE FROM storage.objects
   WHERE bucket_id = 'workout-media'
     AND created_at < cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  scope := 'storage.objects'; deleted_count := v_count; RETURN NEXT;
END $$;

-- 3) 매일 1회 자동 실행 (KST 04:00 = UTC 19:00)
--    이미 같은 이름의 job 이 있으면 unschedule 후 재등록
DO $$
DECLARE v_id int;
BEGIN
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'cleanup-old-media';
  IF v_id IS NOT NULL THEN PERFORM cron.unschedule(v_id); END IF;
END $$;

SELECT cron.schedule(
  'cleanup-old-media',
  '0 19 * * *',
  $$ SELECT public.cleanup_old_media(); $$
);

-- 4) 확인 (job 1건 등록 + 즉시 한 번 실행해서 결과 확인)
SELECT jobid, schedule, command, jobname FROM cron.job WHERE jobname = 'cleanup-old-media';

-- 즉시 한 번 실행 (현재 30일 이상 된 데이터가 있으면 청소됨)
SELECT * FROM public.cleanup_old_media();
