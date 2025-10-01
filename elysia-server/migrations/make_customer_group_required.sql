-- Make customer_group_id NOT NULL for sequences
-- 기존 NULL 값이 있는 경우 먼저 처리

-- Step 1: 기존 NULL 값 확인 및 임시 처리
-- (프로덕션에서는 실제 고객그룹을 할당하거나 삭제 필요)
UPDATE sequences 
SET customer_group_id = (SELECT id FROM customer_groups LIMIT 1)
WHERE customer_group_id IS NULL
  AND EXISTS (SELECT 1 FROM customer_groups LIMIT 1);

-- Step 2: NOT NULL 제약 조건 추가
-- 주의: 고객그룹이 하나도 없는 경우 실패할 수 있음
-- ALTER TABLE sequences 
-- ALTER COLUMN customer_group_id SET NOT NULL;

-- Note: 이 마이그레이션은 선택적으로 적용
-- 기존 데이터에 영향을 주므로 주의 필요

