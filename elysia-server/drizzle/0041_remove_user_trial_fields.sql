-- Remove trial-related fields from users table
-- Trial status is now managed by subscriptions table
-- Migration created: 2025-12-23

-- Step 1: Drop index
DROP INDEX IF EXISTS "users_trial_active_idx";

-- Step 2: Drop columns (safe to drop - data is migrated to subscriptions)
ALTER TABLE "users" DROP COLUMN IF EXISTS "trial_start_date";
ALTER TABLE "users" DROP COLUMN IF EXISTS "trial_end_date";
ALTER TABLE "users" DROP COLUMN IF EXISTS "is_trial_active";

-- Note: No data migration needed as subscriptions are already created
-- on signup via workspace.service.ts createTrialSubscription()
