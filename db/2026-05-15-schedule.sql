-- =========================================================
-- PT Manager · 2026-05-15
-- 스케줄 (수업·신청·OFF·노쇼) 테이블 + RLS + 토글 컬럼
--
-- · public.class_sessions : 트레이너 단위 슬롯
-- · trainers.schedule_enabled, members.schedule_enabled : 사용 여부 토글
-- · RLS
--   - 트레이너 : 본인 trainer_id 슬롯 ALL
--   - 회원     : 본인 트레이너의 슬롯 SELECT
--                + 본인 member_id = auth.uid() 인 'requested' INSERT
--                + 본인이 만든 'requested' 슬롯 UPDATE/DELETE
-- =========================================================

-- 0) 토글 컬럼 (기본 false — opt-in)
ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS schedule_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS schedule_enabled boolean NOT NULL DEFAULT false;

-- 1) 회원이 본인 트레이너의 schedule_enabled 를 읽을 수 있도록 트레이너 테이블 SELECT 정책 추가
--    (기존 정책이 있으면 보존, 추가 정책으로 RLS 통과)
DROP POLICY IF EXISTS p_members_read_my_trainer_schedule_flag ON public.trainers;
CREATE POLICY p_members_read_my_trainer_schedule_flag ON public.trainers
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()                       -- 트레이너 본인
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = auth.uid() AND m.trainer_id = public.trainers.id
    )
  );

-- 2) class_sessions 테이블
CREATE TABLE IF NOT EXISTS public.class_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  member_id   uuid REFERENCES public.members(id) ON DELETE SET NULL,
  start_at    timestamptz NOT NULL,
  end_at      timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'scheduled'
              CHECK (status IN ('scheduled','requested','changed','off','general','no_show','completed','cancelled')),
  note        text,
  created_by  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_sessions_trainer_start
  ON public.class_sessions (trainer_id, start_at);
CREATE INDEX IF NOT EXISTS idx_class_sessions_member_start
  ON public.class_sessions (member_id, start_at) WHERE member_id IS NOT NULL;

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

-- 3) RLS 정책
DROP POLICY IF EXISTS p_cs_trainer_all   ON public.class_sessions;
DROP POLICY IF EXISTS p_cs_member_select ON public.class_sessions;
DROP POLICY IF EXISTS p_cs_member_insert ON public.class_sessions;
DROP POLICY IF EXISTS p_cs_member_update ON public.class_sessions;
DROP POLICY IF EXISTS p_cs_member_delete ON public.class_sessions;

-- 트레이너 — 본인 trainer_id 슬롯 ALL
CREATE POLICY p_cs_trainer_all ON public.class_sessions
  FOR ALL TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- 회원 SELECT — 본인 트레이너의 슬롯 모두 (다른 회원의 슬롯도 시간이 차 있는지 확인 위해 보임)
CREATE POLICY p_cs_member_select ON public.class_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = auth.uid() AND m.trainer_id = public.class_sessions.trainer_id
    )
  );

-- 회원 INSERT — 본인 트레이너 + member_id=auth.uid() + status='requested' 만
CREATE POLICY p_cs_member_insert ON public.class_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND status = 'requested'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = auth.uid() AND m.trainer_id = public.class_sessions.trainer_id
    )
  );

-- 회원 UPDATE — 본인이 만든 requested 만 (시간 변경/취소)
CREATE POLICY p_cs_member_update ON public.class_sessions
  FOR UPDATE TO authenticated
  USING (
    member_id = auth.uid()
    AND status IN ('requested','changed')
  )
  WITH CHECK (
    member_id = auth.uid()
    AND status IN ('requested','changed','cancelled')
  );

-- 회원 DELETE — 본인이 만든 requested/changed 만
CREATE POLICY p_cs_member_delete ON public.class_sessions
  FOR DELETE TO authenticated
  USING (
    member_id = auth.uid()
    AND status IN ('requested','changed','cancelled')
  );

-- 4) updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.touch_class_sessions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_class_sessions_updated_at ON public.class_sessions;
CREATE TRIGGER trg_class_sessions_updated_at
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_class_sessions_updated_at();

-- 5) 신청 알림 트리거 — 회원이 'requested' insert 시 트레이너에게 notifications row 작성
CREATE OR REPLACE FUNCTION public.notify_class_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_name text;
  v_when text;
BEGIN
  IF NEW.status = 'requested' AND NEW.created_by = NEW.member_id THEN
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

DROP TRIGGER IF EXISTS trg_class_request_notify ON public.class_sessions;
CREATE TRIGGER trg_class_request_notify
  AFTER INSERT ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.notify_class_request();

NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT count(*) FROM public.class_sessions;
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.class_sessions'::regclass;
