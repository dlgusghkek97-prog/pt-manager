-- =========================================================
-- PT Manager · 2026-06-02
-- 마스터 운영 현황 통계 RPC
--
-- 마스터(운영자) 가 SubscriptionModal 에서 호출.
-- 트레이너 / 회원 수, 플랜별 분포, 매출 / 환불, DB / Storage 사용량 일괄 반환.
-- 인프라 비용은 외부 청구라 클라이언트에서 상수로 관리.
-- =========================================================

CREATE OR REPLACE FUNCTION public.master_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start timestamptz := date_trunc('month', now());
  v_result jsonb;
  v_trainer_status jsonb;
  v_trainer_plan jsonb;
BEGIN
  IF NOT public.is_admin_trainer(auth.uid()) THEN
    RAISE EXCEPTION 'master_only';
  END IF;

  -- 트레이너 상태별 분포
  SELECT COALESCE(jsonb_object_agg(COALESCE(status,'unknown'), cnt), '{}'::jsonb) INTO v_trainer_status
  FROM (SELECT status, count(*) AS cnt FROM public.trainer_subscriptions GROUP BY status) sub;

  -- 결제중 트레이너의 플랜별 분포
  SELECT COALESCE(jsonb_object_agg(COALESCE(plan_code,'unknown'), cnt), '{}'::jsonb) INTO v_trainer_plan
  FROM (SELECT plan_code, count(*) AS cnt FROM public.trainer_subscriptions WHERE status='active' GROUP BY plan_code) sub;

  SELECT jsonb_build_object(
    -- 트레이너
    'trainer_total',      (SELECT count(*) FROM public.trainers),
    'trainer_by_status',  v_trainer_status,
    'trainer_by_plan',    v_trainer_plan,

    -- 회원
    'member_total',       (SELECT count(*) FROM public.members),

    -- 매출 (status='success' 행의 amount 합)
    'revenue_month',      (SELECT COALESCE(sum(amount),0) FROM public.trainer_billing_history
                            WHERE status='success' AND created_at >= v_month_start),
    'revenue_total',      (SELECT COALESCE(sum(amount),0) FROM public.trainer_billing_history
                            WHERE status='success'),

    -- 환불 (status='refunded' 행의 amount 합. amount 는 음수로 저장됨 → 부호 반전해 양수로)
    'refunded_month',     (SELECT COALESCE(-sum(amount),0) FROM public.trainer_billing_history
                            WHERE status='refunded' AND created_at >= v_month_start),
    'refunded_total',     (SELECT COALESCE(-sum(amount),0) FROM public.trainer_billing_history
                            WHERE status='refunded'),

    -- DB / Storage 용량
    'db_size_bytes',      pg_database_size(current_database()),
    'storage_bytes',      (SELECT COALESCE(sum((metadata->>'size')::bigint), 0) FROM storage.objects),

    -- 보조 카운트
    'class_session_count', (SELECT count(*) FROM public.class_sessions),
    'workout_log_count',   (SELECT count(*) FROM public.workout_logs),
    'diet_log_count',      (SELECT count(*) FROM public.diet_logs),

    'generated_at',       now()
  ) INTO v_result;

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.master_dashboard_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- 검증:
-- SELECT public.master_dashboard_stats();
