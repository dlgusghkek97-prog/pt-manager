-- =========================================================
-- PT Manager · 2026-05-26
-- PT 내역 추적 — 충전 / 차감 / 환불 모든 트랜잭션 로그
-- =========================================================

CREATE TABLE IF NOT EXISTS public.pt_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  trainer_id        uuid NOT NULL REFERENCES public.trainers(id),
  action            text NOT NULL CHECK (action IN ('add', 'use', 'refund', 'manual_adjust')),
  delta             int  NOT NULL,                          -- +N (추가) / -N (차감) / +1 (환불)
  reason            text,                                   -- 'attendance' / 'no_show' / 'cancel_refund' / 'charge' / 'manual'
  class_session_id  uuid REFERENCES public.class_sessions(id) ON DELETE SET NULL,
  total_after       int,                                    -- 적용 후 총 등록 횟수
  used_after        int,                                    -- 적용 후 사용 횟수
  remaining_after   int,                                    -- 적용 후 잔여 (편의용)
  created_by        uuid REFERENCES auth.users(id),         -- 작업자 (트레이너 본인 또는 system)
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_history_member  ON public.pt_history (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pt_history_trainer ON public.pt_history (trainer_id, created_at DESC);

-- RLS
ALTER TABLE public.pt_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_pth_select ON public.pt_history;
CREATE POLICY p_pth_select ON public.pt_history FOR SELECT TO authenticated
  USING (
    trainer_id = auth.uid()                    -- 담당 트레이너
    OR public.is_self_member(member_id)        -- 본인 회원
  );

-- INSERT 는 헬퍼 RPC 로만 (정책 없음 = block direct insert from anon)
-- service_role 키는 별도 (RLS 우회)

-- 헬퍼 RPC — usePtSession / refundPtSession / addPtSessions 가 호출
CREATE OR REPLACE FUNCTION public.log_pt_history(
  p_member_id        uuid,
  p_action           text,
  p_delta            int,
  p_reason           text DEFAULT NULL,
  p_class_session_id uuid DEFAULT NULL,
  p_total_after      int  DEFAULT NULL,
  p_used_after       int  DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_id uuid;
  v_id uuid;
  v_remaining int;
BEGIN
  SELECT trainer_id INTO v_trainer_id FROM public.members WHERE id = p_member_id;
  IF v_trainer_id IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;

  v_remaining := GREATEST(0, COALESCE(p_total_after, 0) - COALESCE(p_used_after, 0));

  INSERT INTO public.pt_history (
    member_id, trainer_id, action, delta, reason, class_session_id,
    total_after, used_after, remaining_after, created_by
  ) VALUES (
    p_member_id, v_trainer_id, p_action, p_delta, p_reason, p_class_session_id,
    p_total_after, p_used_after, v_remaining, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.log_pt_history(uuid, text, int, text, uuid, int, int) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- 검증:
--   SELECT count(*) FROM public.pt_history;
--   SELECT polname FROM pg_policy WHERE polrelid='public.pt_history'::regclass;
--   SELECT proname FROM pg_proc WHERE proname='log_pt_history';
