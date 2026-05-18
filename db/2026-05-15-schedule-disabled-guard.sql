-- =========================================================
-- PT Manager · 2026-05-15
-- 트레이너 schedule_enabled=false 일 때 회원 신청 차단 (서버측 가드)
--
-- 기존 check_class_session_business_hours 트리거 함수를 확장.
-- · 트레이너 schedule_enabled=false → 회원 신청 즉시 차단
-- · 그 외엔 운영시간 가드 그대로
-- =========================================================

CREATE OR REPLACE FUNCTION public.check_class_session_business_hours()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bh jsonb;
  v_dow int;
  v_hour int;
  v_range jsonb;
  v_start int;
  v_end int;
  v_sched_on boolean;
BEGIN
  -- 회원이 만든 신청만 검사 (트레이너 본인은 자유)
  IF NEW.status <> 'requested' OR NEW.created_by <> NEW.member_id THEN
    RETURN NEW;
  END IF;

  -- 트레이너 스케줄 기능 OFF 이면 차단
  SELECT schedule_enabled, business_hours
    INTO v_sched_on, v_bh
    FROM public.trainers WHERE id = NEW.trainer_id;

  IF v_sched_on IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'schedule_disabled' USING ERRCODE = 'P0001';
  END IF;

  IF v_bh IS NULL THEN
    RETURN NEW;
  END IF;

  v_dow := EXTRACT(DOW FROM (NEW.start_at AT TIME ZONE 'Asia/Seoul'));
  v_hour := EXTRACT(HOUR FROM (NEW.start_at AT TIME ZONE 'Asia/Seoul'));
  v_range := v_bh -> v_dow::text;

  IF v_range IS NULL OR v_range = 'null'::jsonb THEN
    RAISE EXCEPTION 'business_hours_closed' USING ERRCODE = 'P0001';
  END IF;

  v_start := (v_range ->> 0)::int;
  v_end   := (v_range ->> 1)::int;

  IF v_hour < v_start OR v_hour >= v_end THEN
    RAISE EXCEPTION 'business_hours_outside' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $$;

NOTIFY pgrst, 'reload schema';
