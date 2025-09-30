-- workflow_generated_emails 테이블 생성
-- 각 고객사별로 생성된 이메일을 저장

CREATE TABLE IF NOT EXISTS workflow_generated_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL, -- React Flow 노드 ID (예: 'email-1234567890')
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  -- 생성된 이메일 내용
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  
  -- 생성 정보
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- 'pending': 대기중
  -- 'generating': AI 생성중
  -- 'generated': AI 생성 완료
  -- 'edited': 사용자가 수정함
  -- 'failed': 생성 실패
  
  generation_mode VARCHAR(50) NOT NULL DEFAULT 'manual',
  -- 'ai': AI 자동 생성
  -- 'manual': 수동 작성
  -- 'template': 템플릿 기반
  
  ai_prompt TEXT, -- AI 생성 시 사용된 프롬프트
  ai_model VARCHAR(100), -- 사용된 AI 모델 (예: 'gpt-4', 'gpt-3.5-turbo')
  generation_error TEXT, -- 에러 메시지
  
  -- 컨텍스트 스냅샷 (생성 당시 고객 정보)
  context_snapshot JSONB DEFAULT '{}'::jsonb,
  -- { "companyName": "ABC Corp", "industry": "IT", "contactName": "John Doe", ... }
  
  -- 타임스탬프
  generated_at TIMESTAMP,
  edited_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 유니크 제약: 같은 시퀀스, 같은 노드, 같은 lead에는 하나의 이메일만
  UNIQUE(sequence_id, node_id, lead_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_workflow_emails_sequence_node 
  ON workflow_generated_emails(sequence_id, node_id);

CREATE INDEX IF NOT EXISTS idx_workflow_emails_status 
  ON workflow_generated_emails(status);

CREATE INDEX IF NOT EXISTS idx_workflow_emails_lead 
  ON workflow_generated_emails(lead_id);

-- 코멘트
COMMENT ON TABLE workflow_generated_emails IS '워크플로우 노드별로 생성된 개별 이메일 데이터';
COMMENT ON COLUMN workflow_generated_emails.node_id IS 'React Flow 워크플로우의 노드 ID';
COMMENT ON COLUMN workflow_generated_emails.generation_mode IS 'AI 자동 생성, 수동 작성, 또는 템플릿 기반';
COMMENT ON COLUMN workflow_generated_emails.context_snapshot IS '생성 시점의 고객 정보 스냅샷 (JSON)';
