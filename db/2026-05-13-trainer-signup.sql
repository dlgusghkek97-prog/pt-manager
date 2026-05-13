-- =========================================
-- PT Manager · 2026-05-13 · 트레이너 가입
--
-- 변경 이력:
-- 1차 시도: auth.users INSERT 트리거로 trainers row 자동 생성 → 환경에 따라
--   'Database error saving new user' 발생 (원인 불명). 트리거 제거 후 클라이언트
--   측에서 가입/로그인 직후 trainers.upsert 호출로 처리하는 방식이 더 안정적.
-- =========================================

-- 이전에 만든 트리거가 있으면 제거 (없어도 무해)
DROP TRIGGER IF EXISTS on_auth_user_created_trainer ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_trainer_signup();

-- 클라이언트(App.js trainerSignup / trainerLogin)에서 다음을 호출:
--
-- await supabase.from('trainers').upsert(
--   { id: <auth.uid>, name, email, phone },
--   { onConflict: 'id', ignoreDuplicates: true }
-- )
--
-- RLS 정책 trainers.INSERT WITH CHECK (id = auth.uid()) 통과 → 본인 row 만 생성 가능.
-- ignoreDuplicates: 이미 있으면 skip → 매 로그인마다 안전하게 호출 가능.
