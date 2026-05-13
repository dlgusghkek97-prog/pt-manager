-- =========================================
-- PT Manager · 2026-05-13 · 트레이너 자동 가입
-- auth.users 에 새 이메일 사용자 INSERT 되면 public.trainers row 자동 생성
-- =========================================

CREATE OR REPLACE FUNCTION public.handle_new_trainer_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 회원의 익명 Auth(signInAnonymously)는 email 이 NULL/빈 문자열 → skip
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  -- 트레이너 row 생성. signUp options.data 의 name 이 있으면 사용, 없으면 이메일을 임시 이름으로.
  INSERT INTO public.trainers (id, name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END $$;

-- 기존 트리거 있으면 정리하고 재등록
DROP TRIGGER IF EXISTS on_auth_user_created_trainer ON auth.users;

CREATE TRIGGER on_auth_user_created_trainer
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_trainer_signup();

-- 확인: 트리거 1건 등록
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created_trainer';
