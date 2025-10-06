-- Migration: Drop email_threads table
-- Date: 2025-10-06
-- Purpose: Remove unused email_threads table - using threadId field in emails table instead

-- Drop the table and its enum
DROP TABLE IF EXISTS email_threads CASCADE;
DROP TYPE IF EXISTS email_thread_status_enum;

-- Remove any orphaned indexes (if they still exist)
DROP INDEX IF EXISTS email_threads_workspace_id_idx;
DROP INDEX IF EXISTS email_threads_lead_id_idx;
DROP INDEX IF EXISTS email_threads_last_activity_idx;

-- Add comment explaining the change
COMMENT ON COLUMN emails.thread_id IS 'Thread identifier for grouping related emails. Replaces the need for a separate email_threads table.';

-- Migration complete
-- Note: threadId in emails table provides all necessary threading functionality
