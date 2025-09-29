# 데이터베이스 스키마 설계

K뷰티 해외 진출을 위한 AI 이메일 마케팅 솔루션

## 1. 워크스페이스 관리

### workspaces
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 워크스페이스 고유 ID |
| name | VARCHAR(255) | NOT NULL | 워크스페이스 이름 |
| description | TEXT | | 워크스페이스 설명 |
| owner_id | UUID | FK → users.id, NOT NULL | 소유자 ID |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정일시 |
| is_active | BOOLEAN | DEFAULT true | 활성화 상태 |

### workspace_members
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 멤버십 고유 ID |
| workspace_id | UUID | FK → workspaces.id, NOT NULL | 워크스페이스 ID |
| user_id | UUID | FK → users.id, NOT NULL | 유저 ID |
| role | ENUM | NOT NULL | 역할 (owner, admin, member, viewer) |
| invited_by | UUID | FK → users.id | 초대한 유저 ID |
| invited_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 초대일시 |
| joined_at | TIMESTAMP | | 가입일시 |
| status | ENUM | NOT NULL, DEFAULT 'pending' | 상태 (pending, active, inactive) |
| UNIQUE(workspace_id, user_id) | | | 워크스페이스당 유저 중복 방지 |

## 2. 유저 관리

### users
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 유저 고유 ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 이메일 |
| name | VARCHAR(255) | NOT NULL | 이름 |
| password_hash | VARCHAR(255) | NOT NULL | 비밀번호 해시 |
| profile_image | VARCHAR(500) | | 프로필 이미지 URL |
| phone | VARCHAR(50) | | 전화번호 |
| is_email_verified | BOOLEAN | DEFAULT false | 이메일 인증 여부 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정일시 |
| last_login_at | TIMESTAMP | | 마지막 로그인 일시 |
| is_active | BOOLEAN | DEFAULT true | 활성화 상태 |

### user_email_accounts
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 이메일 계정 고유 ID |
| user_id | UUID | FK → users.id, NOT NULL | 유저 ID |
| workspace_id | UUID | FK → workspaces.id, NOT NULL | 워크스페이스 ID |
| provider | ENUM | NOT NULL | 이메일 제공자 (sendgrid, zoho, gmail, outlook, smtp) |
| connection_type | ENUM | NOT NULL | 연결 방식 (api, smtp, oauth) |
| email_address | VARCHAR(255) | NOT NULL | 발송용 이메일 주소 |
| display_name | VARCHAR(255) | | 발신자 표시 이름 |
| api_key | TEXT | | API 키 (암호화) - SendGrid 등 |
| smtp_host | VARCHAR(255) | | SMTP 호스트 |
| smtp_port | INTEGER | | SMTP 포트 |
| smtp_username | VARCHAR(255) | | SMTP 사용자명 |
| smtp_password | TEXT | | SMTP 비밀번호 (암호화) |
| imap_host | VARCHAR(255) | | IMAP 호스트 |
| imap_port | INTEGER | | IMAP 포트 |
| imap_username | VARCHAR(255) | | IMAP 사용자명 |
| imap_password | TEXT | | IMAP 비밀번호 (암호화) |
| access_token | TEXT | | OAuth 액세스 토큰 (암호화) |
| refresh_token | TEXT | | OAuth 리프레시 토큰 (암호화) |
| token_expires_at | TIMESTAMP | | 토큰 만료일시 |
| sendgrid_verified_sender_id | VARCHAR(255) | | SendGrid Verified Sender ID |
| is_verified | BOOLEAN | DEFAULT false | 이메일 계정 검증 여부 |
| is_default | BOOLEAN | DEFAULT false | 기본 발송 계정 여부 |
| daily_limit | INTEGER | DEFAULT 500 | 일일 발송 제한 |
| monthly_limit | INTEGER | | 월간 발송 제한 (SendGrid 플랜별) |
| daily_sent_count | INTEGER | DEFAULT 0 | 오늘 발송한 메일 수 |
| monthly_sent_count | INTEGER | DEFAULT 0 | 이번 달 발송한 메일 수 |
| last_reset_daily | DATE | | 일일 카운터 마지막 리셋 일자 |
| last_reset_monthly | DATE | | 월간 카운터 마지막 리셋 일자 |
| status | ENUM | NOT NULL, DEFAULT 'active' | 상태 (active, inactive, error, limit_reached) |
| last_error | TEXT | | 마지막 에러 메시지 |
| last_sync_at | TIMESTAMP | | 마지막 동기화 일시 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정일시 |
| UNIQUE(user_id, workspace_id, email_address) | | | 유저-워크스페이스당 이메일 중복 방지 |

