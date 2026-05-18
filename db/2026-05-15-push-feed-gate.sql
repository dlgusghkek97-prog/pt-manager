-- =========================================================
-- PT Manager · 2026-05-15
-- "일지 피드 알림" 토글이 OFF 인 수신자에게는 푸시 발송 스킵
--
-- · notifications insert 시 호출되는 trigger_send_push_notification 을
--   recipient_type/recipient_id 의 notif_feed_enabled 를 확인하도록 갱신.
-- · 대상 kind 는 일지·식단 일상 알림 ('today_complete', 'diet_feedback').
--   PT 잔여 알림(pt_low_5/10), 인바디·시스템 알림 등은 영향 없음.
-- · 알림 row 자체는 그대로 insert 됨 → 종(🔔) 목록에는 보임. 푸시만 차단.
-- =========================================================

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
  v_feed_enabled boolean;
BEGIN
  -- "일지 피드" 카테고리 알림이면 수신자 토글 확인
  IF NEW.kind IN ('today_complete', 'diet_feedback') THEN
    IF NEW.recipient_type = 'trainer' THEN
      SELECT notif_feed_enabled INTO v_feed_enabled
        FROM public.trainers WHERE id = NEW.recipient_id;
    ELSIF NEW.recipient_type = 'member' THEN
      SELECT notif_feed_enabled INTO v_feed_enabled
        FROM public.members WHERE id = NEW.recipient_id;
    END IF;

    -- 컬럼이 명시적으로 false 일 때만 스킵 (NULL/기본 true 는 그대로 발송)
    IF v_feed_enabled IS FALSE THEN
      RETURN NEW;
    END IF;
  END IF;

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

NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT proname FROM pg_proc
--   WHERE proname = 'trigger_send_push_notification'
--     AND pronamespace = 'public'::regnamespace;
