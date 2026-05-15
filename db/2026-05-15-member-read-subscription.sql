-- =========================================================
-- PT Manager · 2026-05-15
-- 회원이 본인 담당 트레이너의 trainer_subscriptions SELECT 허용
--
-- 기존 정책: trainer_id = auth.uid() (트레이너 본인만)
-- 변경: 회원이 본인 담당 트레이너의 구독 상태를 읽어야 SubscriptionGate 가
--       만료 차단 화면을 정확히 띄울 수 있음.
-- INSERT/UPDATE/DELETE 는 그대로 트레이너 본인 + service_role 만.
-- =========================================================

DROP POLICY IF EXISTS p5_select ON public.trainer_subscriptions;

CREATE POLICY p5_select ON public.trainer_subscriptions FOR SELECT TO authenticated
  USING (
    trainer_id = auth.uid()
    OR public.is_my_trainer(trainer_id)
  );

NOTIFY pgrst, 'reload schema';

-- 확인:
--   SELECT polname, cmd, pg_get_expr(polqual, polrelid) AS using_expr
--   FROM pg_policy WHERE polrelid='public.trainer_subscriptions'::regclass AND polname='p5_select';
