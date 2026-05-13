-- =========================================
-- PT Manager · 2026-05-13 · Phase 5.4
-- service_role 키 → Supabase Vault 이동
--
-- 적용 순서:
-- 1) 이 SQL 실행 (Vault 에 현재 키 저장 + 트리거 함수 두 개 교체)
-- 2) Supabase 대시보드 → Settings → API → "Reveal" 옆 "Generate new JWT secret"
--    (또는 JWT Keys → Rotate) 로 service_role 키 재발급
-- 3) 아래 [업데이트 SQL] 블록 한 줄 실행해서 Vault 의 키도 새 키로 교체
-- 4) 채팅·푸시 정상 동작 확인
-- =========================================

-- 1) Vault 확장 (이미 활성화돼있어도 무해)
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 2) 현재 service_role 키를 Vault 에 저장
--    이미 있으면 update, 없으면 create. 이름 'service_role_key' 로 통일.
DO $$
DECLARE
  v_existing_id uuid;
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kbHNieXBlcW1kZG9yZWV6dG5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzUyODY1OSwiZXhwIjoyMDkzMTA0NjU5fQ.jkaL2UKZX8wjiuXLZQEq40bBV4iATS90fXTkjkk7fIU';
BEGIN
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = 'service_role_key';
  IF v_existing_id IS NULL THEN
    PERFORM vault.create_secret(
      v_key,
      'service_role_key',
      'service_role JWT — DB 트리거가 Edge Function 호출 시 사용'
    );
  ELSE
    PERFORM vault.update_secret(v_existing_id, v_key);
  END IF;
END $$;

-- 3) 트리거 함수 두 개를 Vault 사용 버전으로 교체
--    (하드코딩 키 제거 → vault.decrypted_secrets 에서 조회)

CREATE OR REPLACE FUNCTION public.trigger_send_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, vault
AS $function$
DECLARE
  edge_function_url TEXT := 'https://mdlsbypeqmddoreeztnb.supabase.co/functions/v1/rapid-function';
  service_role_key TEXT;
  request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
   WHERE name = 'service_role_key';

  IF service_role_key IS NULL THEN
    RAISE WARNING '[trigger_send_push_notification] vault secret missing';
    RETURN NEW;
  END IF;

  SELECT INTO request_id net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[trigger_send_push_notification] error: %', SQLERRM;
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.trigger_send_chat_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, vault
AS $function$
DECLARE
  edge_function_url TEXT := 'https://mdlsbypeqmddoreeztnb.supabase.co/functions/v1/rapid-function';
  service_role_key TEXT;
  v_conv RECORD;
  v_recipient_id UUID;
  v_sender_other_id UUID;
  v_preview TEXT;
  request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
   WHERE name = 'service_role_key';

  IF service_role_key IS NULL THEN
    RAISE WARNING '[trigger_send_chat_push] vault secret missing';
    RETURN NEW;
  END IF;

  SELECT trainer_id, member_id INTO v_conv
  FROM conversations WHERE id = NEW.conversation_id;

  IF NEW.sender_type = 'trainer' THEN
    v_recipient_id := v_conv.member_id;
    v_sender_other_id := v_conv.trainer_id;
  ELSE
    v_recipient_id := v_conv.trainer_id;
    v_sender_other_id := v_conv.member_id;
  END IF;

  IF NEW.media_url IS NOT NULL THEN
    v_preview := '사진 1장';
  ELSE
    v_preview := COALESCE(LEFT(NEW.content, 30), '');
  END IF;

  SELECT INTO request_id net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', NEW.id,
        'recipient_id', v_recipient_id,
        'kind', 'chat_message',
        'content', v_preview,
        'link', 'chat:' || v_sender_other_id::text
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[trigger_send_chat_push] error: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 4) 확인 — secret 1건, 함수 2건 보여야 함
SELECT name, created_at FROM vault.secrets WHERE name = 'service_role_key';
SELECT proname FROM pg_proc
 WHERE proname IN ('trigger_send_push_notification', 'trigger_send_chat_push')
   AND pronamespace = 'public'::regnamespace;


-- =========================================
-- [업데이트 SQL]
-- 위 단계 끝나고 Supabase 대시보드에서 service_role 키 재발급한 뒤에만 실행.
-- '여기에-새-키-붙여넣기' 를 대시보드에서 복사한 새 service_role JWT 로 바꿔서 RUN.
-- =========================================
/*
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'service_role_key';
  PERFORM vault.update_secret(v_id, '여기에-새-키-붙여넣기');
END $$;
*/