## 3. 전체 고객 관리 (Leads)

### leads
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 고객 고유 ID |
| workspace_id | UUID | FK → workspaces.id, NOT NULL | 워크스페이스 ID |
| company_name | VARCHAR(255) | NOT NULL | 회사명 |
| found_company_name | VARCHAR(255) | | 크롤링으로 찾은 회사명 |
| website_url | VARCHAR(500) | | 원본 웹사이트 URL |
| final_url | VARCHAR(500) | | 최종 리다이렉트 URL |
| http_status | INTEGER | | HTTP 상태 코드 |
| name_url_match | BOOLEAN | | 회사명과 URL 매칭 여부 |
| business_type | VARCHAR(100) | | 비즈니스 타입 (B2B, B2C, etc.) |
| is_business_type_matched | BOOLEAN | | 비즈니스 타입 매칭 여부 |
| description | TEXT | | 회사 설명 |
| address | TEXT | | 주소 |
| country | VARCHAR(100) | | 국가 |
| city | VARCHAR(100) | | 도시 |
| state | VARCHAR(100) | | 주/도 |
| founded_year | INTEGER | | 설립 연도 |
| phone_number | VARCHAR(50) | | 전화번호 |
| email | VARCHAR(255) | | 이메일 |
| facebook_url | VARCHAR(500) | | 페이스북 URL |
| instagram_url | VARCHAR(500) | | 인스타그램 URL |
| twitter_url | VARCHAR(500) | | 트위터 URL |
| linkedin_url | VARCHAR(500) | | 링크드인 URL |
| employee_count | VARCHAR(50) | | 직원 수 |
| products | TEXT[] | | 제품 목록 |
| business_sectors | TEXT[] | | 비즈니스 섹터 목록 |
| product_categories | TEXT[] | | 제품 카테고리 목록 |
| industry_types | TEXT[] | | 산업 유형 목록 |
| lead_source | VARCHAR(100) | | 리드 소스 |
| lead_status | ENUM | NOT NULL, DEFAULT 'new' | 상태 (new, contacted, qualified, unqualified, lost) |
| lead_score | INTEGER | DEFAULT 0 | 리드 점수 |
| notes | TEXT | | 메모 |
| crawl_time_seconds | DECIMAL(10, 2) | | 크롤링 소요 시간 (초) |
| gpt_time_seconds | DECIMAL(10, 2) | | GPT 분석 소요 시간 (초) |
| collected_at | TIMESTAMP | | 데이터 수집 일시 |
| error_message | TEXT | | 에러 메시지 |
| created_by | UUID | FK → users.id | 생성자 ID |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정일시 |
| last_contacted_at | TIMESTAMP | | 마지막 컨택 일시 |
| UNIQUE(workspace_id, website_url) | | | 워크스페이스당 웹사이트 URL 중복 방지 |

## 4. 고객 그룹 관리

### customer_groups
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 그룹 고유 ID |
| workspace_id | UUID | FK → workspaces.id, NOT NULL | 워크스페이스 ID |
| name | VARCHAR(255) | NOT NULL | 그룹명 |
| description | TEXT | | 그룹 설명 |
| criteria | JSONB | | 그룹 필터링 조건 (동적 그룹용) |
| is_dynamic | BOOLEAN | DEFAULT false | 동적 그룹 여부 |
| created_by | UUID | FK → users.id | 생성자 ID |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정일시 |

