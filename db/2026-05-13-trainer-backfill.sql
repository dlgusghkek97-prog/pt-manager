-- =========================================
-- PT Manager · 2026-05-13
-- 1) auth.users 에는 있는데 trainers 에 없는 트레이너 일괄 백필
-- 2) 새 가입 시 자동 생성 트리거 부활 (EXCEPTION 처리로 가입 절대 안 막힘)
-- =========================================

-- 1) 백필 — auth.users 에 있고 이메일 있는 사용자 중 trainers row 없는 것 채움
INSERT INTO public.trainers (id, name, email, phone)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)),
  u.email,
  NULLIF(trim(u.raw_user_meta_data->>'phone'), '')
FROM auth.users u
LEFT JOIN public.trainers t ON t.id = u.id
WHERE u.email IS NOT NULL
  AND u.email <> ''
  AND t.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2) 트리거 부활 — EXCEPTION 처리로 어떤 에러가 나도 가입 자체는 통과
CREATE OR REPLACE FUNCTION public.handle_new_trainer_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.trainers (id, name, email, phone)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
      NEW.email,
      NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- 어떤 에러든 가입 자체는 통과시킴 (실패해도 클라이언트가 첫 로그인 때 trainerLogin 안에서 upsert 로 보완)
    RAISE WARNING '[trainer_signup_trigger] %, %', SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_trainer ON auth.users;

CREATE TRIGGER on_auth_user_created_trainer
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_trainer_signup();

-- 확인: 백필 결과 + 트리거 등록
SELECT count(*) AS trainer_count FROM public.trainers;
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created_trainer';
