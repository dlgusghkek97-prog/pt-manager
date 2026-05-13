# 베타 배포 직전 체크리스트

외부 사용자(5~10명 베타) 풀기 **직전에** 반드시 처리해야 할 보안·법적 항목 모음.

---

## 🔐 보안 (Phase 5.4b — 미완)

### service_role 키 재발급
- [ ] 현재 service_role JWT 키가 2026-05-13 채팅 로그에 노출됨 (Vault 이전 트리거 함수에 하드코딩된 키)
- [ ] [Supabase Dashboard → Project Settings → API → JWT Keys](https://supabase.com/dashboard/project/mdlsbypeqmddoreeztnb/settings/api) 에서 회전 (또는 새 secret key 발급)
- [ ] [db/2026-05-13-phase5-4-vault-secrets.sql](db/2026-05-13-phase5-4-vault-secrets.sql) 파일 끝의 **[업데이트 SQL]** 블록으로 Vault 의 키 갱신
- [ ] 옛 키 회전한 경우 anon 키도 함께 갱신됨 → `src/supabase.js` 환경변수 (`REACT_APP_SUPABASE_ANON_KEY`):
  - 로컬: `.env.local`
  - Vercel: [Project Settings → Environment Variables](https://vercel.com/dashboard) → 변경 후 재배포
- [ ] 푸시 알림·채팅 통신 테스트해서 새 키 정상 작동 확인

### 자체 SMTP 연결 (필수)
- [ ] Supabase 기본 SMTP 는 시간당 4건 정도 한도 → 사용자 늘면 가입·비번 재설정 메일이 막힘
- [ ] 외부 메일 서비스 가입 (추천: [Resend](https://resend.com) — 무료 3000/월·100/일, 또는 SendGrid, NHN Cloud, Brevo)
- [ ] API Key 받고 [Authentication → Email Templates → SMTP Settings](https://supabase.com/dashboard/project/mdlsbypeqmddoreeztnb/auth/templates) 의 [Set up SMTP] 에 host·port·user·password 입력
- [ ] 자체 도메인 메일 보내려면 도메인 인증(DNS SPF/DKIM) 필요. 베타엔 onboarding 도메인으로 시작 가능

### RLS 정책 점검
- [x] 23개 public 테이블 RLS ON 완료 (Phase 5.3)
- [ ] `diet_favorites` / `trainer_diet_favorites` 의 임시 "allow all" 정책을 회원·트레이너 소유 패턴으로 좁히기 (다른 식단 테이블들과 동일하게)

---

## 📜 법적 (Phase 3 — 미시작)

- [ ] 약관 페이지 작성 (서비스 이용약관)
- [ ] 개인정보 처리방침 작성
- [ ] 회원가입/로그인 시 동의 체크박스 UI
- [ ] 트레이너 회원가입 시 사업자 정보(선택) 또는 동의

---

## 💳 결제 (Phase 2 — 선택, 무료 베타면 생략)

- [ ] 토스페이먼츠 연동
- [ ] PT 세션 결제 흐름

---

## 🎬 영상 정책 (Phase 4 — 미시작)

- [ ] 영상 30일 자동 삭제 cron job
- [ ] 영상 1건 100MB 상한 (업로드 시 검사)

---

## 🧪 베타 사용자 안내

- [ ] 베타 사용자에게 안내문 (PWA 설치 방법, 푸시 알림 권한)
- [ ] 오류 보고 채널 (카톡 또는 채팅)
- [ ] 트레이너 1명 + 회원 5~10명 규모로 시작
- [ ] 2~4주 모니터링 후 정식 출시 결정
