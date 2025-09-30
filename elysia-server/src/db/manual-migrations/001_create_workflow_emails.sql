-- workflow_generated_emails 테이블 및 enum 생성

-- enum 타입 생성
DO $$ BEGIN
  CREATE TYPE workflow_email_status_enum AS ENUM ('pending', 'generating', 'generated', 'edited', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE generation_mode_enum AS ENUM ('ai', 'manual', 'template');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- workflow_generated_emails 테이블 생성
CREATE TABLE IF NOT EXISTS workflow_generated_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  
  status workflow_email_status_enum NOT NULL DEFAULT 'pending',
  generation_mode generation_mode_enum NOT NULL DEFAULT 'manual',
  
  ai_prompt TEXT,
  ai_model VARCHAR(100),
  generation_error TEXT,
  
  context_snapshot JSONB DEFAULT '{}'::jsonb,
  
  generated_at TIMESTAMP WITH TIME ZONE,
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 유니크 제약 추가
DO $$ BEGIN
  ALTER TABLE workflow_generated_emails 
    ADD CONSTRAINT workflow_emails_sequence_node_lead_unique 
    UNIQUE (sequence_id, node_id, lead_id);
EXCEPTION
  WHEN duplicate_table THEN null;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS workflow_emails_sequence_node_idx 
  ON workflow_generated_emails(sequence_id, node_id);

CREATE INDEX IF NOT EXISTS workflow_emails_status_idx 
  ON workflow_generated_emails(status);

CREATE INDEX IF NOT EXISTS workflow_emails_lead_idx 
  ON workflow_generated_emails(lead_id);

-- 코멘트 추가
COMMENT ON TABLE workflow_generated_emails IS '워크플로우 노드별로 생성된 개별 이메일 데이터';
COMMENT ON COLUMN workflow_generated_emails.node_id IS 'React Flow 워크플로우의 노드 ID';
COMMENT ON COLUMN workflow_generated_emails.generation_mode IS 'AI 자동 생성, 수동 작성, 또는 템플릿 기반';
COMMENT ON COLUMN workflow_generated_emails.context_snapshot IS '생성 시점의 고객 정보 스냅샷 (JSON)';
