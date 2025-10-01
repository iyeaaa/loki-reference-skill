-- Workflow Enrollments table
CREATE TABLE IF NOT EXISTS workflow_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_email_account_id UUID NOT NULL REFERENCES user_email_accounts(id),
  
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  current_node_id VARCHAR(100),
  
  enrolled_at TIMESTAMP NOT NULL DEFAULT NOW(),
  enrolled_by UUID,
  first_email_sent_at TIMESTAMP,
  last_email_sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  paused_at TIMESTAMP,
  stopped_at TIMESTAMP,
  stopped_reason TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Workflow Execution Logs table
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  node_id VARCHAR(100) NOT NULL,
  node_type VARCHAR(50) NOT NULL,
  node_data TEXT,
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  result TEXT,
  error_message TEXT,
  
  generated_email_id UUID,
  email_id UUID,
  sent_at TIMESTAMP,
  
  scheduled_for TIMESTAMP,
  delay_days INTEGER,
  wait_started_at TIMESTAMP,
  wait_completed_at TIMESTAMP,
  replied_during_wait TIMESTAMP,
  
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_sequence ON workflow_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_lead ON workflow_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_status ON workflow_enrollments(status);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_enrollment ON workflow_execution_logs(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_sequence ON workflow_execution_logs(sequence_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_node ON workflow_execution_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_status ON workflow_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_scheduled ON workflow_execution_logs(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Comment on tables
COMMENT ON TABLE workflow_enrollments IS '워크플로우 등록 (sequence_enrollments와 별개)';
COMMENT ON TABLE workflow_execution_logs IS '워크플로우 노드 실행 로그';

