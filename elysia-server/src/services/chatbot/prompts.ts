import type { ChatMessage } from "./state"

function getCurrentKSTTime(): string {
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstDate = new Date(now.getTime() + kstOffset)

  const year = kstDate.getUTCFullYear()
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(kstDate.getUTCDate()).padStart(2, "0")
  const hour = String(kstDate.getUTCHours()).padStart(2, "0")
  const minute = String(kstDate.getUTCMinutes()).padStart(2, "0")
  const second = String(kstDate.getUTCSeconds()).padStart(2, "0")

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const weekday = weekdays[kstDate.getUTCDay()]

  return `${year}-${month}-${day} (${weekday}) ${hour}:${minute}:${second} KST`
}

export const SYSTEM_PROMPT = `You are an AI assistant for Send Grinda email automation system.

**Current Time:** ${getCurrentKSTTime()}

**Role:**
- Understand natural language questions and query the database
- Generate PostgreSQL queries for accurate data retrieval
- Analyze results and provide actionable insights

**Principles:**
- Accuracy: Provide data-driven answers
- Clarity: Explain complex data simply
- Actionability: Suggest concrete next steps
- Security: Always include workspace_id filters`

export function getAnalysisPrompt(
  question: string,
  workspaceId: string,
  recentMessages: ChatMessage[],
) {
  const context =
    recentMessages.length > 0
      ? `\nRecent context:\n${recentMessages
          .slice(-3)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}`
      : ""

  return `${SYSTEM_PROMPT}

# Task: Analyze Question

User question: "${question}"
Workspace ID: ${workspaceId}${context}

Available data:
- emails: Email records (status, opens, clicks, replies)
- leads: Lead information (company, status, score, industry)
- sequences: Email sequences and enrollments
- email_replies: Reply sentiment analysis
- users, workspaces: User and workspace data

Respond in JSON format:
{
  "intent": "Question intent (e.g., performance, lead analysis, trend, lead creation, data update, data deletion)",
  "requiredTables": ["Required table list"],
  "timeRange": "Time range (e.g., today, this week, last 30 days) or null",
  "needsClarification": false,
  "clarificationQuestion": null,
  "analysisType": "aggregate | trend | comparison | detail",
  "operationType": "read | create | update | delete"
}

**operationType Classification:**
- "read": Query, analyze, stats, show, tell (SELECT)
- "create": New data, add, insert (INSERT)
- "update": Modify existing data, change, update (UPDATE)
- "delete": Remove data, delete (DELETE)

**Important:**
- For mutation operations (create/update/delete), set needsClarification to false
- Don't request clarification when user clearly states the action
- For sample data creation requests, classify as create and proceed
- Only set needsClarification to true for ambiguous read queries`
}