### customer_group_members
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 멤버십 고유 ID |
| group_id | UUID | FK → customer_groups.id, NOT NULL | 그룹 ID |
| lead_id | UUID | FK → leads.id, NOT NULL | 고객 ID |
| added_by | UUID | FK → users.id | 추가한 유저 ID |
| added_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 추가일시 |
| UNIQUE(group_id, lead_id) | | | 그룹당 고객 중복 방지 |

## 5. 팔로우업 시퀀스 관리

### sequences
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 시퀀스 고유 ID |
| workspace_id | UUID | FK → workspaces.id, NOT NULL | 워크스페이스 ID |
| name | VARCHAR(255) | NOT NULL | 시퀀스명 |
| description | TEXT | | 시퀀스 설명 |
| status | ENUM | NOT NULL, DEFAULT 'draft' | 상태 (draft, active, paused, archived) |
| created_by | UUID | FK → users.id | 생성자 ID |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정일시 |

### sequence_steps
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 스텝 고유 ID |
| sequence_id | UUID | FK → sequences.id, NOT NULL | 시퀀스 ID |
| step_order | INTEGER | NOT NULL | 스텝 순서 (1, 2, 3...) |
| delay_days | INTEGER | NOT NULL | 지연 일수 (첫 이메일 발송 후) |
| email_subject | VARCHAR(500) | NOT NULL | 이메일 제목 |
| email_body_text | TEXT | | 이메일 본문 (텍스트) |
| email_body_html | TEXT | | 이메일 본문 (HTML) |
| email_template_id | UUID | FK → email_templates.id | 이메일 템플릿 ID |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정일시 |

### sequence_enrollments
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 등록 고유 ID |
| sequence_id | UUID | FK → sequences.id, NOT NULL | 시퀀스 ID |
| lead_id | UUID | FK → leads.id, NOT NULL | 고객 ID |
| user_email_account_id | UUID | FK → user_email_accounts.id, NOT NULL | 발송 계정 ID |
| current_step_order | INTEGER | DEFAULT 0 | 현재 스텝 순서 (0=미시작, 1,2,3...) |
| status | ENUM | NOT NULL, DEFAULT 'active' | 상태 (active, paused, completed, stopped_reply_received, unsubscribed) |
| enrolled_by | UUID | FK → users.id | 등록한 유저 ID |
| enrolled_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 등록일시 |
| first_email_sent_at | TIMESTAMP | | 첫 이메일 발송일시 (기준점) |
| last_email_sent_at | TIMESTAMP | | 마지막 이메일 발송일시 |
| completed_at | TIMESTAMP | | 완료일시 |
| stopped_at | TIMESTAMP | | 중단일시 (답장 수신 시) |
| next_step_scheduled_at | TIMESTAMP | | 다음 스텝 예정일시 |
| UNIQUE(sequence_id, lead_id) | | | 시퀀스당 고객 중복 방지 |

### sequence_step_executions
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 실행 고유 ID |
| enrollment_id | UUID | FK → sequence_enrollments.id, NOT NULL | 등록 ID |
| step_id | UUID | FK → sequence_steps.id, NOT NULL | 스텝 ID |
| step_order | INTEGER | NOT NULL | 스텝 순서 |
| status | ENUM | NOT NULL, DEFAULT 'scheduled' | 상태 (scheduled, sent, delivered, failed, skipped) |
| scheduled_at | TIMESTAMP | NOT NULL | 예정일시 |
| executed_at | TIMESTAMP | | 실행일시 |
| error_message | TEXT | | 에러 메시지 |
| email_id | UUID | FK → emails.id | 발송된 이메일 ID |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |

## 6. 답장 관리

