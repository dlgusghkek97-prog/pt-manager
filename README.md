# PT Manager

트레이너와 회원을 위한 **운동·식단·인바디 기록 + 코칭 채팅** PWA. React + Supabase 기반.

배포: https://pt-manager-v2.vercel.app

---

## 주요 기능

- 트레이너 ↔ 회원 1:1 매칭 (코드 + 이름으로 회원 접속)
- 운동/식단 기록 (입력칸을 벗어나면 자동 저장 — 별도 저장 버튼 없음)
- 인바디 측정 입력·추이 차트 (체중·골격근량·체지방률)
- 4대 종목 PR + 3대 중량 합계
- 1:1 채팅 + 푸시 알림 (PWA — 홈 화면 추가 시 잠금화면 푸시)
- 식단 즐겨찾기 (자주 먹는 식사 프리셋)
- 회원 메모 (트레이너 전용, 카테고리 분류)

---

## 기술 스택

| Layer | 사용 기술 |
|---|---|
| Frontend | React 18 (CRA), PWA (Service Worker) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime + Vault) |
| 배포 | Vercel |
| 푸시 | Web Push + Supabase Edge Function `rapid-function` |

---

## 개발

```bash
npm install
npm start            # http://localhost:3000
npm run build        # 프로덕션 빌드
```

`.env.local` 필요:
```
REACT_APP_SUPABASE_URL=https://<project>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=...
REACT_APP_VAPID_PUBLIC_KEY=...
```

---

## DB 마이그레이션

[db/](db/) 폴더에 날짜순으로 SQL 파일 존재. 새 환경 셋업 시 순서대로 Supabase SQL Editor 에서 실행:

1. `2026-05-13-meal-slots-favorites.sql` — 식단 슬롯 가변화 + 즐겨찾기 + 중복 청소
2. `2026-05-13-phase5-rls-policies.sql` — 23개 테이블 RLS 정책 + `claim_member` RPC
3. `2026-05-13-phase5-4-vault-secrets.sql` — service_role 키를 Vault 로 이동
4. `2026-05-13-phase4-media-cleanup.sql` — 미디어 30일 자동 삭제 (pg_cron)

---

## 베타 운영

베타 풀기 전 체크리스트: [BETA_CHECKLIST.md](BETA_CHECKLIST.md)
트레이너 베타 운영 가이드: [BETA_GUIDE.md](BETA_GUIDE.md)

---

## 라이선스

운영자 사유 — 외부 공개 전 별도 라이선스 명시 예정.
