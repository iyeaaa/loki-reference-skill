// Database schema for Send Grinda email automation system
export const DATABASE_SCHEMA = `
# Send Grinda Database Schema

## System Overview
Send Grinda is a SendGrid-based B2B email automation platform for sales and marketing teams.
- **Core Features**: Lead management, email sequences, performance analytics, AI insights
- **Database**: PostgreSQL 17.2

---

## Core Tables

### 1. EMAILS ⭐ Most Important
Tracks all sent/received emails and performance metrics.

\`\`\`sql
CREATE TABLE emails (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_email_account_id UUID NOT NULL,
  lead_id UUID,
  sequence_id UUID,
  step_id UUID,

  direction VARCHAR NOT NULL,  -- 'outbound' or 'inbound'
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  body_text TEXT,
  body_html TEXT,

  status VARCHAR NOT NULL DEFAULT 'draft',
  -- Status: draft, scheduled, sent, delivered, opened, clicked, replied, bounced, failed, spam, unsubscribed

  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,

  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  bounce_type VARCHAR,  -- 'soft', 'hard', 'block'
  bounce_reason TEXT,

  message_id VARCHAR(500),
  thread_id VARCHAR(500),
  sendgrid_message_id VARCHAR(500),

  lead_name VARCHAR(255),  -- Denormalized
  lead_email VARCHAR(255),
  sequence_name VARCHAR(255),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

**Key Metrics Queries:**

Open Rate:
\`\`\`sql
SELECT
  ROUND(COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric /
        NULLIF(COUNT(*), 0)::numeric * 100, 2) as open_rate
FROM emails
WHERE workspace_id = ? AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')
  AND direction = 'outbound';
\`\`\`

Reply Rate:
\`\`\`sql
SELECT
  ROUND(COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END)::numeric /
        NULLIF(COUNT(*), 0)::numeric * 100, 2) as reply_rate
FROM emails
WHERE workspace_id = ? AND direction = 'outbound';
\`\`\`

Time Filters:
- Today: \`sent_at >= CURRENT_DATE\`
- This week: \`sent_at >= date_trunc('week', CURRENT_TIMESTAMP)\`
- This month: \`sent_at >= date_trunc('month', CURRENT_TIMESTAMP)\`
- Last N days: \`sent_at >= CURRENT_DATE - INTERVAL 'N days'\`

---

### 2. EMAIL_REPLIES
AI sentiment analysis for replies.

\`\`\`sql
CREATE TABLE email_replies (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  original_email_id UUID NOT NULL,
  reply_email_id UUID NOT NULL,

  sentiment VARCHAR,  -- 'positive', 'neutral', 'negative', 'interested', 'not_interested'
  intent VARCHAR(255),
  ai_summary TEXT,

  is_read BOOLEAN DEFAULT false,
  assigned_to UUID,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

### 3. LEADS ⭐ Important
B2B lead information.

\`\`\`sql
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,

  company_name VARCHAR(255),
  contact_name VARCHAR(255),
  website_url VARCHAR(500),
  business_type VARCHAR(100),
  description TEXT,

  address TEXT,
  country VARCHAR(100),
  city VARCHAR(100),
  employee_count VARCHAR(50),  -- e.g., "10-50", "100+"

  lead_status VARCHAR NOT NULL DEFAULT 'new',
  -- Status: new, contacted, qualified, unqualified, converted, lost, unsubscribed

  lead_score INTEGER,  -- 0-100
  lead_source VARCHAR(100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_contacted_at TIMESTAMP WITH TIME ZONE
);
\`\`\`

**Lead Analysis Queries:**

Conversion Rate:
\`\`\`sql
SELECT
  COUNT(CASE WHEN lead_status = 'converted' THEN 1 END) as converted,
  ROUND(COUNT(CASE WHEN lead_status = 'converted' THEN 1 END)::numeric /
        NULLIF(COUNT(*), 0)::numeric * 100, 2) as conversion_rate
FROM leads WHERE workspace_id = ?;
\`\`\`

Status Distribution:
\`\`\`sql
SELECT lead_status, COUNT(*) as count
FROM leads WHERE workspace_id = ?
GROUP BY lead_status ORDER BY count DESC;
\`\`\`

---

### 4. LEAD Related Tables (1:N)

**LEAD_CONTACTS:**
\`\`\`sql
CREATE TABLE lead_contacts (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL,
  contact_type VARCHAR NOT NULL,  -- 'phone', 'email', 'fax'
  contact_value VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

**LEAD_SOCIAL_MEDIA:**
\`\`\`sql
CREATE TABLE lead_social_media (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL,
  platform VARCHAR NOT NULL,  -- 'facebook', 'instagram', 'twitter', 'linkedin'
  url VARCHAR(500) NOT NULL,
  username VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

### 5. SEQUENCES ⭐ Important
Automated email campaign sequences.

\`\`\`sql
CREATE TABLE sequences (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  customer_group_id UUID,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  workflow_data TEXT,  -- React Flow JSON
  selected_lead_ids TEXT,  -- JSON array

  status VARCHAR NOT NULL DEFAULT 'draft',
  -- Status: draft, active, paused, archived, completed

  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

### 6. SEQUENCE_STEPS
Individual steps in a sequence.

\`\`\`sql
CREATE TABLE sequence_steps (
  id UUID PRIMARY KEY,
  sequence_id UUID NOT NULL,

  step_order INTEGER NOT NULL,
  delay_days INTEGER DEFAULT 0,
  scheduled_hour INTEGER DEFAULT 9,  -- 0-23
  scheduled_minute INTEGER DEFAULT 0,
  timezone VARCHAR(50) DEFAULT 'Asia/Seoul',

  email_subject VARCHAR(500) NOT NULL,
  email_body_text TEXT,
  email_body_html TEXT,
  email_template_id UUID,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

**Example 3-Step Sequence:**
1. Day 0, 9:00 AM - "Introduction to our product"
2. Day 3, 10:00 AM - "Did you see our last email?"
3. Day 7, 2:00 PM - "Last chance offer"

---

### 7. SEQUENCE_ENROLLMENTS
Tracks which leads are enrolled in sequences.

\`\`\`sql
CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY,
  sequence_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  user_email_account_id UUID NOT NULL,

  current_step_order INTEGER DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'active',
  -- Status: active, paused, completed, stopped, bounced, unsubscribed

  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  next_step_scheduled_at TIMESTAMP WITH TIME ZONE
);
\`\`\`

**Sequence Performance:**
\`\`\`sql
SELECT s.name, COUNT(*) as enrollments,
  COUNT(CASE WHEN se.status = 'completed' THEN 1 END) as completed,
  ROUND(COUNT(CASE WHEN se.status = 'completed' THEN 1 END)::numeric /
        NULLIF(COUNT(*), 0)::numeric * 100, 2) as completion_rate
FROM sequence_enrollments se
JOIN sequences s ON se.sequence_id = s.id
WHERE s.workspace_id = ?
GROUP BY s.id, s.name ORDER BY completion_rate DESC;
\`\`\`

---

### 8. SEQUENCE_STEP_EXECUTIONS
Tracks execution of each step.

\`\`\`sql
CREATE TABLE sequence_step_executions (
  id UUID PRIMARY KEY,
  enrollment_id UUID NOT NULL,
  step_id UUID NOT NULL,

  step_order INTEGER NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  -- Status: pending, scheduled, sent, delivered, failed, skipped

  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  email_id UUID,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

### 9. CUSTOMER_GROUPS
Lead segmentation for targeting.

\`\`\`sql
CREATE TABLE customer_groups (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  criteria JSONB,  -- Filter criteria
  is_dynamic BOOLEAN DEFAULT false,

  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

**CUSTOMER_GROUP_MEMBERS:**
\`\`\`sql
CREATE TABLE customer_group_members (
  id UUID PRIMARY KEY,
  group_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  added_by UUID,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

### 10. WORKSPACES & USERS

**WORKSPACES:**
\`\`\`sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

**USERS:**
\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  user_role VARCHAR NOT NULL DEFAULT 'user',  -- 'admin' or 'user'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);
\`\`\`

**USER_EMAIL_ACCOUNTS:**
\`\`\`sql
CREATE TABLE user_email_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL,

  email_address VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  api_key TEXT NOT NULL,  -- SendGrid API key
  sendgrid_verified_sender_id VARCHAR(255),

  is_verified BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  status VARCHAR NOT NULL DEFAULT 'inactive',
  -- Status: active, inactive, error, rate_limited, suspended

  daily_limit INTEGER,
  monthly_limit INTEGER,
  daily_sent_count INTEGER DEFAULT 0,
  monthly_sent_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

---

## Key Constraints & Rules

1. **workspace_id Filter Required**: All SELECT queries MUST include \`WHERE workspace_id = '...'\` for multi-tenant isolation.

2. **Read-Only**: Only SELECT queries allowed. No INSERT, UPDATE, DELETE, DROP, TRUNCATE.

3. **Division by Zero Prevention**: Always use \`NULLIF()\` in division operations.
   - ❌ Wrong: \`value / total\`
   - ✅ Correct: \`value / NULLIF(total, 0)\`

4. **Timezone**: All timestamps use \`TIMESTAMP WITH TIME ZONE\`.

5. **Performance**:
   - Select only needed columns
   - Use LIMIT (default 100, max 1000)
   - Use indexed columns in WHERE clauses

6. **NULL Handling**: Use \`IS NULL\`, \`IS NOT NULL\`, and \`COALESCE()\` explicitly.

---

## Common PostgreSQL Functions

**Date/Time:**
- \`date_trunc('week'|'month', timestamp)\`: Truncate to week/month
- \`CURRENT_TIMESTAMP\`: Current time with timezone
- \`CURRENT_DATE\`: Today's date
- \`INTERVAL '7 days'\`: Duration
- \`EXTRACT(dow FROM timestamp)\`: Day of week (0=Sunday, 6=Saturday)

**Aggregation:**
- \`COUNT(CASE WHEN condition THEN 1 END)\`: Conditional count
- \`ROUND(value::numeric, 2)\`: Round to 2 decimals
- \`COALESCE(value, default)\`: Default for NULL
- \`NULLIF(value, 0)\`: Prevent division by zero

**Text:**
- \`ILIKE\`: Case-insensitive pattern matching
- \`CONCAT(str1, str2)\`: String concatenation

---

## Relationship Summary

\`\`\`
workspaces (1) ───< (N) emails, leads, sequences, user_email_accounts, customer_groups
users (1) ───< (N) workspaces, leads, sequences, user_email_accounts
leads (1) ───< (N) emails, sequence_enrollments, lead_contacts, lead_social_media
sequences (1) ───< (N) sequence_steps, sequence_enrollments, emails
sequence_enrollments (1) ───< (N) sequence_step_executions
customer_groups (1) ───< (N) sequences, customer_group_members
\`\`\`

---

## FAQ Queries

**Emails sent today:**
\`\`\`sql
SELECT COUNT(*) FROM emails
WHERE workspace_id = ? AND sent_at >= CURRENT_DATE AND direction = 'outbound';
\`\`\`

**This week's open rate:**
\`\`\`sql
SELECT ROUND(COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric /
  NULLIF(COUNT(*), 0)::numeric * 100, 2) as open_rate
FROM emails
WHERE workspace_id = ? AND sent_at >= date_trunc('week', CURRENT_TIMESTAMP)
  AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied');
\`\`\`

**Best performing sequence:**
\`\`\`sql
SELECT s.name, COUNT(e.id) as emails,
  COUNT(CASE WHEN e.replied_at IS NOT NULL THEN 1 END) as replies,
  ROUND(COUNT(CASE WHEN e.replied_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(e.id), 0)::numeric * 100, 2) as reply_rate
FROM sequences s
LEFT JOIN emails e ON s.id = e.sequence_id AND e.workspace_id = ?
WHERE s.workspace_id = ?
GROUP BY s.id, s.name ORDER BY reply_rate DESC LIMIT 5;
\`\`\`

**New leads count:**
\`\`\`sql
SELECT COUNT(*) FROM leads WHERE workspace_id = ? AND lead_status = 'new';
\`\`\`

**Leads by industry:**
\`\`\`sql
SELECT business_type, COUNT(*) as count
FROM leads WHERE workspace_id = ?
GROUP BY business_type ORDER BY count DESC LIMIT 10;
\`\`\`
`

export function getRelevantSchema(_question: string): string {
  return DATABASE_SCHEMA
}
