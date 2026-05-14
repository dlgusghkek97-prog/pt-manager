# 베타 배포 직전 체크리스트

외부 사용자(5~10명 베타) 풀기 **직전에** 반드시 처리해야 할 항목 모음.

---

## 🚨 0. DB 마이그레이션 통합 실행 (필수)

**한 번에 다 실행**: Supabase Dashboard → SQL Editor →
[`db/2026-05-14-CONSOLIDATED.sql`](db/2026-05-14-CONSOLIDATED.sql) 내용을 통째로 붙여넣고 Run.

반복 실행해도 안전 (idempotent: `IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS`).

**포함 항목**
1. `trainers` 에 `macro_*` 컬럼 (체중·골격근량·체지방률 등 9개)
2. `members.macro_body_fat` (체지방률)
3. `diet_day_favorites / trainer_diet_day_favorites` (일일 식단 즐겨찾기) + RLS
4. `is_my_trainer` 헬퍼 + `trainer_workout_logs / trainer_diet_logs` SELECT 회원 허용
5. `is_admin_trainer` + `can_add_member` 마스터 우회
6. 구독 v2 (`member_limit` + `create_trial_for_new_trainer`)

**검증** — SQL 마지막 SELECT 결과가 모두 정상값이면 OK:
| 컬럼 | 기대값 |
|---|---|
| `trainers_macro_cols` | 9 |
| `members_body_fat_col` | 1 |
| `day_fav_tables` | 2 |
| `core_functions` | 5 |
| `trainer_logs_select_policies` | 2 |

---

## 🔐 1. 보안 (Phase 5.4b — 미완)

### service_role 키 재발급
- [ ] 현재 service_role JWT 키가 2026-05-13 채팅 로그에 노출됨
- [ ] [Supabase Dashboard → Settings → API → JWT Keys](https://supabase.com/dashboard/project/mdlsbypeqmddoreeztnb/settings/api) 회전
- [ ] [db/2026-05-13-phase5-4-vault-secrets.sql](db/2026-05-13-phase5-4-vault-secrets.sql) 의 업데이트 SQL 로 Vault 갱신
- [ ] anon 키도 변경됐다면 `.env.local` + Vercel env 갱신
- [ ] 푸시·채팅 동작 확인

### 자체 SMTP 연결 (필수)
- [ ] Supabase 기본 SMTP 는 시간당 4건 한도
- [ ] [Resend](https://resend.com) 무료 (3000/월·100/일) 가입 → API Key → [Auth → SMTP Settings](https://supabase.com/dashboard/project/mdlsbypeqmddoreeztnb/auth/templates)
- [ ] (선택) 자체 도메인 SPF/DKIM 인증

### RLS 정책 점검
- [x] 23개 public 테이블 RLS ON (Phase 5.3)
- [x] trainer_workout_logs/trainer_diet_logs SELECT — 본인 담당 회원 허용 (통합 SQL 포함)
- [ ] `diet_favorites / trainer_diet_favorites` 임시 "allow all" → 본인 소유 패턴으로 좁히기

---

## 📜 2. 법적 (Phase 3 — 완료 ✅)

- [x] 약관 / 개인정보 처리방침 / 환불 정책 작성 ([src/legal.js](src/legal.js))
- [x] LegalModal — terms / privacy / refund 분기
- [x] 가입·로그인·접속 3곳 모두 동의 체크박스 + 미동의 시 버튼 비활성
- [x] `localStorage.pt_agreed_${TERMS_VERSION}` 영구 저장 (버전 변경 시 재동의)

---

## 💳 3. 결제 (Phase 2 — 베타엔 비활성)

- [x] 트레이너 SaaS 구독 모델 (Starter / Standard / Pro · 30일 트라이얼)
- [x] 회원 한도 검사 RPC (`can_add_member`)
- [x] 운영자(마스터) 계정 `dlgusghkek97@gmail.com` 우회
- [x] 환불 정책 표시 + 환불 신청 (mailto)
- [ ] **사업자등록 승인 후** 토스페이먼츠 가맹점 가입 → 실 결제 연동
- [ ] 베타 기간 동안에는 무료 체험 유지

---

## 🎬 4. 영상·미디어 (Phase 4 — 완료 ✅)

- [x] 1건 100MB 상한 — `MAX_MEDIA_BYTES` + `checkMediaSize` (4곳 적용)
- [x] 30일 자동 삭제 cron — [db/2026-05-13-phase4-media-cleanup.sql](db/2026-05-13-phase4-media-cleanup.sql)
  - 확인: `SELECT * FROM cron.job WHERE jobname = 'cleanup-old-media';`
- [x] 트레이너 미디어 갤러리 (TrainerMediaGallery) — 회원이 트레이너 사진·영상 모아보기

---

## 🧪 5. 베타 사용자 안내

- [ ] PWA 설치 방법 + 푸시 알림 권한 안내문 (`README.md` / `BETA_GUIDE.md` 참고)
- [ ] 오류 보고 채널: **dlgusghkek97@gmail.com**
- [ ] 트레이너 1명 + 회원 5~10명 규모로 시작
- [ ] 2~4주 모니터링 후 정식 출시 결정

---

## 🩺 6. 출시 직전 스모크 테스트

마스터 계정 (`dlgusghkek97@gmail.com`) 로 로그인 후:

1. **헤더 배너** — 다크그린 "마스터 · 무제한"
2. **회원 관리 → + 회원 추가** — 가입·코드 발급
3. **회원 상세 → 운동 / 식단 / 인바디** — 각 탭 진입 확인
4. **내 기록 → 식단 설정** — 체중·골격근량·체지방률 입력 → 계산·저장 통과 확인
5. **로그아웃 → 회원으로 접속코드 입력 → 로그인**
6. **회원 → 내 트레이너 → 운동/식단/미디어** — 트레이너 기록 read-only 열람 확인
7. **회원 → 일일 즐겨찾기 → 저장·적용** 사이클 확인

위 항목 모두 에러 메시지 없이 통과하면 베타 풀어도 OK.
