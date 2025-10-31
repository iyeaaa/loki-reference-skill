// 데이터베이스 스키마 정보 - Send Grinda 이메일 자동화 시스템
export const DATABASE_SCHEMA = `
# Send Grinda 데이터베이스 스키마 (완전판)

## 📊 시스템 개요

Send Grinda는 SendGrid 기반 B2B 이메일 자동화 플랫폼입니다.
- **핵심 기능**: 리드 관리, 이메일 시퀀스 자동화, 성과 분석, AI 기반 인사이트
- **사용자**: 영업팀, 마케팅팀
- **데이터베이스**: PostgreSQL 17.2

---

## 1. EMAILS 테이블 (이메일 발송 기록) ⭐ 가장 중요

**목적**: 모든 발송/수신 이메일 기록 및 성과 추적

\`\`\`sql
CREATE TABLE emails (
  id UUID PRIMARY KEY,

  -- 필수 필터 조건 (모든 쿼리에 반드시 포함)
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_email_account_id UUID NOT NULL REFERENCES user_email_accounts(id),

  -- 연관 관계
  lead_id UUID REFERENCES leads(id),              -- 어떤 리드에게 발송했는지
  sequence_id UUID REFERENCES sequences(id),      -- 어떤 시퀀스의 이메일인지
  step_id UUID REFERENCES sequence_steps(id),     -- 시퀀스의 몇 번째 단계인지

  -- 이메일 방향 및 기본 정보
  direction VARCHAR NOT NULL,                      -- 'outbound'(발송) 또는 'inbound'(수신)
  from_email VARCHAR(255) NOT NULL,                -- 발신자 이메일
  to_email VARCHAR(255) NOT NULL,                  -- 수신자 이메일
  cc_emails TEXT[],                                -- 참조
  bcc_emails TEXT[],                               -- 숨은참조

  subject VARCHAR(500),                            -- 이메일 제목
  body_text TEXT,                                  -- 텍스트 본문
  body_html TEXT,                                  -- HTML 본문
  raw_email TEXT,                                  -- RFC 822 형식 원본 (수신 이메일용)

  -- 이메일 상태 (중요!)
  status VARCHAR NOT NULL DEFAULT 'draft',
  /* 가능한 상태:
     - draft: 임시저장
     - scheduled: 예약됨
     - queued: 발송 대기 중
     - sent: 발송됨
     - delivered: 전달 완료 (SendGrid 확인)
     - opened: 오픈됨 (수신자가 이메일 열음)
     - clicked: 클릭됨 (링크 클릭)
     - replied: 답장 받음
     - bounced: 반송됨 (이메일 전달 실패)
     - failed: 발송 실패
     - spam: 스팸 신고됨
     - unsubscribed: 수신거부
  */

  -- ⏰ 타임스탬프 (성과 측정의 핵심)
  scheduled_at TIMESTAMP WITH TIME ZONE,           -- 발송 예정 시각
  sent_at TIMESTAMP WITH TIME ZONE,                -- 실제 발송 시각
  delivered_at TIMESTAMP WITH TIME ZONE,           -- 전달 완료 시각
  opened_at TIMESTAMP WITH TIME ZONE,              -- 최초 오픈 시각
  clicked_at TIMESTAMP WITH TIME ZONE,             -- 최초 클릭 시각
  replied_at TIMESTAMP WITH TIME ZONE,             -- 답장 받은 시각

  -- 📈 인게이지먼트 메트릭
  open_count INTEGER DEFAULT 0,                    -- 총 오픈 횟수 (여러 번 열 수 있음)
  click_count INTEGER DEFAULT 0,                   -- 총 클릭 횟수

  -- 💥 반송(Bounce) 정보
  bounce_type VARCHAR,                             -- 'soft'(일시적), 'hard'(영구), 'block'(차단)
  bounce_reason TEXT,                              -- 반송 사유 (예: "Mailbox full")
  error_message TEXT,                              -- 발송 실패 오류 메시지

  -- 🔗 스레딩 및 Message-ID
  message_id VARCHAR(500),                         -- 표준 이메일 Message-ID 헤더
  in_reply_to VARCHAR(500),                        -- 답장인 경우 원본 Message-ID
  thread_id VARCHAR(500),                          -- 스레드 그룹 ID
  sendgrid_message_id VARCHAR(500),                -- SendGrid 고유 메시지 ID

  -- 📊 비정규화 필드 (성능 최적화용 - JOIN 없이 조회 가능)
  lead_name VARCHAR(255),                          -- 리드 이름 (leads.contact_name 복사)
  lead_email VARCHAR(255),                         -- 리드 이메일 (빠른 필터링용)
  sequence_name VARCHAR(255),                      -- 시퀀스 이름 (sequences.name 복사)

  -- 🚫 수신거부 및 스팸
  unsubscribed_at TIMESTAMP WITH TIME ZONE,        -- 수신거부 시각
  spam_reported_at TIMESTAMP WITH TIME ZONE,       -- 스팸 신고 시각

  -- 🔄 재시도 로직
  retry_count INTEGER DEFAULT 0,                   -- 재시도 횟수
  last_retry_at TIMESTAMP WITH TIME ZONE,          -- 마지막 재시도 시각

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 (쿼리 성능 최적화)
CREATE INDEX emails_workspace_user_idx ON emails(workspace_id, user_email_account_id);
CREATE INDEX emails_lead_id_idx ON emails(lead_id);
CREATE INDEX emails_sequence_id_idx ON emails(sequence_id);
CREATE INDEX emails_status_direction_idx ON emails(status, direction);
CREATE INDEX emails_scheduled_at_idx ON emails(scheduled_at);
CREATE INDEX emails_thread_id_idx ON emails(thread_id);
CREATE INDEX emails_message_id_idx ON emails(message_id);
\`\`\`

### 🎯 핵심 쿼리 패턴 및 KPI 계산

**오픈율 (Open Rate)**
\`\`\`sql
SELECT
  COUNT(*) as total_sent,
  COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
  ROUND(
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100, 2
  ) as open_rate_percent
FROM emails
WHERE workspace_id = ?
  AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')
  AND direction = 'outbound'
\`\`\`

**클릭율 (Click-Through Rate)**
\`\`\`sql
SELECT
  ROUND(
    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100, 2
  ) as ctr_percent
FROM emails
WHERE workspace_id = ? AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')
\`\`\`

**응답률 (Reply Rate)**
\`\`\`sql
SELECT
  ROUND(
    COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100, 2
  ) as reply_rate_percent
FROM emails
WHERE workspace_id = ? AND direction = 'outbound'
\`\`\`

**기간 필터**
- 오늘: \`sent_at >= CURRENT_DATE\`
- 이번 주: \`sent_at >= date_trunc('week', CURRENT_TIMESTAMP)\`
- 이번 달: \`sent_at >= date_trunc('month', CURRENT_TIMESTAMP)\`
- 최근 N일: \`sent_at >= CURRENT_DATE - INTERVAL 'N days'\`

---

## 2. EMAIL_REPLIES 테이블 (답장 분석)

**목적**: 답장 이메일의 AI 감정 분석 및 관리

\`\`\`sql
CREATE TABLE email_replies (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  original_email_id UUID NOT NULL REFERENCES emails(id),  -- 우리가 보낸 원본 이메일
  reply_email_id UUID NOT NULL REFERENCES emails(id),     -- 고객의 답장 이메일

  -- AI 감정 분석 결과
  sentiment VARCHAR,                                       -- 'positive', 'neutral', 'negative', 'interested', 'not_interested'
  intent VARCHAR(255),                                     -- AI가 파악한 의도 (예: "미팅 요청", "가격 문의")
  ai_summary TEXT,                                         -- AI 생성 요약

  -- 답장 관리
  is_read BOOLEAN DEFAULT false,                           -- 읽음 여부
  assigned_to UUID REFERENCES users(id),                   -- 담당자 배정

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

**사용 예시**: "긍정적인 답장이 몇 개인가요?"
\`\`\`sql
SELECT sentiment, COUNT(*) as count
FROM email_replies
WHERE workspace_id = ? AND sentiment IN ('positive', 'interested')
GROUP BY sentiment
\`\`\`

---

## 3. EMAIL_EVENTS 테이블 (SendGrid 웹훅 이벤트)

**목적**: SendGrid로부터 받은 모든 이벤트 로그 저장

\`\`\`sql
CREATE TABLE email_events (
  id UUID PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES emails(id),

  event_type VARCHAR NOT NULL,
  /* 이벤트 종류:
     - processed: SendGrid가 처리 시작
     - delivered: 수신자 서버에 전달 완료
     - open: 이메일 오픈
     - click: 링크 클릭
     - bounce: 반송
     - dropped: SendGrid가 발송 거부 (예: 차단된 이메일)
     - deferred: 일시적 지연 (나중에 재시도)
     - spam_report: 스팸 신고
     - unsubscribe: 수신거부 클릭
  */

  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,     -- 이벤트 발생 시각
  user_agent TEXT,                                 -- 브라우저/디바이스 정보
  ip_address VARCHAR(50),                          -- IP 주소
  url TEXT,                                        -- 클릭한 URL (click 이벤트 시)

  bounce_type VARCHAR(50),                         -- 반송 유형
  bounce_reason TEXT,                              -- 반송 이유
  smtp_response TEXT,                              -- SMTP 서버 응답

  raw_event_data JSONB,                            -- 원본 웹훅 페이로드 전체
  processed BOOLEAN DEFAULT false,                 -- 이 이벤트 처리 완료 여부

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 4. LEADS 테이블 (리드 정보) ⭐ 중요

**목적**: B2B 리드(잠재 고객) 정보 관리

\`\`\`sql
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- 🏢 회사 정보
  company_name VARCHAR(255),                       -- 회사명
  found_company_name VARCHAR(255),                 -- AI/크롤링으로 찾은 회사명
  contact_name VARCHAR(255),                       -- 담당자 이름
  website_url VARCHAR(500),                        -- 웹사이트 URL
  final_url VARCHAR(500),                          -- 최종 리다이렉트된 URL
  http_status INTEGER,                             -- 웹사이트 HTTP 상태 (200, 404 등)
  name_url_match BOOLEAN,                          -- 회사명과 URL 도메인이 일치하는지

  business_type VARCHAR(100),                      -- 업종 (예: "제조업", "IT 서비스")
  is_business_type_matched BOOLEAN,                -- 타겟 업종과 일치 여부
  description TEXT,                                -- 회사 설명

  -- 📍 위치 정보
  address TEXT,                                    -- 주소
  country VARCHAR(100),                            -- 국가
  city VARCHAR(100),                               -- 도시
  state VARCHAR(100),                              -- 주/도
  founded_year INTEGER,                            -- 설립 연도

  -- 👥 규모
  employee_count VARCHAR(50),                      -- 직원 수 (예: "10-50", "50-100", "100+")

  -- 🎯 리드 관리
  lead_status VARCHAR NOT NULL DEFAULT 'new',
  /* 리드 상태:
     - new: 신규 (아직 컨택하지 않음)
     - contacted: 컨택함 (이메일 보냄)
     - qualified: 적격 (관심 있음, 계속 관리)
     - unqualified: 부적격 (관심 없음)
     - converted: 전환 (고객으로 전환)
     - lost: 놓침 (더 이상 관리 안 함)
     - unsubscribed: 수신거부
  */

  lead_score INTEGER,                              -- 리드 점수 (0-100, 높을수록 좋음)
  lead_source VARCHAR(100),                        -- 리드 출처 (예: "웹크롤링", "직접 입력", "API")
  notes TEXT,                                      -- 메모

  -- ⏱️ 처리 메타데이터
  crawl_time_seconds DECIMAL(10,2),                -- 웹 크롤링 소요 시간
  gpt_time_seconds DECIMAL(10,2),                  -- GPT 분석 소요 시간
  collected_at TIMESTAMP WITH TIME ZONE,           -- 데이터 수집 시각
  error_message TEXT,                              -- 처리 중 발생한 오류

  -- 🕐 타임스탬프
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_contacted_at TIMESTAMP WITH TIME ZONE       -- 마지막 컨택 시각
);
\`\`\`

### 🎯 리드 분석 쿼리

**전환율 (Conversion Rate)**
\`\`\`sql
SELECT
  COUNT(CASE WHEN lead_status = 'converted' THEN 1 END) as converted,
  COUNT(*) as total,
  ROUND(
    COUNT(CASE WHEN lead_status = 'converted' THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100, 2
  ) as conversion_rate
FROM leads
WHERE workspace_id = ?
\`\`\`

**상태별 분포**
\`\`\`sql
SELECT lead_status, COUNT(*) as count
FROM leads
WHERE workspace_id = ?
GROUP BY lead_status
ORDER BY count DESC
\`\`\`

---

## 5. LEAD 상세 정보 테이블들 (1:N 관계)

### 5.1 LEAD_CONTACTS (연락처)
\`\`\`sql
CREATE TABLE lead_contacts (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),

  contact_type VARCHAR NOT NULL,                   -- 'phone', 'email', 'fax', 'other'
  contact_value VARCHAR(255) NOT NULL,             -- 연락처 값 (예: "02-1234-5678")
  contact_name VARCHAR(255),                       -- 담당자 이름
  label VARCHAR(100),                              -- 레이블 (예: 'main', 'support', 'sales')
  is_primary BOOLEAN DEFAULT false,                -- 주 연락처 여부
  is_verified BOOLEAN DEFAULT false,               -- 검증 완료 여부

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### 5.2 LEAD_SOCIAL_MEDIA (소셜 미디어)
\`\`\`sql
CREATE TABLE lead_social_media (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),

  platform VARCHAR NOT NULL,                       -- 'facebook', 'instagram', 'twitter', 'linkedin'
  url VARCHAR(500) NOT NULL,                       -- 소셜 미디어 프로필 URL
  username VARCHAR(255),                           -- 사용자명
  follower_count VARCHAR(50),                      -- 팔로워 수 (예: "10K", "1.5M")
  is_verified BOOLEAN DEFAULT false,               -- 공식 인증 계정 여부

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### 5.3 LEAD_PRODUCTS (제품/서비스)
\`\`\`sql
CREATE TABLE lead_products (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  product_name VARCHAR(255) NOT NULL,              -- 제품/서비스명
  description TEXT,                                -- 제품 설명
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### 5.4 LEAD_BUSINESS_SECTORS (사업 분야)
\`\`\`sql
CREATE TABLE lead_business_sectors (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  sector_name VARCHAR(255) NOT NULL,               -- 사업 분야 (예: "전자상거래", "SaaS")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### 5.5 LEAD_PRODUCT_CATEGORIES (제품 카테고리)
\`\`\`sql
CREATE TABLE lead_product_categories (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  category_name VARCHAR(255) NOT NULL,             -- 카테고리 (예: "하드웨어", "소프트웨어")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### 5.6 LEAD_INDUSTRY_TYPES (산업 유형)
\`\`\`sql
CREATE TABLE lead_industry_types (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  industry_name VARCHAR(255) NOT NULL,             -- 산업 유형 (예: "제조", "금융")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 6. SEQUENCES 테이블 (이메일 시퀀스) ⭐ 중요

**목적**: 자동화된 이메일 캠페인 시퀀스 관리

\`\`\`sql
CREATE TABLE sequences (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  customer_group_id UUID REFERENCES customer_groups(id),  -- 타겟 고객 그룹

  name VARCHAR(255) NOT NULL,                      -- 시퀀스 이름 (예: "신규 리드 웰컴 시퀀스")
  description TEXT,                                -- 설명
  workflow_data TEXT,                              -- React Flow 워크플로우 JSON 데이터
  selected_lead_ids TEXT,                          -- JSON 배열: 선택된 리드 ID들

  status VARCHAR NOT NULL DEFAULT 'draft',
  /* 시퀀스 상태:
     - draft: 임시저장
     - active: 활성 (자동 발송 중)
     - paused: 일시정지
     - archived: 보관 (더 이상 사용 안 함)
     - completed: 완료
  */

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

**쿼리 예시**: "활성 시퀀스 목록"
\`\`\`sql
SELECT name, status, created_at
FROM sequences
WHERE workspace_id = ? AND status = 'active'
ORDER BY created_at DESC
\`\`\`

---

## 7. SEQUENCE_STEPS 테이블 (시퀀스 단계)

**목적**: 시퀀스의 각 이메일 단계 정의

\`\`\`sql
CREATE TABLE sequence_steps (
  id UUID PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES sequences(id),

  step_order INTEGER NOT NULL,                     -- 단계 순서 (1, 2, 3...)
  delay_days INTEGER DEFAULT 0,                    -- 이전 단계 이후 N일 대기
  scheduled_hour INTEGER DEFAULT 9,                -- 발송 시각 (0-23시)
  scheduled_minute INTEGER DEFAULT 0,              -- 발송 분 (0-59분)
  timezone VARCHAR(50) DEFAULT 'Asia/Seoul',       -- 시간대

  email_subject VARCHAR(500) NOT NULL,             -- 이메일 제목
  email_body_text TEXT,                            -- 텍스트 본문
  email_body_html TEXT,                            -- HTML 본문
  email_template_id UUID REFERENCES email_templates(id),  -- 템플릿 사용 시

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

**예시**: 3단계 시퀀스
1. Day 0, 9:00 AM - "안녕하세요, 우리 제품을 소개합니다"
2. Day 3, 10:00 AM - "지난 이메일 보셨나요?"
3. Day 7, 2:00 PM - "마지막 기회입니다"

---

## 8. SEQUENCE_ENROLLMENTS 테이블 (시퀀스 등록)

**목적**: 어떤 리드가 어떤 시퀀스에 등록되어 있는지 추적

\`\`\`sql
CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES sequences(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  user_email_account_id UUID NOT NULL REFERENCES user_email_accounts(id),

  current_step_order INTEGER DEFAULT 0,            -- 현재 진행 중인 단계 (0 = 시작 전)
  status VARCHAR NOT NULL DEFAULT 'active',
  /* 등록 상태:
     - active: 활성 (계속 진행 중)
     - paused: 일시정지
     - completed: 완료 (모든 단계 완료)
     - stopped: 중단 (수동 중지)
     - bounced: 반송됨
     - unsubscribed: 수신거부
  */

  enrolled_by UUID REFERENCES users(id),           -- 누가 등록했는지
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_email_sent_at TIMESTAMP WITH TIME ZONE,    -- 첫 이메일 발송 시각
  last_email_sent_at TIMESTAMP WITH TIME ZONE,     -- 마지막 이메일 발송 시각
  completed_at TIMESTAMP WITH TIME ZONE,           -- 완료 시각
  stopped_at TIMESTAMP WITH TIME ZONE,             -- 중단 시각
  next_step_scheduled_at TIMESTAMP WITH TIME ZONE, -- 다음 단계 예정 시각
  first_thread_id VARCHAR(255)                     -- 첫 이메일의 Message-ID (스레딩용)
);
\`\`\`

**쿼리 예시**: "시퀀스별 완료율"
\`\`\`sql
SELECT
  s.name,
  COUNT(*) as total_enrollments,
  COUNT(CASE WHEN se.status = 'completed' THEN 1 END) as completed,
  ROUND(
    COUNT(CASE WHEN se.status = 'completed' THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100, 2
  ) as completion_rate
FROM sequence_enrollments se
JOIN sequences s ON se.sequence_id = s.id
WHERE s.workspace_id = ?
GROUP BY s.id, s.name
ORDER BY completion_rate DESC
\`\`\`

---

## 9. SEQUENCE_STEP_EXECUTIONS 테이블 (단계 실행 기록)

**목적**: 각 단계의 실제 실행 상태 추적

\`\`\`sql
CREATE TABLE sequence_step_executions (
  id UUID PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES sequence_enrollments(id),
  step_id UUID NOT NULL REFERENCES sequence_steps(id),

  step_order INTEGER NOT NULL,                     -- 단계 번호
  status VARCHAR NOT NULL DEFAULT 'pending',
  /* 실행 상태:
     - pending: 대기 중
     - scheduled: 예약됨
     - sent: 발송 완료
     - delivered: 전달 완료
     - failed: 실패
     - skipped: 건너뜀 (예: 이미 답장받음)
  */

  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- 예정 시각
  executed_at TIMESTAMP WITH TIME ZONE,            -- 실제 실행 시각
  error_message TEXT,                              -- 오류 메시지
  email_id UUID REFERENCES emails(id),             -- 생성된 이메일 ID

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 10. USERS 테이블 (사용자)

\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255),                      -- bcrypt 해시
  user_role VARCHAR NOT NULL DEFAULT 'user',       -- 'admin' 또는 'user'
  is_active BOOLEAN DEFAULT true,                  -- 활성화 여부

  department_id UUID REFERENCES departments(id),   -- 부서
  employee_id VARCHAR(20),                         -- 사원 번호

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE           -- 마지막 로그인 시각
);
\`\`\`

---

## 11. DEPARTMENTS 테이블 (부서)

\`\`\`sql
CREATE TABLE departments (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,               -- 부서명 (예: "영업팀", "마케팅팀")
  code VARCHAR(20) UNIQUE NOT NULL,                -- 부서 코드 (예: "SALES", "MKT")
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 12. WORKSPACES 테이블 (워크스페이스)

**목적**: 멀티 테넌트 구조, 각 회사/팀별 독립된 공간

\`\`\`sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,                      -- 워크스페이스 이름 (예: "ABC 주식회사")
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id),     -- 소유자
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 13. WORKSPACE_MEMBERS 테이블 (워크스페이스 멤버)

\`\`\`sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),

  role VARCHAR NOT NULL DEFAULT 'member',
  /* 역할:
     - owner: 소유자 (모든 권한)
     - admin: 관리자 (대부분 권한)
     - member: 멤버 (일반 사용)
     - viewer: 열람자 (읽기 전용)
  */

  invited_by UUID REFERENCES users(id),            -- 누가 초대했는지
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,              -- 초대 수락 시각
  status VARCHAR NOT NULL DEFAULT 'active'         -- 'active', 'inactive', 'removed'
);
\`\`\`

---

## 14. USER_EMAIL_ACCOUNTS 테이블 (이메일 계정)

**목적**: 사용자의 SendGrid 연동 이메일 계정 관리

\`\`\`sql
CREATE TABLE user_email_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- SendGrid 설정
  email_address VARCHAR(255) NOT NULL,             -- 발송 이메일 주소
  display_name VARCHAR(255),                       -- 발신자 표시 이름
  api_key TEXT NOT NULL,                           -- SendGrid API 키
  sendgrid_verified_sender_id VARCHAR(255),        -- SendGrid 인증된 발신자 ID

  -- 상태
  is_verified BOOLEAN DEFAULT false,               -- SendGrid 인증 완료 여부
  is_default BOOLEAN DEFAULT false,                -- 기본 계정 여부
  status VARCHAR NOT NULL DEFAULT 'inactive',
  /* 계정 상태:
     - active: 활성 (사용 가능)
     - inactive: 비활성
     - error: 오류 (API 키 문제 등)
     - rate_limited: 발송 한도 초과
     - suspended: 정지됨
  */

  -- 발송 한도 관리
  daily_limit INTEGER,                             -- 일일 발송 한도
  monthly_limit INTEGER,                           -- 월간 발송 한도
  daily_sent_count INTEGER DEFAULT 0,              -- 오늘 발송한 수
  monthly_sent_count INTEGER DEFAULT 0,            -- 이번 달 발송한 수
  last_reset_daily DATE,                           -- 일일 카운터 마지막 리셋 날짜
  last_reset_monthly DATE,                         -- 월간 카운터 마지막 리셋 날짜

  last_error TEXT,                                 -- 마지막 오류 메시지
  last_sync_at TIMESTAMP WITH TIME ZONE,           -- 마지막 동기화 시각

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 15. CUSTOMER_GROUPS 테이블 (고객 그룹)

**목적**: 리드를 그룹으로 분류하여 시퀀스 타겟팅

\`\`\`sql
CREATE TABLE customer_groups (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  name VARCHAR(255) NOT NULL,                      -- 그룹명 (예: "IT 업종 리드")
  description TEXT,
  criteria JSONB,                                  -- 필터 조건 JSON (예: {"business_type": "IT"})
  is_dynamic BOOLEAN DEFAULT false,                -- 동적 그룹 (조건에 맞으면 자동 추가)

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 16. CUSTOMER_GROUP_MEMBERS 테이블 (그룹 멤버십)

\`\`\`sql
CREATE TABLE customer_group_members (
  id UUID PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES customer_groups(id),
  lead_id UUID NOT NULL REFERENCES leads(id),

  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 17. EMAIL_TEMPLATES 테이블 (이메일 템플릿)

\`\`\`sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  name VARCHAR(255) NOT NULL,                      -- 템플릿 이름
  description TEXT,
  subject VARCHAR(500) NOT NULL,                   -- 제목 템플릿
  body_text TEXT,                                  -- 텍스트 본문
  body_html TEXT,                                  -- HTML 본문

  variables JSONB,                                 -- 사용 가능한 변수 (예: {{lead_name}}, {{company}})
  category VARCHAR(100),                           -- 카테고리 (예: "웰컴", "후속")
  is_shared BOOLEAN DEFAULT false,                 -- 워크스페이스 전체 공유 여부

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 18. ACTIVITY_LOGS 테이블 (활동 로그)

**목적**: 모든 사용자 활동 감사 로그

\`\`\`sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID REFERENCES users(id),

  entity_type VARCHAR(100) NOT NULL,               -- 'lead', 'email', 'sequence' 등
  entity_id UUID NOT NULL,                         -- 해당 엔티티 ID
  action VARCHAR(100) NOT NULL,                    -- 'created', 'updated', 'deleted', 'sent' 등

  details JSONB,                                   -- 상세 정보 JSON
  ip_address VARCHAR(50),                          -- IP 주소
  user_agent TEXT,                                 -- 브라우저 정보

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## 📋 테이블 간 관계 (ERD)

\`\`\`
workspaces (1) ───< (N) emails
workspaces (1) ───< (N) leads
workspaces (1) ───< (N) sequences
workspaces (1) ───< (N) user_email_accounts
workspaces (1) ───< (N) customer_groups
workspaces (1) ───< (N) email_templates
workspaces (1) ───< (N) workspace_members
workspaces (1) ───< (N) activity_logs

users (1) ───< (N) workspaces (owner)
users (1) ───< (N) leads (created_by)
users (1) ───< (N) sequences (created_by)
users (1) ───< (N) user_email_accounts
users (1) ───< (N) workspace_members
users (N) ─── (1) departments

leads (1) ───< (N) emails
leads (1) ───< (N) sequence_enrollments
leads (1) ───< (N) lead_contacts
leads (1) ───< (N) lead_social_media
leads (1) ───< (N) lead_products
leads (1) ───< (N) lead_business_sectors
leads (1) ───< (N) lead_product_categories
leads (1) ───< (N) lead_industry_types
leads (N) ───> (N) customer_groups (through customer_group_members)

sequences (1) ───< (N) sequence_steps
sequences (1) ───< (N) sequence_enrollments
sequences (1) ───< (N) emails

sequence_enrollments (1) ───< (N) sequence_step_executions
sequence_steps (1) ───< (N) sequence_step_executions

emails (1) ───< (N) email_events
emails (1) ───< (N) email_replies
emails (N) ─── (1) user_email_accounts
emails (N) ─── (1) sequence_steps (step_id)

customer_groups (1) ───< (N) sequences
customer_groups (1) ───< (N) customer_group_members

email_templates (1) ───< (N) sequence_steps
\`\`\`

---

## ⚠️ 중요 제약사항 및 규칙

1. **workspace_id 필터 필수**:
   - 모든 SELECT 쿼리는 반드시 \`WHERE workspace_id = '...'\` 조건을 포함해야 합니다.
   - 이는 멀티 테넌트 데이터 격리를 위한 필수 보안 요구사항입니다.

2. **READ-ONLY**:
   - SELECT 쿼리만 허용됩니다.
   - INSERT, UPDATE, DELETE, DROP, TRUNCATE 등 데이터 변경 쿼리는 금지됩니다.

3. **Division by Zero 방지**:
   - 모든 나누기 연산에는 \`NULLIF()\` 사용 필수
   - 예: \`value / NULLIF(total, 0)\`

4. **타임존 처리**:
   - 모든 timestamp 필드는 \`TIMESTAMP WITH TIME ZONE\` 타입입니다.
   - 한국 시간(KST): UTC+9

5. **NULL 처리**:
   - \`IS NULL\`, \`IS NOT NULL\`을 명시적으로 사용하세요.
   - \`COALESCE()\` 함수로 기본값 제공하세요.

6. **성능 고려**:
   - 필요한 컬럼만 SELECT하세요.
   - LIMIT 절 사용 (기본 100, 최대 1000)
   - 인덱스가 있는 컬럼을 WHERE에 사용하세요.

---

## 🛠️ 유용한 PostgreSQL 함수

**날짜/시간 함수**
- \`date_trunc('week', timestamp)\`: 주 단위 truncate
- \`date_trunc('month', timestamp)\`: 월 단위 truncate
- \`CURRENT_TIMESTAMP\`: 현재 시각 (timezone 포함)
- \`CURRENT_DATE\`: 오늘 날짜
- \`INTERVAL '7 days'\`: 기간 표현
- \`AGE(timestamp1, timestamp2)\`: 기간 계산
- \`EXTRACT(dow FROM timestamp)\`: 요일 추출 (0=일요일, 6=토요일)
- \`to_char(timestamp, 'YYYY-MM-DD')\`: 날짜 포맷팅

**집계 함수**
- \`COUNT(CASE WHEN condition THEN 1 END)\`: 조건부 카운트
- \`ROUND(value::numeric, 2)\`: 소수점 반올림
- \`COALESCE(value, default)\`: NULL 기본값 처리
- \`NULLIF(value, 0)\`: Division by Zero 방지
- \`STRING_AGG(column, ', ')\`: 문자열 결합

**문자열 함수**
- \`LOWER(text)\`: 소문자 변환
- \`UPPER(text)\`: 대문자 변환
- \`LIKE\` / \`ILIKE\`: 패턴 매칭 (ILIKE는 대소문자 무시)
- \`CONCAT(str1, str2)\`: 문자열 연결

---

## 💡 자주 묻는 질문 (FAQ)

**Q: "오늘 발송한 이메일 수는?"**
\`\`\`sql
SELECT COUNT(*) as today_sent
FROM emails
WHERE workspace_id = ?
  AND sent_at >= CURRENT_DATE
  AND direction = 'outbound'
\`\`\`

**Q: "이번 주 오픈율은?"**
\`\`\`sql
SELECT
  ROUND(
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100, 2
  ) as this_week_open_rate
FROM emails
WHERE workspace_id = ?
  AND sent_at >= date_trunc('week', CURRENT_TIMESTAMP)
  AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')
\`\`\`

**Q: "가장 성과가 좋은 시퀀스는?"**
\`\`\`sql
SELECT
  s.name,
  COUNT(e.id) as total_emails,
  COUNT(CASE WHEN e.replied_at IS NOT NULL THEN 1 END) as replies,
  ROUND(
    COUNT(CASE WHEN e.replied_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(e.id), 0)::numeric * 100, 2
  ) as reply_rate
FROM sequences s
LEFT JOIN emails e ON s.id = e.sequence_id AND e.workspace_id = ?
WHERE s.workspace_id = ?
GROUP BY s.id, s.name
ORDER BY reply_rate DESC
LIMIT 5
\`\`\`

**Q: "신규 리드는 몇 개인가요?"**
\`\`\`sql
SELECT COUNT(*) as new_leads
FROM leads
WHERE workspace_id = ? AND lead_status = 'new'
\`\`\`

**Q: "업종별 리드 분포는?"**
\`\`\`sql
SELECT business_type, COUNT(*) as count
FROM leads
WHERE workspace_id = ?
GROUP BY business_type
ORDER BY count DESC
LIMIT 10
\`\`\`
`

export function getRelevantSchema(_question: string): string {
  // 전체 스키마 반환 (LangGraph AI가 필요한 부분을 알아서 선택)
  return DATABASE_SCHEMA
}
