-- =========================================
-- PT Manager · 2026-05-13 · Phase 5.2
-- 헬퍼 함수 + claim_member RPC + 전체 테이블 RLS 정책
--
-- ★ 이 SQL 실행만으로는 앱 동작이 바뀌지 않음 (RLS 자체는 켜지 않음).
--   정책만 박아두고, 5.3 단계에서 테이블별로 ENABLE ROW LEVEL SECURITY 하면서 테스트.
-- =========================================

-- =========================================
-- 1) 헬퍼 함수 (SECURITY DEFINER — 정책 내부에서 재귀 회피)
-- =========================================
CREATE OR REPLACE FUNCTION public.is_my_member(_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = _member_id AND trainer_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_self_member(_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = _member_id AND auth_user_id = auth.uid()
  )
$$;

-- 대화방 참여자 확인
CREATE OR REPLACE FUNCTION public.is_my_conv(_conv_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conv_id
      AND (c.trainer_id = auth.uid() OR public.is_self_member(c.member_id))
  )
$$;

-- 알림/푸시 user_id 매칭 (트레이너 = auth.uid / 회원 = members.id)
CREATE OR REPLACE FUNCTION public.is_my_user_id(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id = auth.uid() OR public.is_self_member(_user_id)
$$;

GRANT EXECUTE ON FUNCTION public.is_my_member(uuid)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_self_member(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_conv(uuid)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_user_id(uuid)  TO anon, authenticated;

-- =========================================
-- 2) RPC: 회원 클레임 (code + name 검증 후 auth_user_id 세팅)
--    직접 UPDATE 대신 이 함수로만 auth_user_id 변경되도록.
-- =========================================
CREATE OR REPLACE FUNCTION public.claim_member(code_input text, name_input text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no auth session';
  END IF;

  UPDATE public.members
     SET auth_user_id = auth.uid()
   WHERE upper(code) = upper(code_input)
     AND name = name_input
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'code or name mismatch';
  END IF;

  RETURN v_id;
END
$$;
GRANT EXECUTE ON FUNCTION public.claim_member(text, text) TO anon, authenticated;

-- =========================================
-- 3) 기존 정책 일괄 제거 (RLS 켜질 때 충돌 방지)
--    public 스키마의 모든 policy 를 깨끗이 비우고 새로 정의.
-- =========================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS sn, c.relname AS tn, p.polname AS pn
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.pn, r.sn, r.tn);
  END LOOP;
END $$;

-- =========================================
-- 4) 정책 정의
--    명명 규칙: p5_select / p5_insert / p5_update / p5_delete / p5_all
--    TO authenticated — 익명(anon)은 거부. 회원은 익명 Auth로 인증됨.
-- =========================================

-- ── members ──
-- SELECT/UPDATE: 본인(auth_user_id) 또는 담당 트레이너(trainer_id)
-- INSERT/DELETE: 트레이너만
CREATE POLICY "p5_select" ON public.members FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR trainer_id = auth.uid());
CREATE POLICY "p5_insert" ON public.members FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "p5_update" ON public.members FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR trainer_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid() OR trainer_id = auth.uid());
CREATE POLICY "p5_delete" ON public.members FOR DELETE TO authenticated
  USING (trainer_id = auth.uid());

-- ── trainers ──
-- 본인 + 본인의 회원이 트레이너 정보 조회 가능
CREATE POLICY "p5_select" ON public.trainers FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR id IN (SELECT trainer_id FROM public.members WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "p5_insert" ON public.trainers FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "p5_update" ON public.trainers FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "p5_delete" ON public.trainers FOR DELETE TO authenticated
  USING (id = auth.uid());

-- ── 회원 소유 (본인 + 담당 트레이너 모두 CRUD 가능) ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workout_logs', 'diet_logs', 'diet_feedback',
    'personal_records', 'member_favorite_exercises',
    'member_inbody', 'diet_favorites'
  ] LOOP
    EXECUTE format(
      $f$CREATE POLICY "p5_all" ON public.%I FOR ALL TO authenticated
        USING (public.is_self_member(member_id) OR public.is_my_member(member_id))
        WITH CHECK (public.is_self_member(member_id) OR public.is_my_member(member_id))$f$,
      t
    );
  END LOOP;
END $$;

