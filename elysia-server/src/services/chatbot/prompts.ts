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

/**
 * Analysis prompt optimized for CSV imports
 * Includes only CSV metadata, NOT the full data
 */
export function getAnalysisPromptWithCSV(
  question: string,
  workspaceId: string,
  csvData: { headers: string[]; rows: Record<string, string>[]; rowCount: number },
  recentMessages: ChatMessage[],
) {
  const context =
    recentMessages.length > 0
      ? `\nRecent context:\n${recentMessages
          .slice(-3)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}`
      : ""

  // Show only first row as sample
  const sampleRow = csvData.rows[0] || {}

  return `${SYSTEM_PROMPT}

# Task: Analyze CSV Import Request

User question: "${question}"
Workspace ID: ${workspaceId}${context}

**CSV File Metadata:**
- Total rows: ${csvData.rowCount}
- Columns (${csvData.headers.length}): ${csvData.headers.join(", ")}
- Sample row: ${JSON.stringify(sampleRow)}

**Important:**
- The full CSV data is available in state.csvData
- You are analyzing ONLY the metadata here
- Do NOT request the full CSV content in prompts

Available database tables:
- leads, lead_contacts, lead_social_media
- lead_products, lead_business_sectors, lead_product_categories, lead_industry_types
- customer_groups, customer_group_members
- sequences, sequence_steps, sequence_enrollments

Respond in JSON format:
{
  "intent": "csv_import",
  "requiredTables": ["Tables to be populated from CSV"],
  "timeRange": null,
  "needsClarification": false,
  "clarificationQuestion": null,
  "analysisType": "create",
  "operationType": "create"
}

**Critical:**
- Always set operationType to "create" for CSV imports
- Set needsClarification to false (CSV structure is clear)
- The SQL generation step will handle the actual data insertion`
}

export function getSQLGenerationPrompt(
  question: string,
  workspaceId: string,
  schemaContext: string,
  metadata: Record<string, unknown>,
  csvData?: { headers: string[]; rows: Record<string, string>[]; rowCount: number },
) {
  const operationType = (metadata as { operationType?: string }).operationType || "read"

  // If CSV data is present, add compact representation
  let csvContext = ""
  if (csvData && csvData.rowCount > 0) {
    const sampleRow = csvData.rows[0] || {}
    csvContext = `

**CSV Data Available:**
- Rows: ${csvData.rowCount}
- Columns: ${csvData.headers.join(", ")}
- Sample: ${JSON.stringify(sampleRow)}
- Access full data: Use the provided CSV rows to generate INSERT VALUES

**CSV to SQL Mapping:**
You must generate SQL INSERT statements that:
1. Map CSV columns to appropriate database columns
2. Handle ALL ${csvData.rowCount} rows from the CSV
3. Use batched INSERTs or CTEs for efficiency
4. Include proper type conversions and NULL handling

**CSV Rows Preview (first 3):**
${JSON.stringify(csvData.rows.slice(0, 3), null, 2)}
`
  }

  const operationGuidelines =
    operationType === "create"
      ? `
# CREATE Operation Requirements

**Required columns for all INSERTs:**
- \`id\`: gen_random_uuid()
- \`workspace_id\`: '${workspaceId}'
- \`created_at\`: CURRENT_TIMESTAMP
- \`updated_at\`: CURRENT_TIMESTAMP
- Add \`RETURNING *\` to return created data

**Use CTEs only when inserting into multiple related tables.** For single table inserts, use simple INSERT statements.

**Critical: leads table column order includes \`state\` between \`city\` and \`employee_count\`**

## Common Errors to Avoid

**1. Column Count Mismatch** - Ensure column list count matches VALUES count. Missing \`state\` column is a common issue.
**2. String Length** - business_type is VARCHAR(100), truncate if needed.
**3. NOT NULL Violations** - Check schema for required columns (workspace_id, contact_type, contact_value, step_order, email_subject).
**4. Enum Values** - Use valid enums only (lead_status: 'new'|'contacted'|'qualified'|'unqualified'|'converted'|'lost'|'unsubscribed').
**5. Foreign Keys** - Use CTEs to reference previous inserts, never use placeholder IDs.
`
      : operationType === "update"
        ? `
# UPDATE Operation Requirements

- Include \`WHERE workspace_id = '${workspaceId}'\` and specific record identifier
- Set \`updated_at = CURRENT_TIMESTAMP\`
- Add \`RETURNING *\` to return modified data
- Consider cascade effects: updating leads may require updating related sequences/enrollments
`
        : operationType === "delete"
          ? `
# DELETE Operation Requirements

- Include \`WHERE workspace_id = '${workspaceId}'\` and specific record identifier
- Add \`RETURNING *\` to confirm deleted data
- Delete child tables first to prevent foreign key errors (e.g., delete lead_contacts before leads)
- Consider soft delete: Use UPDATE to change status instead of DELETE when appropriate
`
          : `
# READ Operation Requirements

⚠️ **PREFER SIMPLE QUERIES:** Use straightforward SELECT with JOINs. Avoid complex multi-CTE patterns unless absolutely necessary.

- Include \`WHERE workspace_id = '${workspaceId}'\` in all queries
- Use LIMIT clause (default 100, max 1000)
- **Always use NULLIF() for division:** \`COUNT(*) / NULLIF(total, 0)\` to prevent divide-by-zero errors
- Use IS NULL / IS NOT NULL explicitly for null checks
`

  return `${SYSTEM_PROMPT}

# Task: Generate SQL Query (Operation: ${operationType.toUpperCase()})

${schemaContext}

---

**User Question:** "${question}"
**Workspace ID:** ${workspaceId}
**Analysis Result:** ${JSON.stringify(metadata, null, 2)}

${csvContext}

${operationGuidelines}

# Common Patterns

**Time Filters:**
- Today: \`sent_at >= CURRENT_DATE\`
- This week: \`sent_at >= date_trunc('week', CURRENT_TIMESTAMP)\`
- Last N days: \`sent_at >= CURRENT_DATE - INTERVAL 'N days'\`

**Rate Calculations (use NULLIF to prevent division by zero):**
\`\`\`sql
ROUND(COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 2) as open_rate
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
  _sql: string,
  result: unknown[],
  executionTime: number,
) {
  const sample = result.slice(0, Math.min(result.length, 5))

  return `${SYSTEM_PROMPT}

# Task: Analyze Results

**User Question:** "${question}"
**Query Results:** ${result.length} rows (${executionTime}ms)

**Data Sample:**
\`\`\`json
${JSON.stringify(sample, null, 2)}
\`\`\`

Provide a clear answer with:
1. Summary with key numbers
2. Patterns/trends
3. Actionable sales advice
4. Positive, motivating tone

Write your answer:`
}