export function getSQLGenerationPrompt(
  question: string,
  workspaceId: string,
  schemaContext: string,
  metadata: Record<string, unknown>,
) {
  const operationType = (metadata as { operationType?: string }).operationType || "read"

  const operationGuidelines =
    operationType === "create"
      ? `
# CREATE Operation Requirements

1. **Generate INSERT queries**
2. **Required columns:**
   - \`id\`: UUID (\`gen_random_uuid()\`)
   - \`workspace_id\`: '${workspaceId}'
   - \`created_at\`: CURRENT_TIMESTAMP
   - \`updated_at\`: CURRENT_TIMESTAMP
3. **Business logic columns:**
   - Check NOT NULL constraints per table
   - Columns with defaults can be omitted
   - Use meaningful values for sample data
4. **RETURNING clause:** Add \`RETURNING *\` to return created data

⚠️ **USE CTE (WITH) for Complex Operations - REQUIRED!**
- **MUST USE**: Common Table Expressions (WITH clause) for multi-step INSERT operations
- This eliminates ID reference errors completely
- Each CTE step can reference previous steps by name
- Return all results in final SELECT using json_build_object

**CTE Example Pattern:**
\`\`\`sql
WITH
  new_group AS (
    INSERT INTO customer_groups (...) VALUES (...) RETURNING *
  ),
  new_lead_1 AS (
    INSERT INTO leads (id, workspace_id, ..., created_at, updated_at)
    VALUES (gen_random_uuid(), '${workspaceId}', ..., CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  ),
  new_lead_1_contact AS (
    INSERT INTO lead_contacts (id, lead_id, contact_type, ...)
    SELECT gen_random_uuid(), id, 'email', ... FROM new_lead_1
    RETURNING *
  )
SELECT json_build_object(
  'group', (SELECT row_to_json(new_group.*) FROM new_group),
  'leads', json_build_object(
    'lead_1', (SELECT row_to_json(new_lead_1.*) FROM new_lead_1),
    'contact', (SELECT row_to_json(new_lead_1_contact.*) FROM new_lead_1_contact)
  )
) as result;
\`\`\`

**CRITICAL - Final SELECT Rules:**
1. **NEVER use CTE names in FROM clause**: CTEs are already executed, reference them in subqueries only
2. **Use subqueries with SELECT**: \`(SELECT row_to_json(cte.*) FROM cte)\`
3. **For multiple rows, use UNION ALL**:
   \`\`\`sql
   SELECT json_agg(row_to_json(s.*)) FROM (
     SELECT * FROM cte_1
     UNION ALL SELECT * FROM cte_2
   ) s
   \`\`\`
4. **WRONG**: \`FROM step_1, step_2, step_3\` ❌
5. **CORRECT**: \`(SELECT json_agg(...) FROM (SELECT * FROM step_1 UNION ALL ...) s)\` ✅

**Note:** Sequential queries with placeholders are deprecated. Use CTE instead for reliability.

⚠️ **INSERT Column Requirements**
- Always include ALL columns explicitly in INSERT statements (don't rely on defaults)
- **CRITICAL**: Include \`updated_at\` for tables that have it: \`lead_contacts\`, \`lead_social_media\`
  - Even though it has a default, explicitly include it: \`updated_at = CURRENT_TIMESTAMP\`
- For \`lead_contacts\`: MUST include \`label\` column (use 'main', 'support', 'sales', etc.)
- For nullable columns with no value: explicitly set to NULL in VALUES clause
- Never omit columns from the column list, even if they're nullable

---

## 🎯 SPECIAL FLOW: Customer Group + Sequence AI Builder (7-Step Process)

When user requests to create a customer group with sequence automation, follow this complete 7-step process:

**Full Process Overview:**
\`\`\`
1. Create Customer Group → get customer_group_id
2. Create Leads and Add to Group Members (create all leads from user data + add to group + populate all related tables)
3. Create Sequence → get sequence_id (linked to customer_group_id)
4. Create Sequence Steps (AI-designed 3-5 steps with email content)
5. Activate Sequence (status = 'active')
6. Create Sequence Enrollments (auto-enroll all leads in group)
7. Schedule First Step Executions (schedule first step)
\`\`\`

**Related Tables & Schema:**

**Core Tables:**
- \`customer_groups\`: Groups of leads
- \`customer_group_members\`: Many-to-many relationship (group ↔ leads)
- \`leads\`: Main lead information
- \`sequences\`: Email sequence campaigns
- \`sequence_steps\`: Individual steps in sequence
- \`sequence_enrollments\`: Lead enrollments in sequences
- \`sequence_step_executions\`: Scheduled/executed steps

**Lead Detail Tables (all reference leads.id with CASCADE delete):**
- \`lead_contacts\`: Contact info (email, phone, fax, other)
- \`lead_social_media\`: Social media profiles (facebook, instagram, twitter, linkedin)
- \`lead_products\`: Product offerings
- \`lead_business_sectors\`: Business sectors
- \`lead_product_categories\`: Product categories
- \`lead_industry_types\`: Industry classifications

**Key Relationships:**
\`\`\`
customer_groups (1) ─── (N) customer_group_members ─── (1) leads
customer_groups (1) ─── (N) sequences
sequences (1) ─── (N) sequence_steps
sequences (1) ─── (N) sequence_enrollments ─── (1) leads
sequence_enrollments (1) ─── (N) sequence_step_executions ─── (1) sequence_steps
leads (1) ─── (N) lead_contacts, lead_social_media, lead_products, etc.
\`\`\`

**Complete CTE Example: Customer Group + Leads + Sequence + Enrollments**

This example shows how to use a single CTE query to create an entire outreach campaign atomically.
The full example is available in \`elysia-server/CTE_EXAMPLE.sql\` - study it carefully!

**Key Benefits:**
- ✅ No placeholder ID errors - reference CTE names directly
- ✅ Atomic transaction - all operations succeed or all fail
- ✅ Easy to read and maintain
- ✅ Can handle unlimited complexity

**Structure Overview:**
\`\`\`sql
WITH
  new_group AS (INSERT INTO customer_groups (...) RETURNING *),
  new_lead_1 AS (INSERT INTO leads (...) RETURNING *),
  new_lead_1_contact AS (INSERT INTO lead_contacts SELECT ..., id FROM new_lead_1 RETURNING *),
  new_lead_1_social AS (INSERT INTO lead_social_media SELECT ..., id FROM new_lead_1 RETURNING *),
  new_lead_1_sectors AS (INSERT INTO lead_business_sectors SELECT ..., id FROM new_lead_1 RETURNING *),
  new_lead_2 AS (INSERT INTO leads (...) RETURNING *),
  new_lead_2_contact AS (INSERT INTO lead_contacts SELECT ..., id FROM new_lead_2 RETURNING *),
  new_sequence AS (INSERT INTO sequences SELECT ..., id FROM new_group RETURNING *),
  new_steps AS (INSERT INTO sequence_steps SELECT ..., id FROM new_sequence RETURNING *),
  activated_seq AS (UPDATE sequences SET status='active' WHERE id = (SELECT id FROM new_sequence) RETURNING *),
  enrollments AS (INSERT INTO sequence_enrollments SELECT ... FROM new_sequence, new_lead_1 RETURNING *),
  executions AS (INSERT INTO sequence_step_executions SELECT ... RETURNING *)
SELECT json_build_object(
  'group', (SELECT row_to_json(new_group.*) FROM new_group),
  'leads', json_agg(leads.*),
  'sequence', (SELECT row_to_json(activated_seq.*) FROM activated_seq),
  'enrollments', json_agg(enrollments.*)
) as result;
\`\`\`

**Important CTE Rules:**
1. Each CTE step can only reference CTEs defined BEFORE it
2. Use \`SELECT ... FROM cte_name\` to reference previous step's ID
3. Always include \`RETURNING *\` on INSERTs/UPDATEs
4. Final SELECT aggregates all results into JSON

**Key Implementation Notes:**

**CRITICAL - Column Names (MUST USE EXACT NAMES):**
- \`lead_products\`: Use \`product_name\` (NOT product, NOT name)
- \`lead_business_sectors\`: Use \`sector_name\` (NOT sector, NOT business_sector)
- \`lead_product_categories\`: Use \`category_name\` (NOT category)
- \`lead_industry_types\`: Use \`industry_name\` (NOT industry_type, NOT industry)

**CRITICAL - Column Length Limits:**
- \`leads.business_type\`: **100 chars max** - Use ONLY first/primary business type
- \`leads.company_name\`: 255 chars max
- \`leads.contact_name\`: 255 chars max
- When CSV has comma-separated values (e.g., "IT, Cloud, AI"), split them into separate table rows

1. **Step 1 - Create Customer Group:**
   - Required: \`id\`, \`workspace_id\`, \`name\`, \`is_dynamic\`, \`created_at\`, \`updated_at\`
   - Required value: \`is_dynamic\` = false (NOT NULL, cannot be NULL)
   - Optional (set to null): \`description\`, \`criteria\`, \`created_by\`
   - Example: Only provide \`name\` for the group, set \`is_dynamic\` to false, others to null

2. **Step 2 - Create ALL Leads with Complete Data:**
   - Create each lead from user-provided data
   - **CRITICAL - leads table column order**: \`id, workspace_id, company_name, contact_name, website_url, business_type, description, address, country, city, employee_count, lead_status, lead_score, lead_source, created_at, updated_at\`
   - **IMPORTANT**: Column count MUST match VALUES count exactly (common error: missing \`city\` causes column 19 error)
   - **IMPORTANT**: \`business_type\` column has 100 char limit - use ONLY the primary/first business type
   - Add contacts to \`lead_contacts\` (email, phone, etc.)
     - **Required columns**: \`id\`, \`lead_id\`, \`contact_type\`, \`contact_value\`, \`is_primary\`, \`created_at\`, \`updated_at\`
     - **Always include**: \`label\` (use 'main' for primary email, 'support', 'sales', etc.)
     - **Optional**: \`contact_name\` (can be NULL if no contact person name available)
     - **Column order**: id, lead_id, contact_type, contact_value, contact_name, label, is_primary, created_at, updated_at
   - Add social media to \`lead_social_media\` if provided
     - **Required columns**: \`id\`, \`lead_id\`, \`platform\`, \`url\`, \`is_verified\`, \`created_at\`, \`updated_at\`
     - **Optional**: \`username\`, \`follower_count\`
   - Add products to \`lead_products\` if provided (separate rows for each)
     - **Required columns**: \`id\`, \`lead_id\`, \`product_name\`, \`created_at\`
     - **Optional**: \`description\`
     - Only has \`created_at\`, no \`updated_at\`
   - Add business sectors to \`lead_business_sectors\` if provided (separate rows for each, comma-separated)
     - **Required columns**: \`id\`, \`lead_id\`, \`sector_name\`, \`created_at\`
     - Only has \`created_at\`, no \`updated_at\`
   - Add product categories to \`lead_product_categories\` if provided (separate rows for each)
     - **Required columns**: \`id\`, \`lead_id\`, \`category_name\`, \`created_at\`
     - Only has \`created_at\`, no \`updated_at\`
   - Add industry types to \`lead_industry_types\` if provided (separate rows for each)
     - **Required columns**: \`id\`, \`lead_id\`, \`industry_name\`, \`created_at\`
     - **IMPORTANT**: Use \`industry_name\` (NOT \`industry_type\`)
     - Only has \`created_at\`, no \`updated_at\`
   - Add to \`customer_group_members\` (link to group)
   - Repeat for ALL leads in user data

3. **Step 4 - AI-Designed Sequence Steps:**
   - **Required columns**: \`id\`, \`sequence_id\`, \`step_order\`, \`delay_days\`, \`email_subject\`, \`created_at\`, \`updated_at\`
   - **Optional columns**: \`scheduled_hour\`, \`scheduled_minute\`, \`timezone\`, \`email_body_text\`, \`email_body_html\`, \`email_template_id\`
   - **CRITICAL**: Must include \`email_template_id\` column (set to NULL if not using template)
   - Generate 3-5 steps based on business context
   - Include personalized subject lines
   - Use template variables: \`{{contact_name}}\`, \`{{company_name}}\`
   - Set appropriate delays: Step 1 (0 days), Step 2 (3 days), Step 3 (5 days)
   - Set optimal send times: 9AM, 10AM, 2PM KST
   - **Email content**: Focus on text content in \`email_body_text\`, set \`email_body_html\` to null
   - Use plain text with \\\\n for line breaks (no HTML tags)
   - **CRITICAL**: Use only straight quotes (') in email text, NOT curly quotes (' or ')

4. **Step 6 - Enrollments:**
   - Must fetch active \`user_email_account_id\` from workspace
   - Set \`next_step_scheduled_at\` based on first step's schedule
   - Status: 'active'

5. **Step 7 - First Step Execution:**
   - Schedule only the FIRST step for each enrollment
   - Use step_id from Step 4.1 (first sequence step)
   - Calculate \`scheduled_at\`: today/tomorrow at scheduled_hour

**Response Format:**
Return as JSON with \`queries\` array and \`explanation\`.

**Basic INSERT Example (Customer Group):**
\`\`\`sql
INSERT INTO customer_groups (
  id, workspace_id, name, description, criteria, is_dynamic, created_by, created_at, updated_at
) VALUES (
  gen_random_uuid(), '${workspaceId}', 'Enterprise IT Companies',
  'Large IT companies with 100+ employees',
  '{"business_type": "IT", "employee_count": "100+"}'::jsonb,
  false, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING *;
\`\`\`

**IMPORTANT**: \`is_dynamic\` must be \`false\` (or \`true\`), NEVER \`null\`

**Complex INSERT Example (Sequential Execution):**

Response format:
\`\`\`json
{
  "queries": [
    "query1",
    "query2",
    "query3"
  ],
  "explanation": "Description"
}
\`\`\`

Example:
\`\`\`json
{
  "queries": [
    "-- 1) Create lead\\nINSERT INTO leads (id, workspace_id, company_name, contact_name, website_url, business_type, description, address, country, city, employee_count, lead_status, lead_score, lead_source, created_at, updated_at) VALUES (gen_random_uuid(), '${workspaceId}', 'Tech Innovation Corp', 'Jane Smith', 'https://techinnovation.com', 'IT Services', 'Leading AI and cloud solutions provider', NULL, 'USA', 'San Francisco', '50-100', 'new', 85, 'Manual Entry', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *;",
    "-- 2) Add contact (using previous query ID)\\nINSERT INTO lead_contacts (id, lead_id, contact_type, contact_value, contact_name, label, is_primary, created_at, updated_at) VALUES (gen_random_uuid(), '{{PREV_QUERY_1_ID}}', 'email', 'jane.smith@techinnovation.com', 'Jane Smith', 'main', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *;",
    "-- 3) Verify result\\nSELECT * FROM leads WHERE id = '{{PREV_QUERY_1_ID}}';"
  ],
  "explanation": "Creates lead and associated data sequentially. Uses first query's lead ID for contacts."
}
\`\`\`

**Response format:**
- **Single INSERT**: Return SQL query directly as string
- **Complex multi-step INSERT**: Return as single CTE query (not queries array)

**Simple request example** (1 customer group):
\`\`\`sql
INSERT INTO customer_groups (
  id, workspace_id, name, description, criteria, is_dynamic, created_by, created_at, updated_at
) VALUES (
  gen_random_uuid(), '${workspaceId}', 'Enterprise IT Companies', 'Large IT companies', '{}'::jsonb, false, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING *;
\`\`\`

**Complex request example** (lead + contacts + social media using CTE):
\`\`\`sql
WITH
  new_lead AS (
    INSERT INTO leads (id, workspace_id, company_name, ...)
    VALUES (gen_random_uuid(), '${workspaceId}', 'Tech Corp', ...)
    RETURNING *
  ),
  new_contact AS (
    INSERT INTO lead_contacts (id, lead_id, contact_type, contact_value, ...)
    SELECT gen_random_uuid(), id, 'email', 'contact@example.com', ...
    FROM new_lead
    RETURNING *
  ),
  new_social AS (
    INSERT INTO lead_social_media (id, lead_id, platform, url, ...)
    SELECT gen_random_uuid(), id, 'linkedin', 'https://linkedin.com/company/...',  ...
    FROM new_lead
    RETURNING *
  )
SELECT json_build_object(
  'lead', (SELECT row_to_json(new_lead.*) FROM new_lead),
  'contact', (SELECT row_to_json(new_contact.*) FROM new_contact),
  'social', (SELECT row_to_json(new_social.*) FROM new_social)
) as result;
\`\`\`
`
      : operationType === "update"
        ? `
# UPDATE Operation Requirements

1. **Generate UPDATE queries**
2. **Required conditions:**
   - \`WHERE workspace_id = '${workspaceId}'\` must be included
   - Specify exact record to update (id or unique condition)
3. **Auto-update:** Include \`updated_at = CURRENT_TIMESTAMP\`
4. **RETURNING clause:** Add \`RETURNING *\` to return modified data
5. **Safety:** Clear WHERE conditions to prevent unintended mass updates

⚠️ **Foreign Key Considerations (Very Important!)**
Consider foreign key relationships when updating:

**Key relationships:**
- \`leads\` updates affect: \`emails\`, \`sequence_enrollments\`, \`lead_contacts\`, \`lead_social_media\`, \`customer_group_members\`
  - Impact: Changing lead status may require stopping active sequences
- \`sequences\` updates affect: \`sequence_steps\`, \`sequence_enrollments\`, \`emails\`
  - Impact: Setting sequence to 'paused' may require pausing enrollments
- \`sequence_enrollments\` updates affect: \`sequence_step_executions\`
  - Impact: Stopping enrollment requires canceling scheduled step executions

**Complex UPDATE Example (with related data):**
Changing lead to 'unsubscribed' and stopping active sequences:
\`\`\`json
{
  "queries": [
    "UPDATE leads SET lead_status = 'unsubscribed', updated_at = CURRENT_TIMESTAMP WHERE id = '{{LEAD_ID}}' AND workspace_id = '${workspaceId}' RETURNING *;",
    "UPDATE sequence_enrollments SET status = 'unsubscribed', stopped_at = CURRENT_TIMESTAMP WHERE lead_id = '{{LEAD_ID}}' AND status = 'active' RETURNING *;",
    "UPDATE sequence_step_executions SET status = 'skipped' WHERE enrollment_id IN (SELECT id FROM sequence_enrollments WHERE lead_id = '{{LEAD_ID}}') AND status = 'pending' RETURNING *;"
  ],
  "explanation": "Changes lead to unsubscribed, stops active sequences, and skips scheduled step executions."
}
\`\`\`

**Simple UPDATE Example:**
\`\`\`sql
UPDATE leads
SET lead_score = 90, updated_at = CURRENT_TIMESTAMP
WHERE id = '{{LEAD_ID}}' AND workspace_id = '${workspaceId}'
RETURNING *;
\`\`\`
`
        : operationType === "delete"
          ? `
# DELETE Operation Requirements

1. **Generate DELETE queries**
2. **Required conditions:**
   - \`WHERE workspace_id = '${workspaceId}'\` must be included
   - Specify exact record to delete (id or unique condition)
3. **RETURNING clause:** Add \`RETURNING *\` to confirm deleted data
4. **Safety:** Clear WHERE conditions to prevent unintended mass deletion
5. **Soft Delete:** If \`deleted_at\` column exists, use UPDATE instead

⚠️ **Foreign Key Considerations (Very Important!)**
Consider CASCADE behavior and related tables when deleting:

**Key relationships and deletion impact:**

**1. \`leads\` deletion affects:**
   - \`emails\` (lead_id) - All related emails
   - \`sequence_enrollments\` (lead_id) - Sequence registrations
   - \`lead_contacts\` (lead_id) - Contact info
   - \`lead_social_media\` (lead_id) - Social media
   - \`lead_products\` (lead_id) - Products
   - \`lead_business_sectors\` (lead_id) - Business sectors
   - \`lead_product_categories\` (lead_id) - Product categories
   - \`lead_industry_types\` (lead_id) - Industry types
   - \`customer_group_members\` (lead_id) - Group memberships

**2. \`sequences\` deletion affects:**
   - \`sequence_steps\` (sequence_id) - Sequence steps
   - \`sequence_enrollments\` (sequence_id) - Enrollments
   - \`emails\` (sequence_id) - Sent emails

**3. \`sequence_enrollments\` deletion affects:**
   - \`sequence_step_executions\` (enrollment_id) - Step execution records

**4. \`customer_groups\` deletion affects:**
   - \`customer_group_members\` (group_id) - Group members
   - \`sequences\` (customer_group_id) - Connected sequences

**CASCADE DELETE Example (complex case):**
To fully delete a lead with all related data:
\`\`\`json
{
  "queries": [
    "DELETE FROM email_replies WHERE reply_email_id IN (SELECT id FROM emails WHERE lead_id = '{{LEAD_ID}}') RETURNING *;",
    "DELETE FROM email_events WHERE email_id IN (SELECT id FROM emails WHERE lead_id = '{{LEAD_ID}}') RETURNING *;",
    "DELETE FROM sequence_step_executions WHERE enrollment_id IN (SELECT id FROM sequence_enrollments WHERE lead_id = '{{LEAD_ID}}') RETURNING *;",
    "DELETE FROM sequence_enrollments WHERE lead_id = '{{LEAD_ID}}' RETURNING *;",
    "DELETE FROM emails WHERE lead_id = '{{LEAD_ID}}' RETURNING *;",
    "DELETE FROM lead_contacts WHERE lead_id = '{{LEAD_ID}}' RETURNING *;",
    "DELETE FROM lead_social_media WHERE lead_id = '{{LEAD_ID}}' RETURNING *;",
    "DELETE FROM lead_products WHERE lead_id = '{{LEAD_ID}}' RETURNING *;",
    "DELETE FROM lead_business_sectors WHERE lead_id = '{{LEAD_ID}}' RETURNING *;",
    "DELETE FROM lead_product_categories WHERE lead_id = '{{LEAD_ID}}' RETURNING *;",
    "DELETE FROM lead_industry_types WHERE lead_id = '{{LEAD_ID}}' RETURNING *;",
    "DELETE FROM customer_group_members WHERE lead_id = '{{LEAD_ID}}' RETURNING *;",
    "DELETE FROM leads WHERE id = '{{LEAD_ID}}' AND workspace_id = '${workspaceId}' RETURNING *;"
  ],
  "explanation": "Sequentially deletes lead and all related data. Deletes child tables first to prevent foreign key errors."
}
\`\`\`

**Simple DELETE Example (no related data):**
\`\`\`sql
DELETE FROM lead_contacts
WHERE id = '{{CONTACT_ID}}' AND lead_id IN (SELECT id FROM leads WHERE workspace_id = '${workspaceId}')
RETURNING *;
\`\`\`

**Soft Delete Recommended (when possible):**
Instead of actual DELETE, use status change:
\`\`\`sql
UPDATE leads
SET lead_status = 'lost', updated_at = CURRENT_TIMESTAMP
WHERE id = '{{LEAD_ID}}' AND workspace_id = '${workspaceId}'
RETURNING *;
\`\`\`
`
          : `
# READ Operation Requirements

1. **Generate SELECT queries**
2. **Required filter:** \`WHERE workspace_id = '${workspaceId}'\` must be included
3. **Performance:** Select only needed columns, use appropriate indexes
4. **Limit:** Use LIMIT clause (default 100, max 1000)
5. **NULL handling:** Use IS NULL, IS NOT NULL explicitly
6. **Timezone:** Consider TIMESTAMP WITH TIME ZONE type
7. **Division by Zero Prevention:** Use NULLIF() or CASE WHEN for division
   - ❌ Wrong: \`COUNT(*) / total\`
   - ✅ Correct: \`COUNT(*) / NULLIF(total, 0)\`
`

  return `${SYSTEM_PROMPT}

# Task: Generate SQL Query (Operation: ${operationType.toUpperCase()})

${schemaContext}

---

**User Question:** "${question}"
**Workspace ID:** ${workspaceId}
**Analysis Result:** ${JSON.stringify(metadata, null, 2)}

${operationGuidelines}

# Common Requirements

1. **PostgreSQL syntax** required
2. **Workspace isolation:** All queries must include \`workspace_id = '${workspaceId}'\` filter

# Common Patterns

**⚠️ Important: Always use NULLIF() for all division operations!**

**Open Rate (Division by Zero Prevention):**
\`\`\`sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
  ROUND(
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100, 2
  ) as open_rate
FROM emails
WHERE workspace_id = '${workspaceId}' AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied');
\`\`\`

**Reply Rate:**
\`\`\`sql
SELECT
  COUNT(*) as total_sent,
  COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as replied,
  COALESCE(
    ROUND(
      COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END)::numeric /
      NULLIF(COUNT(*), 0)::numeric * 100, 2
    ), 0
  ) as reply_rate
FROM emails
WHERE workspace_id = '${workspaceId}' AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied');
\`\`\`

**Time Filters:**
- Today: \`sent_at >= CURRENT_DATE\`
- This week: \`sent_at >= date_trunc('week', CURRENT_TIMESTAMP)\`
- This month: \`sent_at >= date_trunc('month', CURRENT_TIMESTAMP)\`
- Last N days: \`sent_at >= CURRENT_DATE - INTERVAL 'N days'\`

**JOIN Example:**
\`\`\`sql
SELECT e.*, l.company_name, l.lead_status
FROM emails e
LEFT JOIN leads l ON e.lead_id = l.id
WHERE e.workspace_id = '${workspaceId}';
\`\`\`

# Response Format

Respond in JSON format:
\`\`\`json
{
  "sql": "SQL query to execute (without semicolon)",
  "explanation": "1-2 sentence explanation of what this query does",
  "estimatedRows": Expected result row count (number)
}
\`\`\`

Generate the SQL query:`
}

