-- =========================================================
-- PT Manager · 2026-05-15
-- 트레이너 운영시간 (스케줄에서 회원 신청 가능 시간대 제한)
--
-- · trainers.business_hours jsonb
-- · 구조: { "0": null, "1": [9,22], "2": [9,22], ..., "6": [10,18] }
--   · key = 요일 (0=일, 1=월, ..., 6=토; JavaScript Date.getDay() 기준)
--   · value = null   → 휴무
--             [start_hour, end_hour] → start_hour 부터 end_hour 직전까지 운영
--   · 컬럼 NULL = 전체 시간 운영 (제약 없음)
-- =========================================================

ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS business_hours jsonb;

-- 회원 INSERT 시 운영시간 위반 차단 — 서버측 가드
CREATE OR REPLACE FUNCTION public.check_class_session_business_hours()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bh jsonb;
  v_dow int;
  v_hour int;
  v_range jsonb;
  v_start int;
  v_end int;
BEGIN
  -- 회원이 만든 신청만 검사 (트레이너 본인은 자유)
  IF NEW.status <> 'requested' OR NEW.created_by <> NEW.member_id THEN
    RETURN NEW;
  END IF;

  SELECT business_hours INTO v_bh
    FROM public.trainers WHERE id = NEW.trainer_id;

  IF v_bh IS NULL THEN
    RETURN NEW;  -- 미설정 = 제약 없음
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

DROP TRIGGER IF EXISTS trg_class_session_business_hours ON public.class_sessions;
CREATE TRIGGER trg_class_session_business_hours
  BEFORE INSERT OR UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.check_class_session_business_hours();

NOTIFY pgrst, 'reload schema';