export function getInsightGenerationPrompt(question: string, _analysis: string, result: unknown[]) {
  const sample = result.slice(0, 5) // Use more rows for better insights
  const rowCount = result.length

  return `Generate 2-3 actionable insights from this data analysis:

**Question**: "${question}"
**Total Rows**: ${rowCount}
**Sample Data**: ${JSON.stringify(sample, null, 2)}

**Requirements**:
1. Focus on actionable business insights, not just data description
2. Include specific numbers from the data
3. Provide clear, implementable recommendations
4. Classify impact level based on business value

**Output Format** (JSON array):
[{
  "insight": "Clear observation with specific numbers (e.g., 'Email open rate is 45%, which is 20% above industry average')",
  "recommendation": "Specific action to take (e.g., 'Replicate this email template for future campaigns')",
  "impact": "high|medium|low",
  "category": "performance|optimization|warning|opportunity"
}]

Generate insights that help drive business decisions.`
}

export function getVisualizationSuggestionPrompt(result: unknown[]) {
  if (result.length === 0) return null

  const firstRow = result[0] as Record<string, unknown>
  const columns = Object.keys(firstRow)
  const sampleData = result.slice(0, 5) // More samples for better context

  // Analyze data types and patterns
  const numericColumns = columns.filter((col) => typeof firstRow[col] === "number")
  const hasTimeData = columns.some(
    (col) =>
      col.toLowerCase().includes("date") ||
      col.toLowerCase().includes("time") ||
      col.toLowerCase().includes("created"),
  )
  const hasCategoricalData = columns.some(
    (col) => typeof firstRow[col] === "string" && result.length > 1,
  )

  return `Analyze this data and suggest 2-3 rich, insightful visualizations:

**Data Sample (${result.length} total rows):**
${JSON.stringify(sampleData, null, 2)}

**Columns:** ${columns.join(", ")}
**Numeric Columns:** ${numericColumns.length > 0 ? numericColumns.join(", ") : "none"}
**Has Time Series:** ${hasTimeData ? "yes" : "no"}
**Has Categories:** ${hasCategoricalData ? "yes" : "no"}

**Requirements:**
1. Create visualizations that tell a story and reveal patterns
2. Use appropriate chart types based on data characteristics:
   - Bar: Compare categories or metrics
   - Line: Show trends over time
   - Pie: Show proportions (only if ≤5 categories)
   - Metric: Highlight single important numbers
3. Provide clear, actionable titles and descriptions
4. Use proper axis labels that match data columns exactly

**Output Format (JSON array):**
[{
  "type": "bar|line|pie|metric|table",
  "title": "Clear, concise title (e.g., 'Email Performance by Status')",
  "xAxis": "exact column name for X-axis",
  "yAxis": "exact column name for Y-axis or value",
  "description": "Brief insight this chart reveals (1-2 sentences)"
}]

**Examples:**
- For email data: "Email Engagement Funnel" (bar chart: sent → opened → clicked → replied)
- For time series: "Daily Response Trend" (line chart over time)
- For status distribution: "Lead Status Distribution" (pie chart if ≤5 categories)
- For key metrics: "Total Active Leads" (metric card)

Generate visualizations that maximize insight and clarity.`
}