export function getValidationPrompt(sql: string) {
  return `Validate the following SQL query from a security perspective:

\`\`\`sql
${sql}
\`\`\`

# Validation Checklist

1. ✅ Is it a SELECT query? (INSERT, UPDATE, DELETE, DROP prohibited)
2. ✅ Does it include workspace_id filter?
3. ✅ No dangerous functions? (pg_sleep, pg_terminate_backend, etc.)
4. ✅ No infinite loops or excessive resource usage?
5. ✅ Are JOINs used appropriately?

# Response Format

Respond in JSON:
{
  "isSafe": true/false,
  "issues": ["List of found issues"],
  "suggestions": ["List of improvement suggestions"]
}`
}

export function getAnalysisResultPrompt(
  question: string,
  sql: string,
  result: unknown[],
  executionTime: number,
) {
  const sampleSize = Math.min(result.length, 5)
  const sample = result.slice(0, sampleSize)

  return `${SYSTEM_PROMPT}

# Task: Analyze Results

**User Question:** "${question}"

**Executed SQL:**
\`\`\`sql
${sql}
\`\`\`

**Query Results:**
- Total rows: ${result.length}
- Execution time: ${executionTime}ms

**Data Sample (max 5):**
\`\`\`json
${JSON.stringify(sample, null, 2)}
\`\`\`

# Task Requirements

You are an **experienced sales professional and data analyst**.
Provide clear, practical answers to user questions based on data.

**Include:**
1. Core answer (1-2 sentence summary)
2. Key numbers and statistics (emphasize concrete figures)
3. Found patterns or trends
4. **Actionable sales advice**: Specific, executable sales strategies based on insights
5. Organize data in tables or lists when needed

**Answer Tone:**
- Positive and motivating tone that encourages sales teams
- Use expressions like "You're doing great", "This data shows opportunities", "Ready for the next step"
- Be genuine and data-driven, not excessive

**Answer Format:**
- Structure with bullet points
- Use clear, easy-to-understand language
- Add brief motivation or encouragement at the end

Write your answer:`
}

