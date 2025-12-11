import { desc, eq } from "drizzle-orm"
import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import pRetry from "p-retry"
import { z } from "zod"
import { config } from "../config"
import { db } from "../db/index"
import { websetRows, websets } from "../db/schema/websets"
import { workspaces } from "../db/schema/workspaces"
import { mastra } from "../shared/mastra/shell/mastra"

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: config.openai.apiKey })

// ====================================
// WEBSET CRUD OPERATIONS
// ====================================

// GetAllWebsets
export async function getAllWebsets(workspaceId: string, limit = 10, offset = 0) {
  const results = await db
    .select({
      id: websets.id,
      workspaceId: websets.workspaceId,
      title: websets.title,
      query: websets.query,
      criterias: websets.criterias,
      targetValidatedRows: websets.targetValidatedRows,
      createdAt: websets.createdAt,
      updatedAt: websets.updatedAt,
      workspaceName: workspaces.name,
    })
    .from(websets)
    .innerJoin(workspaces, eq(websets.workspaceId, workspaces.id))
    .where(eq(websets.workspaceId, workspaceId))
    .orderBy(desc(websets.createdAt))
    .limit(limit)
    .offset(offset)

  const count = await db.$count(websets, eq(websets.workspaceId, workspaceId))

  return {
    data: results.map((webset) => ({
      ...webset,
      createdAt: webset.createdAt.toISOString(),
      updatedAt: webset.updatedAt.toISOString(),
    })),
    total: Number(count),
    limit,
    offset,
  }
}

// GetWebset
export async function getWebset(id: string) {
  const result = await db
    .select({
      id: websets.id,
      workspaceId: websets.workspaceId,
      title: websets.title,
      query: websets.query,
      criterias: websets.criterias,
      targetValidatedRows: websets.targetValidatedRows,
      createdAt: websets.createdAt,
      updatedAt: websets.updatedAt,
      workspaceName: workspaces.name,
    })
    .from(websets)
    .leftJoin(workspaces, eq(websets.workspaceId, workspaces.id))
    .where(eq(websets.id, id))
    .limit(1)

  const webset = result[0]
  if (!webset) return undefined

  return {
    ...webset,
    createdAt: webset.createdAt.toISOString(),
    updatedAt: webset.updatedAt.toISOString(),
  }
}

// CreateWebset
export async function createWebset(data: {
  workspaceId: string
  title?: string
  query: string
  criterias?: string[]
  targetValidatedRows?: number
}) {
  const [newWebset] = await db
    .insert(websets)
    .values({
      workspaceId: data.workspaceId,
      title: data.title || null,
      query: data.query,
      criterias: data.criterias || null,
      targetValidatedRows: data.targetValidatedRows || null,
    })
    .returning({
      id: websets.id,
      workspaceId: websets.workspaceId,
      title: websets.title,
      query: websets.query,
      criterias: websets.criterias,
      targetValidatedRows: websets.targetValidatedRows,
      createdAt: websets.createdAt,
      updatedAt: websets.updatedAt,
    })

  if (!newWebset) {
    throw new Error("Failed to create webset")
  }

  return {
    ...newWebset,
    createdAt: newWebset.createdAt.toISOString(),
    updatedAt: newWebset.updatedAt.toISOString(),
  }
}

// UpdateWebset
export async function updateWebset(
  id: string,
  data: {
    title?: string
    query?: string
    criterias?: string[]
    targetValidatedRows?: number
  },
) {
  const [updatedWebset] = await db
    .update(websets)
    .set({
      title: data.title,
      query: data.query,
      criterias: data.criterias,
      targetValidatedRows: data.targetValidatedRows,
      updatedAt: new Date(),
    })
    .where(eq(websets.id, id))
    .returning({
      id: websets.id,
      workspaceId: websets.workspaceId,
      title: websets.title,
      query: websets.query,
      criterias: websets.criterias,
      targetValidatedRows: websets.targetValidatedRows,
      createdAt: websets.createdAt,
      updatedAt: websets.updatedAt,
    })

  if (!updatedWebset) {
    throw new Error("Failed to update webset")
  }

  return {
    ...updatedWebset,
    createdAt: updatedWebset.createdAt.toISOString(),
    updatedAt: updatedWebset.updatedAt.toISOString(),
  }
}

// DeleteWebset
export async function deleteWebset(id: string) {
  await db.delete(websets).where(eq(websets.id, id))
}

// ====================================
// WEBSET ROWS OPERATIONS
// ====================================