### emails
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 이메일 고유 ID |
| workspace_id | UUID | FK → workspaces.id, NOT NULL | 워크스페이스 ID |
| user_email_account_id | UUID | FK → user_email_accounts.id | 발송에 사용된 이메일 계정 ID |
| lead_id | UUID | FK → leads.id, NOT NULL | 고객 ID |
| sequence_id | UUID | FK → sequences.id | 시퀀스 ID (시퀀스로 발송된 경우) |
| step_id | UUID | FK → sequence_steps.id | 스텝 ID (시퀀스로 발송된 경우) |
| direction | ENUM | NOT NULL | 방향 (outbound, inbound) |
| from_email | VARCHAR(255) | NOT NULL | 발신자 이메일 |
| to_email | VARCHAR(255) | NOT NULL | 수신자 이메일 |
| cc_emails | TEXT[] | | 참조 이메일 |
| bcc_emails | TEXT[] | | 숨은 참조 이메일 |
| subject | VARCHAR(500) | | 제목 |
| body_text | TEXT | | 본문 (텍스트) |
| body_html | TEXT | | 본문 (HTML) |
| status | ENUM | NOT NULL | 상태 (draft, queued, scheduled, processing, sent, delivered, opened, clicked, replied, bounced, failed, deferred) |
| scheduled_at | TIMESTAMP | | 예약 발송일시 |
| sent_at | TIMESTAMP | | 발송일시 |
| delivered_at | TIMESTAMP | | 전달일시 |
| opened_at | TIMESTAMP | | 오픈일시 |
| clicked_at | TIMESTAMP | | 클릭일시 |
| replied_at | TIMESTAMP | | 답장일시 |
| bounce_type | ENUM | | 반송 타입 (hard, soft, spam) |
| bounce_reason | TEXT | | 반송 이유 |
| error_message | TEXT | | 에러 메시지 |
| sendgrid_message_id | VARCHAR(500) | | SendGrid 메시지 ID |
| message_id | VARCHAR(500) | UNIQUE | 이메일 메시지 ID (외부 시스템) |
| in_reply_to | VARCHAR(500) | | 답장 대상 메시지 ID |
| thread_id | UUID | FK → email_threads.id | 스레드 ID |
| open_count | INTEGER | DEFAULT 0 | 오픈 횟수 |
| click_count | INTEGER | DEFAULT 0 | 클릭 횟수 |
| unsubscribed_at | TIMESTAMP | | 수신거부 일시 |
| spam_reported_at | TIMESTAMP | | 스팸 신고 일시 |
| retry_count | INTEGER | DEFAULT 0 | 재시도 횟수 |
| last_retry_at | TIMESTAMP | | 마지막 재시도 일시 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정일시 |

### email_threads
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 스레드 고유 ID |
| workspace_id | UUID | FK → workspaces.id, NOT NULL | 워크스페이스 ID |
| lead_id | UUID | FK → leads.id, NOT NULL | 고객 ID |
| subject | VARCHAR(500) | | 스레드 제목 |
| first_email_id | UUID | FK → emails.id | 첫 이메일 ID |
| last_email_id | UUID | FK → emails.id | 마지막 이메일 ID |
| last_activity_at | TIMESTAMP | NOT NULL | 마지막 활동일시 |
| status | ENUM | NOT NULL, DEFAULT 'active' | 상태 (active, closed, archived) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정일시 |

### email_replies
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 답장 고유 ID |
| workspace_id | UUID | FK → workspaces.id, NOT NULL | 워크스페이스 ID |
| original_email_id | UUID | FK → emails.id, NOT NULL | 원본 이메일 ID |
| reply_email_id | UUID | FK → emails.id, NOT NULL | 답장 이메일 ID |
| sentiment | ENUM | | 감정 분석 (positive, neutral, negative) |
| intent | VARCHAR(255) | | 의도 분류 (interested, not_interested, meeting_request, question, etc.) |
| ai_summary | TEXT | | AI 요약 |
| is_read | BOOLEAN | DEFAULT false | 읽음 여부 |
| assigned_to | UUID | FK → users.id | 담당자 ID |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |

