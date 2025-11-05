// Condensed Database Schema for SQL Generation
export const DATABASE_SCHEMA = `
# Send Grinda Database Schema (Condensed)

**Database:** PostgreSQL 17.2 | **Multi-tenant:** workspace_id required

---

## Core Tables

### emails ⭐ (Email tracking & metrics)
\`id, workspace_id, lead_id, sequence_id, step_id, direction, from_email, to_email, subject, status, sent_at, delivered_at, opened_at, clicked_at, replied_at, open_count, click_count\`
- status: draft, sent, delivered, opened, clicked, replied, bounced, failed, unsubscribed
- direction: outbound, inbound

### email_replies (AI sentiment)
\`id, workspace_id, original_email_id, reply_email_id, sentiment, intent, ai_summary\`
- sentiment: positive, neutral, negative, interested, not_interested

### leads ⭐ (B2B contact data)
\`id, workspace_id, company_name, contact_name, website_url, business_type, description, country, city, state, employee_count, lead_status, lead_score, lead_source, created_at, updated_at, last_contacted_at\`
- lead_status: new, contacted, qualified, unqualified, converted, lost, unsubscribed
- **IMPORTANT:** \`state\` column exists between \`city\` and \`employee_count\`

### lead_contacts (1:N with leads)
\`id, lead_id, contact_type, contact_value, contact_name, is_primary\`
- contact_type: phone, email, fax, other

### lead_social_media (1:N with leads)
\`id, lead_id, platform, url, username\`
- platform: facebook, instagram, twitter, linkedin

### sequences ⭐ (Email campaigns)
\`id, workspace_id, customer_group_id, name, description, status, created_by, created_at, updated_at\`
- status: draft, active, paused, archived, completed

### sequence_steps (1:N with sequences)
\`id, sequence_id, step_order, delay_days, scheduled_hour, email_subject, email_body_text, email_template_id\`

### sequence_enrollments (Lead enrollment tracking)
\`id, sequence_id, lead_id, user_email_account_id, current_step_order, status, enrolled_at, completed_at, next_step_scheduled_at\`
- status: active, paused, completed, stopped, bounced, unsubscribed

### sequence_step_executions (Step execution logs)
\`id, enrollment_id, step_id, step_order, status, scheduled_at, executed_at, email_id\`
- status: pending, scheduled, sent, delivered, failed, skipped

### customer_groups (Lead segmentation)
\`id, workspace_id, name, description, criteria, is_dynamic\`

### customer_group_members (1:N with customer_groups)
\`id, group_id, lead_id, added_by, added_at\`

### user_email_accounts (SendGrid accounts)
\`id, user_id, workspace_id, email_address, display_name, is_verified, is_default, status, daily_limit, monthly_limit, daily_sent_count, monthly_sent_count\`

### users, workspaces (System tables)
\`users: id, username, email, user_role\`
\`workspaces: id, name, owner_id, is_active\`

---

## Query Patterns

**Open Rate:**
\`\`\`sql
SELECT ROUND(COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 2) as open_rate
FROM emails WHERE workspace_id = ? AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied') AND direction = 'outbound'
\`\`\`

**Reply Rate:**
\`\`\`sql
SELECT ROUND(COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 2) as reply_rate
FROM emails WHERE workspace_id = ? AND direction = 'outbound'
\`\`\`

**Time Filters:**
- Today: \`sent_at >= CURRENT_DATE\`
- This week: \`sent_at >= date_trunc('week', CURRENT_TIMESTAMP)\`
- This month: \`sent_at >= date_trunc('month', CURRENT_TIMESTAMP)\`
- Last N days: \`sent_at >= CURRENT_DATE - INTERVAL 'N days'\`

---

## Essential Rules

1. **workspace_id REQUIRED**: All queries MUST include \`WHERE workspace_id = '...'\`
2. **Division by Zero**: Always use \`NULLIF(divisor, 0)\`
3. **Timezone**: All timestamps are \`TIMESTAMP WITH TIME ZONE\`
4. **LIMIT**: Use LIMIT (default 100, max 1000)
5. **NULL Handling**: Use \`IS NULL\`, \`IS NOT NULL\`, \`COALESCE()\`

---

## Common Functions

**Date/Time:** \`date_trunc()\`, \`CURRENT_TIMESTAMP\`, \`CURRENT_DATE\`, \`INTERVAL\`, \`EXTRACT()\`
**Aggregation:** \`COUNT(CASE WHEN ... THEN 1 END)\`, \`ROUND(...::numeric, 2)\`, \`COALESCE()\`, \`NULLIF()\`
**Text:** \`ILIKE\`, \`CONCAT()\`

---

## Relationships

\`\`\`
workspaces (1) ───< (N) emails, leads, sequences, user_email_accounts, customer_groups
leads (1) ───< (N) emails, sequence_enrollments, lead_contacts, lead_social_media
sequences (1) ───< (N) sequence_steps, sequence_enrollments, emails
sequence_enrollments (1) ───< (N) sequence_step_executions
customer_groups (1) ───< (N) sequences, customer_group_members
\`\`\`

---

## ⚠️ Query Complexity Limits

**Keep queries SIMPLE:**
- Maximum 3 CTEs (WITH clauses)
- Maximum 5 UNION ALL operations
- Maximum 5 subqueries
- Prefer simple SELECT with JOINs over complex CTEs

**For trend analysis:**
- Use simple GROUP BY with time buckets
- Avoid multiple separate CTEs - combine logic when possible
- Example: \`SELECT date_trunc('day', sent_at) as date, COUNT(*) FROM emails GROUP BY date\`

---

## Quick Examples

**Daily email trend (SIMPLE):**
\`\`\`sql
SELECT date_trunc('day', sent_at) as date, COUNT(*) as count
FROM emails WHERE workspace_id = ? AND sent_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date ORDER BY date DESC
\`\`\`

**Lead status counts:**
\`\`\`sql
SELECT lead_status, COUNT(*) as count FROM leads WHERE workspace_id = ? GROUP BY lead_status ORDER BY count DESC
\`\`\`

**Sequence performance:**
\`\`\`sql
SELECT s.name, COUNT(e.id) as emails, COUNT(CASE WHEN e.replied_at IS NOT NULL THEN 1 END) as replies
FROM sequences s LEFT JOIN emails e ON s.id = e.sequence_id AND e.workspace_id = ?
WHERE s.workspace_id = ? GROUP BY s.id, s.name ORDER BY replies DESC LIMIT 10
\`\`\`
`

export function getRelevantSchema(_question: string): string {
  return DATABASE_SCHEMA
}