// GetAllWebsetRows
export async function getAllWebsetRows(websetId: string, limit = 100, offset = 0) {
  const results = await db
    .select({
      id: websetRows.id,
      websetId: websetRows.websetId,
      data: websetRows.data,
      criteriaAnswers: websetRows.criteriaAnswers,
      createdAt: websetRows.createdAt,
      updatedAt: websetRows.updatedAt,
    })
    .from(websetRows)
    .where(eq(websetRows.websetId, websetId))
    .orderBy(desc(websetRows.createdAt))
    .limit(limit)
    .offset(offset)

  const countResult = await db.$count(websetRows, eq(websetRows.websetId, websetId))

  return {
    rows: results.map((row) => ({
      ...row,
      data: row.data as Record<string, unknown>,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total: Number(countResult),
    limit,
    offset,
  }
}

// CreateWebsetRow
export async function createWebsetRow(data: {
  websetId: string
  data: Record<string, unknown>
  criteriaAnswers?: boolean[]
}) {
  const [newRow] = await db
    .insert(websetRows)
    .values({
      websetId: data.websetId,
      data: data.data,
      criteriaAnswers: data.criteriaAnswers || null,
    })
    .returning({
      id: websetRows.id,
      websetId: websetRows.websetId,
      data: websetRows.data,
      criteriaAnswers: websetRows.criteriaAnswers,
      createdAt: websetRows.createdAt,
      updatedAt: websetRows.updatedAt,
    })

  if (!newRow) {
    throw new Error("Failed to create webset row")
  }

  return {
    ...newRow,
    data: newRow.data as Record<string, unknown>,
    createdAt: newRow.createdAt.toISOString(),
    updatedAt: newRow.updatedAt.toISOString(),
  }
}

// UpdateWebsetRow
export async function updateWebsetRow(
  id: string,
  data: {
    data?: Record<string, unknown>
    criteriaAnswers?: boolean[]
  },
) {
  const [updatedRow] = await db
    .update(websetRows)
    .set({
      data: data.data,
      criteriaAnswers: data.criteriaAnswers,
      updatedAt: new Date(),
    })
    .where(eq(websetRows.id, id))
    .returning({
      id: websetRows.id,
      websetId: websetRows.websetId,
      data: websetRows.data,
      criteriaAnswers: websetRows.criteriaAnswers,
      createdAt: websetRows.createdAt,
      updatedAt: websetRows.updatedAt,
    })

  if (!updatedRow) {
    throw new Error("Failed to update webset row")
  }

  return {
    ...updatedRow,
    data: updatedRow.data as Record<string, unknown>,
    createdAt: updatedRow.createdAt.toISOString(),
    updatedAt: updatedRow.updatedAt.toISOString(),
  }
}

// DeleteWebsetRow
export async function deleteWebsetRow(id: string) {
  await db.delete(websetRows).where(eq(websetRows.id, id))
}

// ====================================
// WEBSET CRITERIA OPERATIONS
// ====================================

// CreateWebsetCriteria - Generate validation criteria and rewritten query
export async function createWebsetCriteria(query: string) {
  // Step 1: Extract validation criteria from the original query
  const criteriaExtractionSchema = z.object({
    validationCriteria: z
      .array(z.string())
      .min(1)
      .max(5)
      .describe(
        "1-5 yes/no questions that capture ONLY the requirements explicitly stated in the query",
      ),
  })

  const criteriaResponse = await pRetry(
    () =>
      openai.responses.parse({
        model: config.mastra.model,
        input: [
          {
            role: "system",
            content: "Extract validation criteria from the search query",
          },
          {
            role: "user",
            content: `Analyze this search query and extract 1-5 validation criteria: "${query}"

CRITICAL RULES:
- Only use information EXPLICITLY mentioned in the original query
- Do NOT add assumptions, implications, or related concepts not stated in the query
- Do NOT infer additional requirements beyond what is directly stated
- Each criterion must directly map to something mentioned in the query
- Generate only as many criteria as there are distinct requirements in the query (minimum 1, maximum 5)
- For simple single-term queries, one criterion is sufficient

Generate 1-5 clear yes/no questions that validate the EXACT requirements stated in the query.

For example:
- Query: "GRINDA" (simple single-term query)
  Valid criteria:
  1. Does the company name contain "GRINDA" or is it related to GRINDA?

- Query: "AI companies in healthcare"
  Valid criteria:
  1. Does the company work with AI or artificial intelligence?
  2. Does the company operate in the healthcare sector?

  Invalid criteria (adding assumptions):
  ✗ Does the company offer AI-powered healthcare solutions? (assumes "solutions", not in query)
  ✗ Does the company have FDA approval? (assumes regulation, not in query)

- Query: "B2B SaaS startups in fintech"
  Valid criteria:
  1. Does the company operate in a B2B model?
  2. Is the company a SaaS (Software as a Service) company?
  3. Is the company a startup?
  4. Does the company operate in the fintech industry?

  Invalid criteria:
  ✗ Does the company have enterprise customers? (assumes "enterprise", not in query)
  ✗ Is the company venture-backed? (assumes funding, not in query)

Now extract criteria from: "${query}"`,
          },
        ],
        text: {
          format: zodTextFormat(criteriaExtractionSchema, "CriteriaExtraction"),
        },
        temperature: config.mastra.temperature,
      }),
    { retries: 3 },
  )

  const criteriaResult = criteriaResponse.output_parsed
  if (!criteriaResult) {
    throw new Error("Failed to parse criteria extraction response")
  }

  // Step 2: Rewrite query incorporating the extracted criteria
  const queryRewriteSchema = z.object({
    rewrittenQuery: z
      .string()
      .describe(
        "A rewritten search query that stays true to the original while being more search-optimized",
      ),
  })

  const rewriteResponse = await pRetry(
    () =>
      openai.responses.parse({
        model: config.mastra.model,
        input: [
          {
            role: "system",
            content: "Rewrite search query incorporating validation criteria",
          },
          {
            role: "user",
            content: `Original query: "${query}"

Validation criteria extracted (based ONLY on what was in the original query):
${criteriaResult.validationCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Rewrite the query to be more effective for web search while:
1. Preserving the EXACT original intent - do not add new concepts or requirements
2. Incorporating all the validation criteria naturally
3. Making it optimized for search engines to find relevant companies
4. Keeping it concise and searchable
5. Using search-friendly language without changing the meaning

CRITICAL: Do NOT add assumptions or concepts not in the original query. The rewritten query should only be a more search-optimized version of the exact same search intent.

For example:
- Original: "AI companies in healthcare"
  Good rewrite: "artificial intelligence companies healthcare sector"
  Bad rewrite: "AI-powered healthcare solutions providers" (adds "solutions" and "providers")

- Original: "B2B SaaS startups"
  Good rewrite: "B2B SaaS software startup companies"
  Bad rewrite: "enterprise B2B SaaS startups with funding" (adds "enterprise" and "funding")`,
          },
        ],
        text: {
          format: zodTextFormat(queryRewriteSchema, "QueryRewrite"),
        },
        temperature: config.mastra.temperature,
      }),
    { retries: 3 },
  )

  const rewriteResult = rewriteResponse.output_parsed
  if (!rewriteResult) {
    throw new Error("Failed to parse query rewrite response")
  }

  return {
    validationCriteria: criteriaResult.validationCriteria,
    rewrittenQuery: rewriteResult.rewrittenQuery,
  }
}

// ====================================
// WEBSET RUN OPERATIONS
// ====================================

// RunWebset - Execute the webset query and process results
export async function runWebset(websetId: string) {
  // Validate webset exists
  const webset = await getWebset(websetId)

  if (!webset) {
    throw new Error("Webset not found")
  }

  // Get the workflow from Mastra instance
  const workflow = mastra.getWorkflow("runWebsetWorkflow")

  // Create a run instance
  const run = await workflow.createRunAsync()

  // Execute the workflow
  const workflowResult = await run.start({
    inputData: {
      websetId,
    },
  })

  // Handle workflow failure
  if (workflowResult.status === "failed") {
    throw new Error(`Workflow failed: ${workflowResult.error.message}`)
  }

  // The workflow now ends at the check-search-validate-loop step (after dowhile completes)
  const stepResult = workflowResult.steps["check-search-validate-loop"]

  // Check if step succeeded
  if (!stepResult || stepResult.status !== "success") {
    throw new Error("Workflow step failed to execute")
  }

  const output = stepResult.output as {
    websetId: string
    iterationCount: number
    targetValidatedRows: number | null
    currentValidatedRows: number
    rowsWithoutValidation: number
    targetSatisfied: boolean
    totalCompaniesSearched: number
    totalRowsAdded: number
    totalRowsValidated: number
    totalValidationErrors: number
    message: string
    success: boolean
  }

  // Return workflow result
  return {
    websetId: output.websetId,
    iterationCount: output.iterationCount,
    targetValidatedRows: output.targetValidatedRows,
    currentValidatedRows: output.currentValidatedRows,
    rowsWithoutValidation: output.rowsWithoutValidation,
    targetSatisfied: output.targetSatisfied,
    totalCompaniesSearched: output.totalCompaniesSearched,
    totalRowsAdded: output.totalRowsAdded,
    totalRowsValidated: output.totalRowsValidated,
    totalValidationErrors: output.totalValidationErrors,
    status: output.success ? "completed" : "failed",
    message: output.message,
    success: output.success,
  }
}
