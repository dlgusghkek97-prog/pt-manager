-- =========================================
-- PT Manager · 2026-05-13
-- 식단 슬롯 가변화 + 즐겨찾기 + 중복 행 청소
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 [RUN] 1회 실행.
-- 순서 중요 — 끊지 말고 한 번에 실행할 것.
-- =========================================

-- 1) 기존 중복 식단 행 정리 (같은 회원·날짜·식사구분으로 여러 행이 쌓여 합계가 두 번 더해지던 문제)
--    각 (member_id, log_date, meal_type) 조합에서 가장 마지막 id 1건만 남기고 나머지는 삭제.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY member_id, log_date, meal_type ORDER BY id DESC) AS rn
  FROM diet_logs
)
DELETE FROM diet_logs WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY trainer_id, log_date, meal_type ORDER BY id DESC) AS rn
  FROM trainer_diet_logs
)
DELETE FROM trainer_diet_logs WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) slot 컬럼 추가 (식사 순서)
ALTER TABLE diet_logs         ADD COLUMN IF NOT EXISTS slot int;
ALTER TABLE trainer_diet_logs ADD COLUMN IF NOT EXISTS slot int;

-- 3) 기존 meal_type ('breakfast'/'lunch'/'dinner'/'snack') 을 한글 이름으로 + slot 채우기
--    같은 UPDATE 안에서 좌변은 모두 OLD 값을 봄(Postgres) → CASE 의 meal_type 도 변경 전 값을 가리킴.
UPDATE diet_logs SET
  slot = COALESCE(slot, CASE meal_type
    WHEN 'breakfast' THEN 1
    WHEN 'lunch'     THEN 2
    WHEN 'dinner'    THEN 3
    WHEN 'snack'     THEN 4
    ELSE 5
  END),
  meal_type = CASE meal_type
    WHEN 'breakfast' THEN '아침'
    WHEN 'lunch'     THEN '점심'
    WHEN 'dinner'    THEN '저녁'
    WHEN 'snack'     THEN '간식'
    ELSE meal_type
  END;

UPDATE trainer_diet_logs SET
  slot = COALESCE(slot, CASE meal_type
    WHEN 'breakfast' THEN 1
    WHEN 'lunch'     THEN 2
    WHEN 'dinner'    THEN 3
    WHEN 'snack'     THEN 4
    ELSE 5
  END),
  meal_type = CASE meal_type
    WHEN 'breakfast' THEN '아침'
    WHEN 'lunch'     THEN '점심'
    WHEN 'dinner'    THEN '저녁'
    WHEN 'snack'     THEN '간식'
    ELSE meal_type
  END;

-- 4) 식단 즐겨찾기 테이블 (회원 / 트레이너 각각)
CREATE TABLE IF NOT EXISTS diet_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL,
  name        text NOT NULL,
  carbs       real DEFAULT 0,
  protein     real DEFAULT 0,
  fat         real DEFAULT 0,
  calories    int  DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS diet_favorites_member_id_idx ON diet_favorites(member_id);

CREATE TABLE IF NOT EXISTS trainer_diet_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  uuid NOT NULL,
  name        text NOT NULL,
  carbs       real DEFAULT 0,
  protein     real DEFAULT 0,
  fat         real DEFAULT 0,
  calories    int  DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trainer_diet_favorites_trainer_id_idx ON trainer_diet_favorites(trainer_id);
