import { chatbotLogger } from "../../../utils/logger"
import type { ChatbotState } from "../state"

export async function validateSQL(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const emitter = state._emitter

  // Node start event
  if (emitter) {
    emitter.nodeStart("validateSQL", "Validating request...")
  }

  try {
    const sql = state.generatedSQL
    const sqlLower = sql.toLowerCase()

    // Progress update
    if (emitter) {
      emitter.progress("validateSQL", "Checking if query is safe to execute...")
    }

    // 1. Check for dangerous operations (DROP, ALTER, CREATE TABLE, TRUNCATE)
    if (
      sqlLower.startsWith("drop") ||
      sqlLower.startsWith("alter") ||
      sqlLower.startsWith("create table") ||
      sqlLower.startsWith("create database") ||
      sqlLower.startsWith("truncate")
    ) {
      if (emitter) {
        emitter.error("validateSQL", "This operation is not permitted for security reasons")
      }
      return {
        isQuerySafe: false,
        error:
          "This operation contains unsafe actions and cannot be processed. Please contact your administrator to modify database structure.",
      }
    }

    if (emitter) {
      emitter.progress("validateSQL", "Checking data access permissions...")
    }

    // 2. workspace_id filter check (required for data isolation)
    if (!sqlLower.includes("workspace_id")) {
      chatbotLogger.nodeError("validateSQL", "Missing workspace_id filter", 0)
      if (emitter) {
        emitter.error("validateSQL", "Data access permission check failed")
      }
      return {
        isQuerySafe: false,
        error: "For security reasons, you can only access data within your workspace.",
      }
    }

    if (emitter) {
      emitter.progress("validateSQL", "Checking query complexity...")
    }

    // 3. Check query complexity (prevent overly complex queries)
    const cteCount = (sql.match(/WITH\s+/gi) || []).length
    const unionCount = (sql.match(/UNION\s+ALL/gi) || []).length
    const subqueryCount = (sql.match(/\(\s*SELECT/gi) || []).length

    if (cteCount > 3 || unionCount > 5 || subqueryCount > 5) {
      chatbotLogger.nodeError(
        "validateSQL",
        `Query too complex: ${cteCount} CTEs, ${unionCount} UNIONs, ${subqueryCount} subqueries`,
        0,
      )
      if (emitter) {
        emitter.error("validateSQL", "Query is too complex")
      }
      return {
        isQuerySafe: false,
        error: "This query is too complex to process. Could you split it into simpler requests?",
      }
    }

    // Success event
    if (emitter) {
      emitter.nodeComplete("validateSQL", "Validation complete")
    }

    // All checks passed
    return {
      isQuerySafe: true,
      error: null,
      needsConfirmation: false,
    }
  } catch (error) {
    if (emitter) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      emitter.error("validateSQL", errorMessage)
    }
    return {
      isQuerySafe: false,
      error: "An error occurred while validating the request.",
    }
  }
}