### email_events
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 이벤트 고유 ID |
| email_id | UUID | FK → emails.id, NOT NULL | 이메일 ID |
| event_type | ENUM | NOT NULL | 이벤트 타입 (processed, delivered, open, click, bounce, deferred, dropped, spam_report, unsubscribe) |
| timestamp | TIMESTAMP | NOT NULL | 이벤트 발생일시 |
| sendgrid_event_id | VARCHAR(500) | | SendGrid 이벤트 ID |
| user_agent | TEXT | | 유저 에이전트 (open, click 이벤트) |
| ip_address | VARCHAR(50) | | IP 주소 |
| url | TEXT | | 클릭한 URL (click 이벤트) |
| bounce_type | VARCHAR(50) | | 반송 타입 |
| bounce_reason | TEXT | | 반송 이유 |
| smtp_response | TEXT | | SMTP 응답 |
| raw_event_data | JSONB | | 원본 웹훅 데이터 |
| processed | BOOLEAN | DEFAULT false | 처리 여부 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |

## 7. 이메일 템플릿

### email_templates
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 템플릿 고유 ID |
| workspace_id | UUID | FK → workspaces.id, NOT NULL | 워크스페이스 ID |
| name | VARCHAR(255) | NOT NULL | 템플릿명 |
| description | TEXT | | 템플릿 설명 |
| subject | VARCHAR(500) | | 제목 |
| body_text | TEXT | | 본문 (텍스트) |
| body_html | TEXT | | 본문 (HTML) |
| variables | JSONB | | 사용 가능한 변수 목록 |
| category | VARCHAR(100) | | 카테고리 |
| is_shared | BOOLEAN | DEFAULT false | 공유 템플릿 여부 |
| created_by | UUID | FK → users.id | 생성자 ID |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정일시 |

## 8. 활동 로그

### activity_logs
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PK | 로그 고유 ID |
| workspace_id | UUID | FK → workspaces.id, NOT NULL | 워크스페이스 ID |
| user_id | UUID | FK → users.id | 유저 ID |
| entity_type | VARCHAR(100) | NOT NULL | 엔티티 타입 (lead, sequence, email, etc.) |
| entity_id | UUID | NOT NULL | 엔티티 ID |
| action | VARCHAR(100) | NOT NULL | 액션 (created, updated, deleted, sent, etc.) |
| details | JSONB | | 상세 정보 |
| ip_address | VARCHAR(50) | | IP 주소 |
| user_agent | TEXT | | 유저 에이전트 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성일시 |

## 인덱스 전략

```sql
-- 워크스페이스 관련
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

-- 유저 이메일 계정 관련
CREATE INDEX idx_user_email_accounts_user ON user_email_accounts(user_id);
CREATE INDEX idx_user_email_accounts_workspace ON user_email_accounts(workspace_id);
CREATE INDEX idx_user_email_accounts_status ON user_email_accounts(status) WHERE status = 'active';

-- 고객 관련
CREATE INDEX idx_leads_workspace ON leads(workspace_id);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(lead_status);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_country ON leads(country);
CREATE INDEX idx_leads_business_type ON leads(business_type);

-- 그룹 관련
CREATE INDEX idx_customer_groups_workspace ON customer_groups(workspace_id);
CREATE INDEX idx_customer_group_members_group ON customer_group_members(group_id);
CREATE INDEX idx_customer_group_members_lead ON customer_group_members(lead_id);

-- 시퀀스 관련
CREATE INDEX idx_sequences_workspace ON sequences(workspace_id);
CREATE INDEX idx_sequence_steps_sequence ON sequence_steps(sequence_id);
CREATE INDEX idx_sequence_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX idx_sequence_enrollments_lead ON sequence_enrollments(lead_id);
CREATE INDEX idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX idx_sequence_enrollments_next_step ON sequence_enrollments(next_step_scheduled_at) WHERE status = 'active';
CREATE INDEX idx_sequence_step_executions_enrollment ON sequence_step_executions(enrollment_id);
CREATE INDEX idx_sequence_step_executions_scheduled ON sequence_step_executions(scheduled_at) WHERE status = 'scheduled';

-- 이메일 관련
CREATE INDEX idx_emails_workspace ON emails(workspace_id);
CREATE INDEX idx_emails_lead ON emails(lead_id);
CREATE INDEX idx_emails_thread ON emails(thread_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_sent_at ON emails(sent_at);
CREATE INDEX idx_emails_scheduled_at ON emails(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_emails_user_email_account ON emails(user_email_account_id);
CREATE INDEX idx_emails_sendgrid_message_id ON emails(sendgrid_message_id);
CREATE INDEX idx_email_replies_workspace ON email_replies(workspace_id);
CREATE INDEX idx_email_replies_original ON email_replies(original_email_id);
CREATE INDEX idx_email_events_email ON email_events(email_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_timestamp ON email_events(timestamp);
CREATE INDEX idx_email_events_processed ON email_events(processed) WHERE processed = false;

-- 활동 로그 관련
CREATE INDEX idx_activity_logs_workspace ON activity_logs(workspace_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
```