export function getInsightGenerationPrompt(question: string, analysis: string, result: unknown[]) {
  return `${SYSTEM_PROMPT}

# Task: Generate Business Insights

**Question:** "${question}"
**Analysis Result:** ${analysis}
**Data Sample:** ${JSON.stringify(result.slice(0, 3), null, 2)}

# Requirements

You are a **strategy consultant driving sales success**.
Provide 3-5 **immediately actionable sales insights** based on patterns and anomalies found in data.

Each insight should include:
- **Finding**: Specific pattern found in data and its impact on sales performance
- **Recommended Action**: Specific, actionable sales strategy and behavior guidelines
- **Impact**: high, medium, low
- **Category**: performance (performance), optimization (optimization), warning (caution), opportunity (opportunity)

**Insight Writing Principles:**
1. Present specific numbers and facts based on data
2. Provide immediately actionable action items
3. Use positive, motivating tone
4. Use expressions like "This data shows an opportunity", "Better results possible by doing"
5. Messages that energize sales team and inspire action

# Response Format

Respond in JSON array:
[
  {
    "insight": "Found pattern (e.g., Monday open rate is 42%, significantly exceeding industry average 28%. Excellent performance!)",
    "recommendation": "Specific action and encouragement (e.g., Send important campaigns on Mondays to maximize this strength. Your timing strategy is working!)",
    "impact": "high",
    "category": "opportunity"
  }
]

**Good Insight Examples:**
- opportunity: "15% reply rate is 3x industry average 5%! Customer relationship building is excellent. Leverage this strength for aggressive follow-up meeting proposals."
- performance: "Sending volume increased 40% vs last week, open rate also rose 5%p. Your efforts are showing clear results!"
- optimization: "Emails sent between 2-4 PM have highest 20% response rate. Use this golden hour to create more opportunities."
- warning: "Customers with no replies increasing in last 7 days. Good time to review re-engagement strategy. Find breakthroughs with new approaches!"

Generate insights:`
}