export function getFollowUpQuestionsPrompt(question: string, analysis: string) {
  return `Based on the user's question: "${question}" and the analysis result: "${analysis}"

Generate 5 highly contextual, natural follow-up questions that a real user would ask next.

**Analysis Context:**
- Study the actual data in the analysis result
- Consider what specific numbers, trends, or patterns were mentioned
- Think about what the user would naturally want to know next

**Question Categories (pick diverse types):**
1. **Time Comparison**: Compare different time periods based on current data
   - Examples: "저번 주랑 비교하면?", "월별 추이 보여줘", "어제랑 차이 얼마나?"

2. **Deep Dive**: Drill down into specific aspects of the data
   - Examples: "오픈률 낮은 이유 뭐야?", "어느 시간대가 제일 좋아?", "반응 없는 리드 특징은?"

3. **Segment Analysis**: Break down by categories or attributes
   - Examples: "업종별로 나눠봐", "지역별 차이 있어?", "신규랑 기존 고객 비교"

4. **Performance Optimization**: Ask how to improve metrics
   - Examples: "오픈률 올리려면?", "전환율 개선 방법은?", "어떤 제목이 효과적이야?"

5. **Related Insights**: Explore connected data or patterns
   - Examples: "답장 많이 오는 패턴은?", "이탈 시점 언제야?", "성과 좋은 날 공통점은?"

**Critical Requirements:**
- Use the ACTUAL data from the analysis result to create specific questions
- Keep questions VERY SHORT (3-8 words max)
- Use CASUAL, CONVERSATIONAL Korean (반말 or 존댓말 without ~할 수 있나요?)
- Make questions ACTIONABLE and DATA-DRIVEN
- Base questions on what was JUST revealed in the analysis
- NO generic questions - be specific to the data shown

**Style Guide:**
✅ Good (natural, specific, short):
- "이번 달 성과 어때?"
- "오픈률 10% 왜 이래?"
- "전환율 높은 업종은?"
- "가장 반응 좋은 시간대는?"
- "리드 점수 낮은 이유는?"

❌ Bad (too formal, generic, long):
- "세그먼트별로 분석이 가능할까요?"
- "다른 지표도 같이 확인해볼 수 있나요?"
- "추가로 궁금한 사항이 있으신가요?"
- "상세 분석을 원하시나요?"

**Context-Aware Examples:**

If analysis mentions "이메일 100건 발송, 오픈율 45%":
→ "클릭률은 몇 퍼센트야?"
→ "지난주 오픈율은 얼마였어?"
→ "오픈 안 한 55명 특징은?"
→ "오픈율 45% 업계 평균 대비 어때?"
→ "답장 온 건 몇 개야?"

If analysis shows "리드 50개, 신규 30개, 재방문 20개":
→ "신규랑 재방문 전환율 차이는?"
→ "어떤 채널에서 들어왔어?"
→ "리드 점수 높은 순으로 보여줘"
→ "이번 달 리드 증가 추세는?"
→ "업종별로 나눠봐"

Return ONLY a JSON array with 5 questions: ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]`
}
