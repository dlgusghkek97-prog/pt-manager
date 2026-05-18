-- =========================================================
-- PT Manager · 2026-05-15
-- 회원 PT 신청을 RPC 함수로 처리 — RLS 매칭 우회.
--
-- 회원이 직접 INSERT 시 RLS WITH CHECK 에서 트레이너 매칭 (members.trainer_id
-- = class_sessions.trainer_id) 이 케이스에 따라 실패하는 문제를 회피.
-- 함수 안에서 auth.uid() 의 members.trainer_id 를 조회하여 INSERT.
-- 트레이너 schedule_enabled / business_hours 가드 트리거는 그대로 작동.
-- =========================================================

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

  SELECT trainer_id INTO v_trainer_id
    FROM public.members
   WHERE id = auth.uid();

  IF v_trainer_id IS NULL THEN
    RAISE EXCEPTION 'no_trainer_linked';
  END IF;

  INSERT INTO public.class_sessions (
    trainer_id, member_id, start_at, end_at, status, note, created_by
  ) VALUES (
    v_trainer_id, auth.uid(), p_start_at, p_end_at, 'requested', p_note, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.member_request_class(timestamptz, timestamptz, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
