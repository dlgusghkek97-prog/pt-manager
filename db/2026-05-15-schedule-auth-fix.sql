-- =========================================================
-- PT Manager · 2026-05-15
-- 스케줄 RLS / RPC / 트리거 — members.auth_user_id 기반으로 정정
--
-- 기존 정책/함수가 members.id = auth.uid() 로 비교했는데
-- 실제 회원 인증 uid 는 members.auth_user_id 컬럼.
-- 모든 회원 측 정책/함수를 auth_user_id 기준으로 재정의.
-- =========================================================

-- 1) RPC: member_request_class — auth_user_id 로 본인 members 조회
CREATE OR REPLACE FUNCTION public.member_request_class(
  p_start_at timestamptz,
  p_end_at   timestamptz,
  p_note     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_trainer_id uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL THEN
    RAISE EXCEPTION 'missing_time';
  END IF;
  IF p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'end_before_start';
  END IF;

  SELECT id, trainer_id INTO v_member_id, v_trainer_id
    FROM public.members
   WHERE auth_user_id = auth.uid();

  IF v_member_id IS NULL OR v_trainer_id IS NULL THEN
    RAISE EXCEPTION 'no_trainer_linked';
  END IF;

  INSERT INTO public.class_sessions (
    trainer_id, member_id, start_at, end_at, status, note, created_by
  ) VALUES (
    v_trainer_id, v_member_id, p_start_at, p_end_at, 'requested', p_note, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.member_request_class(timestamptz, timestamptz, text)
  TO authenticated;

-- 2) class_sessions 회원 측 RLS 정책 재정의
DROP POLICY IF EXISTS p_cs_member_select ON public.class_sessions;
DROP POLICY IF EXISTS p_cs_member_insert ON public.class_sessions;
DROP POLICY IF EXISTS p_cs_member_update ON public.class_sessions;
DROP POLICY IF EXISTS p_cs_member_delete ON public.class_sessions;

-- 회원 SELECT — 본인의 담당 트레이너 슬롯 모두 조회
CREATE POLICY p_cs_member_select ON public.class_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_user_id = auth.uid()
        AND m.trainer_id = public.class_sessions.trainer_id
    )
  );

-- 회원 INSERT — RPC 우선, 직접 INSERT 도 허용 (id 매핑은 members 조회)
CREATE POLICY p_cs_member_insert ON public.class_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'requested'
    AND created_by = auth.uid()
    AND member_id IN (
      SELECT id FROM public.members WHERE auth_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_user_id = auth.uid()
        AND m.trainer_id = public.class_sessions.trainer_id
    )
  );

-- 회원 UPDATE — 본인 신청 슬롯만
CREATE POLICY p_cs_member_update ON public.class_sessions
  FOR UPDATE TO authenticated
  USING (
    member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    AND status IN ('requested','changed')
  )
  WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    AND status IN ('requested','changed','cancelled')
  );

-- 회원 DELETE — 본인 신청 슬롯만
CREATE POLICY p_cs_member_delete ON public.class_sessions
  FOR DELETE TO authenticated
  USING (
    member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    AND status IN ('requested','changed','cancelled')
  );

-- 3) business_hours / schedule_disabled 가드 트리거 — created_by 비교 제거
--    (회원의 created_by = auth.uid 이고 member_id = members.id 라 두 값이 달라
--     기존 'created_by <> member_id 면 패스' 조건이 잘못 작동)
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
  v_is_member_request boolean;
BEGIN
  -- 회원이 만든 신청만 검사 — created_by 의 회원 row 가 존재하면 회원 신청
  v_is_member_request := EXISTS (
    SELECT 1 FROM public.members
    WHERE auth_user_id = NEW.created_by
  );
  IF NEW.status <> 'requested' OR NOT v_is_member_request THEN
    RETURN NEW;
  END IF;

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

-- 4) 신청 알림 트리거 — created_by != member_id 조건 제거
CREATE OR REPLACE FUNCTION public.notify_class_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_name text;
  v_when text;
  v_is_member_request boolean;
BEGIN
  v_is_member_request := EXISTS (
    SELECT 1 FROM public.members
    WHERE auth_user_id = NEW.created_by
  );
  IF NEW.status = 'requested' AND v_is_member_request THEN
    SELECT name INTO v_member_name FROM public.members WHERE id = NEW.member_id;
    v_when := to_char(NEW.start_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI');
    INSERT INTO public.notifications (recipient_type, recipient_id, sender_type, sender_id, kind, content, link)
    VALUES (
      'trainer', NEW.trainer_id, 'member', NEW.member_id,
      'class_request',
      COALESCE(v_member_name, '회원') || ' 회원이 ' || v_when || ' 수업을 신청했어요',
      'schedule:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END $$;

NOTIFY pgrst, 'reload schema';

-- 확인
--   SELECT polname FROM pg_policy WHERE polrelid='public.class_sessions'::regclass;
--   SELECT proname FROM pg_proc WHERE proname IN ('member_request_class','check_class_session_business_hours','notify_class_request');