-- ── 메모/카테고리 (트레이너 전용 — 회원에게 안 보임) ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['member_notes', 'member_note_categories'] LOOP
    EXECUTE format(
      $f$CREATE POLICY "p5_all" ON public.%I FOR ALL TO authenticated
        USING (public.is_my_member(member_id))
        WITH CHECK (public.is_my_member(member_id))$f$,
      t
    );
  END LOOP;
END $$;

-- ── 트레이너 소유 (본인만) ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'trainer_workout_logs', 'trainer_diet_logs', 'trainer_diet_feedback',
    'trainer_favorite_exercises', 'trainer_personal_records', 'trainer_diet_favorites'
  ] LOOP
    EXECUTE format(
      $f$CREATE POLICY "p5_all" ON public.%I FOR ALL TO authenticated
        USING (trainer_id = auth.uid())
        WITH CHECK (trainer_id = auth.uid())$f$,
      t
    );
  END LOOP;
END $$;

-- ── trainer_inbody (트레이너 CRUD, 회원은 자기 측정값 SELECT) ──
CREATE POLICY "p5_select" ON public.trainer_inbody FOR SELECT TO authenticated
  USING (trainer_id = auth.uid() OR public.is_self_member(member_id));
CREATE POLICY "p5_insert" ON public.trainer_inbody FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "p5_update" ON public.trainer_inbody FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "p5_delete" ON public.trainer_inbody FOR DELETE TO authenticated
  USING (trainer_id = auth.uid());

-- ── conversations (대화 참여자 양쪽 모두) ──
CREATE POLICY "p5_all" ON public.conversations FOR ALL TO authenticated
  USING (trainer_id = auth.uid() OR public.is_self_member(member_id))
  WITH CHECK (trainer_id = auth.uid() OR public.is_self_member(member_id));

-- ── messages (대화방 참여자만 / 본인이 발신자만 INSERT) ──
CREATE POLICY "p5_select" ON public.messages FOR SELECT TO authenticated
  USING (public.is_my_conv(conversation_id));
CREATE POLICY "p5_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_my_conv(conversation_id) AND public.is_my_user_id(sender_id));
CREATE POLICY "p5_update" ON public.messages FOR UPDATE TO authenticated
  USING (public.is_my_conv(conversation_id))
  WITH CHECK (public.is_my_conv(conversation_id));
CREATE POLICY "p5_delete" ON public.messages FOR DELETE TO authenticated
  USING (public.is_my_user_id(sender_id));

-- ── notifications (수신자 SELECT/UPDATE/DELETE / 발신자 INSERT) ──
CREATE POLICY "p5_select" ON public.notifications FOR SELECT TO authenticated
  USING (public.is_my_user_id(recipient_id));
CREATE POLICY "p5_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (sender_id IS NULL OR public.is_my_user_id(sender_id));
CREATE POLICY "p5_update" ON public.notifications FOR UPDATE TO authenticated
  USING (public.is_my_user_id(recipient_id))
  WITH CHECK (public.is_my_user_id(recipient_id));
CREATE POLICY "p5_delete" ON public.notifications FOR DELETE TO authenticated
  USING (public.is_my_user_id(recipient_id));

-- ── push_subscriptions (본인 user_id 만) ──
CREATE POLICY "p5_all" ON public.push_subscriptions FOR ALL TO authenticated
  USING (public.is_my_user_id(user_id))
  WITH CHECK (public.is_my_user_id(user_id));

-- ── feedbacks (legacy — member_id + trainer_id 양쪽 검사) ──
CREATE POLICY "p5_all" ON public.feedbacks FOR ALL TO authenticated
  USING (public.is_self_member(member_id) OR trainer_id = auth.uid())
  WITH CHECK (public.is_self_member(member_id) OR trainer_id = auth.uid());

-- =========================================
-- 5) 권한 + 캐시 리로드
-- =========================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =========================================
-- 6) 확인 쿼리 (참고용 — 정책 개수가 표시되면 성공)
-- =========================================
-- 실행 시 23 row 정도, 각 테이블마다 p5_* 정책 1~4 개 보여야 함
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_now,
  (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname AND p.policyname LIKE 'p5_%') AS p5_policies
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT LIKE 'pg_%'
ORDER BY c.relname;
