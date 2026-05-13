-- =========================================
-- PT Manager · 2026-05-13 · 트레이너 구독 (SaaS 사용료)
--
-- 모델:
--  - 가입 후 30일 무료 체험 (trial)
--  - 트라이얼 만료 → 결제하면 active, 안 하면 expired
--  - 결제는 토스페이먼츠 (사업자등록·토스 가맹점 가입 후 연동)
--
-- 이 SQL 단계에서는 테이블/트리거/RLS 까지만. 실제 결제 처리는 추후.
-- =========================================

CREATE TABLE IF NOT EXISTS public.trainer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL UNIQUE REFERENCES public.trainers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'trial',
  -- trial | active | expired | cancelled
  plan_code text NOT NULL DEFAULT 'monthly_9900',
  plan_amount int NOT NULL DEFAULT 9900,
  trial_started_at timestamptz DEFAULT now(),
  trial_expires_at timestamptz DEFAULT (now() + interval '30 days'),
  paid_started_at timestamptz,
  paid_expires_at timestamptz,
  billing_key text,
  last_payment_id text,
  last_payment_at timestamptz,
  last_payment_amount int,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1) 기존 트레이너에게 trial 백필 (가입 일자 기준)
INSERT INTO public.trainer_subscriptions
  (trainer_id, status, trial_started_at, trial_expires_at)
SELECT
  t.id,
  CASE
    WHEN (t.created_at + interval '30 days') > now() THEN 'trial'
    ELSE 'expired'
  END,
  t.created_at,
  t.created_at + interval '30 days'
FROM public.trainers t
WHERE NOT EXISTS (
  SELECT 1 FROM public.trainer_subscriptions s WHERE s.trainer_id = t.id
);

-- 2) 새 트레이너 INSERT 시 자동으로 trial row 생성
CREATE OR REPLACE FUNCTION public.create_trial_for_new_trainer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trainer_subscriptions
    (trainer_id, status, trial_started_at, trial_expires_at)
  VALUES (NEW.id, 'trial', now(), now() + interval '30 days')
  ON CONFLICT (trainer_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_trial_for_new_trainer] %, %', SQLSTATE, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_trainer_insert_trial ON public.trainers;
CREATE TRIGGER on_trainer_insert_trial
AFTER INSERT ON public.trainers
FOR EACH ROW
EXECUTE FUNCTION public.create_trial_for_new_trainer();

-- 3) RLS — 본인 구독만 SELECT/UPDATE 가능 (INSERT/DELETE 는 트리거/관리자가 처리)
ALTER TABLE public.trainer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p5_select ON public.trainer_subscriptions;
DROP POLICY IF EXISTS p5_update ON public.trainer_subscriptions;

CREATE POLICY p5_select ON public.trainer_subscriptions FOR SELECT TO authenticated
  USING (trainer_id = auth.uid());
CREATE POLICY p5_update ON public.trainer_subscriptions FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

GRANT ALL ON public.trainer_subscriptions TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- 확인
SELECT t.name, t.email, s.status,
       to_char(s.trial_expires_at, 'YYYY-MM-DD') AS trial_until,
       to_char(s.paid_expires_at, 'YYYY-MM-DD') AS paid_until
FROM public.trainers t
LEFT JOIN public.trainer_subscriptions s ON s.trainer_id = t.id
ORDER BY t.created_at;
