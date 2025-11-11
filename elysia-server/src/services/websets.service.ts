import { desc, eq } from "drizzle-orm"
import { db } from "../db/index"
import { websetRows, websets } from "../db/schema/websets"
import { workspaces } from "../db/schema/workspaces"
import { mastra } from "../shared/mastra/shell/mastra"

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

  const countResult = await db
    .select({ count: db.$count(websets.id) })
    .from(websets)
    .where(eq(websets.workspaceId, workspaceId))

  const count = countResult[0]?.count ?? 0

  return {
    data: results,
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
    .innerJoin(workspaces, eq(websets.workspaceId, workspaces.id))
    .where(eq(websets.id, id))
    .limit(1)

  return result[0]
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

  return newWebset
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

  return updatedWebset
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

  const countResult = await db
    .select({ count: db.$count(websetRows.id) })
    .from(websetRows)
    .where(eq(websetRows.websetId, websetId))

  const count = countResult[0]?.count ?? 0

  return {
    data: results,
    total: Number(count),
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

  return newRow
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

  return updatedRow
}

// DeleteWebsetRow
export async function deleteWebsetRow(id: string) {
  await db.delete(websetRows).where(eq(websetRows.id, id))
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
