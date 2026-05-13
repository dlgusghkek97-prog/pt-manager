-- =========================================
-- PT Manager · 2026-05-13
-- 이메일 찾기 RPC (RLS 우회용 SECURITY DEFINER)
--
-- 사유: trainers SELECT 정책이 'id=auth.uid() OR 본인 회원의 트레이너만'
-- 으로 좁혀져 있어 로그인 전 상태에서 이메일 찾기를 위한 조회가 0건 반환됨.
-- 이 함수가 SECURITY DEFINER 로 RLS 를 우회하고, 결과는 마스킹된 이메일만 반환.
-- =========================================

CREATE OR REPLACE FUNCTION public.find_trainer_email(name_input text, phone_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_local text;
  v_domain text;
BEGIN
  IF name_input IS NULL OR phone_input IS NULL
     OR length(trim(name_input)) = 0 OR length(trim(phone_input)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT email INTO v_email
    FROM public.trainers
   WHERE name = trim(name_input)
     AND phone = trim(phone_input)
   LIMIT 1;

  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  v_local := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);

  RETURN substr(v_local, 1, 1)
       || repeat('*', greatest(length(v_local) - 1, 2))
       || '@'
       || v_domain;
END $$;

GRANT EXECUTE ON FUNCTION public.find_trainer_email(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