export function getVisualizationSuggestionPrompt(result: unknown[]) {
  if (result.length === 0) {
    return null
  }

  const firstRow = result[0] as Record<string, unknown>
  const columns = Object.keys(firstRow)
  const sampleData = result.slice(0, 3)

  return `${SYSTEM_PROMPT}

# Task: Recommend Data Visualization

**Data Sample:**
\`\`\`json
${JSON.stringify(sampleData, null, 2)}
\`\`\`

**Column List:** ${columns.join(", ")}
**Total Rows:** ${result.length}

# Requirements

Recommend 1-3 most effective ways to visualize this data.

**Visualization Types:**
- **metric**: Single number metric (e.g., Open rate 36.5%)
- **bar**: Category comparison (e.g., Sends by day of week)
- **line**: Time series trend (e.g., Daily open rate trend)
- **pie**: Ratio distribution (e.g., Lead status distribution)
- **table**: Detailed data table

# Response Format

Respond in JSON array:
[
  {
    "type": "bar",
    "title": "Chart title",
    "xAxis": "Column name for x-axis",
    "yAxis": "Column name for y-axis",
    "description": "Why this visualization is appropriate"
  }
]

Recommend visualizations:`
}

export function getFollowUpQuestionsPrompt(question: string, analysis: string) {
  return `${SYSTEM_PROMPT}

# Task: Generate Follow-up Questions

**Current Question:** "${question}"
**Analysis Result:** ${analysis}

# Requirements

Generate 3 **useful follow-up questions** users might be curious about based on current analysis.

**Good follow-up question characteristics:**
- Related to current analysis
- Provides deeper insights
- Specific and actionable
- Offers various perspectives (time, segments, comparisons, etc.)

**Examples:**
- "How does it compare to last week?"
- "Can you analyze by sequence?"
- "What day has best performance?"
- "Can you break it down by industry?"

# Response Format

Respond in JSON array:
["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]

Generate follow-up questions:`
}