## 주요 특징

1. **멀티 테넌시**: workspace_id를 통한 데이터 격리
2. **역할 기반 접근 제어**: workspace_members의 role 컬럼
3. **SendGrid 및 외부 이메일 계정 연동**:
   - SendGrid API 키 기반 연동 (대량 발송용)
   - Zoho, Gmail 등 SMTP/OAuth 연동 지원
   - 일일/월간 발송 제한 추적
   - 발송 계정별 상태 관리
4. **유연한 고객 데이터**:
   - 웹 크롤링 기반 회사 정보 수집 (website_url, description, products 등)
   - 소셜 미디어 URL 추적 (Facebook, Instagram, Twitter, LinkedIn)
5. **동적 그룹**: criteria JSONB를 통한 조건 기반 그룹핑
6. **팔로우업 시퀀스 자동화**:
   - 답장이 없을 때만 지정 일수 후 자동 발송 (예: 1일, 3일, 7일)
   - 답장 수신 시 자동 중단 (stopped_reply_received)
   - 스텝별 실행 스케줄링 및 추적
7. **대량 발송**: SendGrid API 기반 대량 발송
8. **SendGrid 웹훅 이벤트 처리**:
   - email_events 테이블로 모든 이벤트 추적
   - 실시간 이메일 상태 업데이트
   - 이벤트별 통계 집계
9. **이메일 스레드 추적**: thread_id를 통한 대화 이력 관리
10. **AI 기반 답장 분석**: sentiment, intent, ai_summary
11. **감사 추적**: activity_logs를 통한 모든 활동 기록
12. **성능 메트릭**: crawl_time_seconds, gpt_time_seconds로 데이터 수집 성능 추적

## SendGrid 연동 아키텍처

### 발송 흐름
1. **일반 발송**: emails 테이블 → SendGrid API → sendgrid_message_id 저장
2. **시퀀스 발송**: sequence_enrollments → sequence_step_executions → emails → SendGrid API

### 웹훅 처리
1. SendGrid 웹훅 수신 → email_events 테이블 저장
2. 이벤트 타입별 처리:
   - `delivered`: emails.delivered_at 업데이트, delivered_count 증가
   - `open`: emails.opened_at, open_count 업데이트, opened_count 증가
   - `click`: emails.clicked_at, click_count 업데이트, clicked_count 증가
   - `bounce`: emails.bounce_type, bounce_reason 업데이트, bounced_count 증가
   - `spam_report`: emails.spam_reported_at 업데이트, spam_reported_count 증가
3. 답장 수신 감지 시: sequence_enrollments.status = 'stopped_reply_received'

### Rate Limiting
- user_email_accounts의 daily_limit, monthly_limit 확인
- emails의 scheduled_at으로 발송 시간 제어