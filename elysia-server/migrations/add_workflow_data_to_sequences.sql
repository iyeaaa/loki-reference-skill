-- Add workflow_data column to sequences table
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS workflow_data TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN sequences.workflow_data IS 'JSON data for React Flow workflow (nodes and edges)';
