-- Add unique constraint to prevent duplicate group memberships
-- This ensures a lead can only be added to a group once

-- Step 1: Remove any existing duplicates (if any)
DELETE FROM customer_group_members a
USING customer_group_members b
WHERE a.id < b.id
  AND a.group_id = b.group_id
  AND a.lead_id = b.lead_id;

-- Step 2: Add unique constraint
ALTER TABLE customer_group_members
ADD CONSTRAINT unique_group_lead UNIQUE (group_id, lead_id);

-- Comment
COMMENT ON CONSTRAINT unique_group_lead ON customer_group_members IS '같은 리드를 같은 그룹에 중복 추가 방지';

