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

⚠️ **MOST CRITICAL RULE - Column Consistency in UNION ALL:**
When creating multiple CTEs that will be combined with UNION ALL (e.g., new_lead_1_linkedin and new_lead_2_socials):
- ALL CTEs inserting to the SAME table MUST specify IDENTICAL column lists
- Never mix explicit column lists with default columns across different CTEs
- Example: If one social media CTE specifies 8 columns, ALL other social media CTEs must specify the same 8 columns
- This prevents "column count mismatch" errors in the final json_agg aggregation

⚠️ **USE CTE (WITH) for Complex Operations - REQUIRED!**
- Use Common Table Expressions for multi-step INSERTs (eliminates ID reference errors)
- Each CTE references previous steps by name
- Final SELECT: Use UNION ALL inside FROM for json_agg aggregation

**Critical Rules:**
1. json_agg() REQUIRES FROM clause: \`(SELECT json_agg(x) FROM (SELECT * FROM cte1 UNION ALL ...) x)\`
2. Single result: \`(SELECT row_to_json(cte.*) FROM cte)\`
3. Always include \`RETURNING *\` on INSERTs/UPDATEs
4. Include ALL columns explicitly (id, created_at, updated_at, etc.)

---

## 🎯 Customer Group + Sequence Builder (7 Steps)

1. Create Customer Group
2. Create Leads + Add to Group Members + Populate related tables (contacts, social media, products, sectors, categories, industries)
3. Create Sequence (linked to group)
4. Create Sequence Steps (3-5 AI-designed emails with {{company_name}}, {{contact_name}} variables)
5. Activate Sequence (status = 'active')
6. Create Sequence Enrollments (auto-enroll all group leads)
7. Schedule First Step Executions

**Complete CTE Example:**
\`\`\`sql
WITH
  new_group AS (
    INSERT INTO customer_groups (id, workspace_id, name, description, criteria, is_dynamic, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), '${workspaceId}', 'Tech Startups', 'AI and SaaS companies', NULL, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  ),
  new_lead_1 AS (
    INSERT INTO leads (id, workspace_id, company_name, contact_name, website_url, business_type, description, country, city, state, lead_status, created_at, updated_at)
    VALUES (gen_random_uuid(), '${workspaceId}', 'TechCorp AI', 'John Doe', 'https://techcorp.ai', 'SaaS', 'AI-powered solutions', 'USA', 'San Francisco', 'CA', 'new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  ),
  new_lead_1_email AS (
    INSERT INTO lead_contacts (id, lead_id, contact_type, contact_value, label, is_primary, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'email', 'john@techcorp.ai', 'main', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM new_lead_1
    RETURNING *
  ),
  new_lead_2 AS (
    INSERT INTO leads (id, workspace_id, company_name, contact_name, website_url, business_type, description, country, city, state, lead_status, created_at, updated_at)
    VALUES (gen_random_uuid(), '${workspaceId}', 'CloudStart Inc', 'Jane Smith', 'https://cloudstart.io', 'Cloud', 'Cloud infrastructure', 'USA', 'Seattle', 'WA', 'new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  ),
  new_lead_2_email AS (
    INSERT INTO lead_contacts (id, lead_id, contact_type, contact_value, label, is_primary, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'email', 'jane@cloudstart.io', 'main', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM new_lead_2
    RETURNING *
  ),
  group_members AS (
    INSERT INTO customer_group_members (id, group_id, lead_id, added_at)
    SELECT gen_random_uuid(), (SELECT id FROM new_group), id, CURRENT_TIMESTAMP
    FROM (SELECT id FROM new_lead_1 UNION ALL SELECT id FROM new_lead_2) leads
    RETURNING *
  ),
  new_sequence AS (
    INSERT INTO sequences (id, workspace_id, customer_group_id, name, description, status, created_at, updated_at)
    SELECT gen_random_uuid(), '${workspaceId}', id, 'AI Outreach Campaign', 'Automated outreach for AI companies', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM new_group
    RETURNING *
  ),
  step_1 AS (
    INSERT INTO sequence_steps (id, sequence_id, step_order, delay_days, email_subject, email_body_text, created_at, updated_at)
    SELECT gen_random_uuid(), id, 1, 0, 'Hello {{company_name}}!', 'Hi {{contact_name}},\\n\\nExcited to connect!', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM new_sequence
    RETURNING *
  ),
  step_2 AS (
    INSERT INTO sequence_steps (id, sequence_id, step_order, delay_days, email_subject, email_body_text, created_at, updated_at)
    SELECT gen_random_uuid(), id, 2, 3, 'Following up with {{company_name}}', 'Hi {{contact_name}},\\n\\nJust checking in!', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM new_sequence
    RETURNING *
  )
SELECT json_build_object(
  'customer_group', (SELECT row_to_json(g) FROM new_group g),
  'leads', (SELECT json_agg(l) FROM (SELECT * FROM new_lead_1 UNION ALL SELECT * FROM new_lead_2) l),
  'contacts', (SELECT json_agg(c) FROM (SELECT * FROM new_lead_1_email UNION ALL SELECT * FROM new_lead_2_email) c),
  'group_members', (SELECT json_agg(m) FROM group_members m),
  'sequence', (SELECT row_to_json(s) FROM new_sequence s),
  'steps', (SELECT json_agg(st) FROM (SELECT * FROM step_1 UNION ALL SELECT * FROM step_2) st)
) AS result;
\`\`\`

⚠️ **CRITICAL - UNION ALL Column Consistency:**
In the above example, note that:
- \`new_lead_1_email\` and \`new_lead_2_email\` both INSERT with IDENTICAL column lists (id, lead_id, contact_type, contact_value, label, is_primary, created_at, updated_at)
- \`step_1\` and \`step_2\` both INSERT with IDENTICAL column lists
- This ensures that UNION ALL operations in json_agg work correctly
- If you add social_media CTEs, ALL must have the same column list (e.g., id, lead_id, platform, url, username, is_verified, created_at, updated_at)

**Critical Schema Rules:**

**Column Names (exact):**
- lead_products: \`product_name\`, lead_business_sectors: \`sector_name\`
- lead_product_categories: \`category_name\`, lead_industry_types: \`industry_name\`

**Length Limits:**
- leads.business_type: VARCHAR(100) - use ONLY primary type
- company_name/contact_name: VARCHAR(255), website_url: VARCHAR(500)
- Split CSV values ("IT, Cloud") into separate rows

**Table Constraints:**

**leads:** ⚠️ CRITICAL - Include \`state\` column!
\`\`\`sql
INSERT INTO leads (
  id, workspace_id, company_name, contact_name, website_url, business_type,
  description, address, country, city, state, employee_count,
  lead_status, lead_score, lead_source, created_at, updated_at
) VALUES (
  gen_random_uuid(), '${workspaceId}', 'Company', 'Contact', 'https://...', 'Industry',
  'Desc', 'Address', 'Country', 'City', 'State', '10-50',
  'new', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
\`\`\`

**lead_contacts:**
- Required: lead_id, contact_type (phone/email/fax/other), contact_value
- Defaults: id, is_primary (false), is_verified (false), created_at, updated_at
- Nullable: contact_name, label
- Best practice: Include label ('main', 'support', 'sales')

**lead_social_media:**
- Required: lead_id, platform (facebook/instagram/twitter/linkedin), url
- Auto-generated: id (gen_random_uuid()), is_verified (false), created_at (CURRENT_TIMESTAMP), updated_at (CURRENT_TIMESTAMP)
- Best practice: Include id, created_at, updated_at explicitly in INSERT for consistency with RETURNING *
- Example: INSERT INTO lead_social_media (id, lead_id, platform, url, username, is_verified, created_at, updated_at) SELECT gen_random_uuid(), id, 'linkedin', 'https://...', NULL, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM new_lead_1 RETURNING *

**lead_products/sectors/categories/industries:**
- Required: lead_id, name field (product_name/sector_name/category_name/industry_name)
- Defaults: id, created_at (NO updated_at)

**sequence_steps:**
- Required: sequence_id, step_order, email_subject
- Defaults: id, delay_days (0), scheduled_hour (9), scheduled_minute (0), timezone ('Asia/Seoul'), created_at, updated_at
- Use {{company_name}}, {{contact_name}} variables
- Plain text with \\n for breaks, use straight quotes (')

**sequence_enrollments:**
- Required: sequence_id, lead_id, user_email_account_id
- Fetch user_email_account_id:
  \`\`\`sql
  SELECT id FROM user_email_accounts
  WHERE workspace_id = '${workspaceId}' AND status = 'active' AND is_verified = true
  ORDER BY is_default DESC NULLS LAST LIMIT 1
  \`\`\`

**sequence_step_executions:**
- Required: enrollment_id, step_id, step_order, scheduled_at
- Schedule FIRST step only

---

## 🚨 Common Error Prevention Guide

**1. Column Count Mismatch (MOST COMMON ERROR)**
- ❌ Error: "INSERT has more expressions than target columns"
- ✅ Fix: Ensure column list count matches VALUES count exactly
- **CRITICAL**: \`leads\` table has \`state\` column between \`city\` and \`employee_count\`
  - Correct order: \`country, city, state, employee_count\` (NOT \`country, city, employee_count\`)
  - Missing \`state\` causes all subsequent values to shift
- Check for missing columns like \`state\`, \`updated_at\`, or extra columns

**2. String Length Exceeded**
- ❌ Error: "value too long for type character varying(100)"
- ✅ Fix: Truncate business_type to first 100 chars, use only primary type
- Check all VARCHAR limits before inserting

**3. Foreign Key Violations**
- ❌ Error: "violates foreign key constraint"
- ✅ Fix: Ensure referenced IDs exist (use CTE to reference previous steps)
- Never use placeholder IDs like {{PREV_QUERY_ID}} - use CTEs instead

**4. NOT NULL Constraint Violations**
- ❌ Error: "null value in column violates not-null constraint"
- ✅ Fix: Check schema for NOT NULL columns without defaults
  - leads.workspace_id: REQUIRED
  - leads.lead_status: Has DEFAULT, but check if explicitly set to NULL
  - customer_groups.is_dynamic: Has DEFAULT false, never set to NULL
  - lead_contacts.contact_type, contact_value: REQUIRED
  - sequence_steps.step_order, email_subject: REQUIRED

**5. Enum Type Violations**
- ❌ Error: "invalid input value for enum"
- ✅ Fix: Use only valid enum values:
  - contact_type: 'phone', 'email', 'fax', 'other'
  - platform: 'facebook', 'instagram', 'twitter', 'linkedin'
  - lead_status: 'new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost', 'unsubscribed'
  - sequence_status: 'draft', 'active', 'paused', 'archived', 'completed'
  - enrollment_status: 'active', 'paused', 'completed', 'stopped', 'bounced', 'unsubscribed'
  - step_execution_status: 'pending', 'scheduled', 'sent', 'delivered', 'failed', 'skipped'

**6. JSON Aggregation Without FROM**
- ❌ Error: undefined column / aggregate not allowed
- ✅ Fix: \`(SELECT json_agg(x) FROM (SELECT * FROM cte1 UNION ALL ...) x)\`

**7. UNION ALL Column Mismatch**
- ❌ Error: "UNION query must have same number of columns"
- ✅ Fix: Ensure identical column count/types in all SELECTs
- ⚠️ CRITICAL: When using UNION ALL in json_agg, ALL CTEs must have IDENTICAL column lists
  - Example: If aggregating social_media with UNION ALL, ensure both CTEs specify the SAME columns (e.g., both must use: id, lead_id, platform, url, username, is_verified, created_at, updated_at)
  - Don't mix CTEs with different column specifications even if they insert to same table
  - Use explicit column lists in ALL INSERTs, never rely on defaults for some but not others
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
  "queries": [
    "UPDATE leads SET lead_status = 'unsubscribed', updated_at = CURRENT_TIMESTAMP WHERE id = '{{LEAD_ID}}' AND workspace_id = '${workspaceId}' RETURNING *;",
    "UPDATE sequence_enrollments SET status = 'unsubscribed', stopped_at = CURRENT_TIMESTAMP WHERE lead_id = '{{LEAD_ID}}' AND status = 'active' RETURNING *;",
    "UPDATE sequence_step_executions SET status = 'skipped' WHERE enrollment_id IN (SELECT id FROM sequence_enrollments WHERE lead_id = '{{LEAD_ID}}') AND status = 'pending' RETURNING *;"
  ],
  "explanation": "Changes lead to unsubscribed, stops active sequences, and skips scheduled step executions."
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
