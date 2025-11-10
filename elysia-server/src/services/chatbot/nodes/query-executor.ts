import { sql } from "drizzle-orm"
import { db } from "../../../db/drizzle"
import { chatbotLogger } from "../../../utils/logger"
import type { ChatbotState } from "../state"

const MAX_EXECUTION_TIME = 60000 // 60초 (increased for large CSV processing)
const MAX_ROWS = 1000

export async function executeQuery(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  // Emit node start event
  if (emitter) {
    emitter.nodeStart("executeQuery", "Loading data...")
  }

  chatbotLogger.nodeStart("executeQuery")

  // Log input state
  chatbotLogger.nodeDetail("executeQuery", {
    sqlLength: state.generatedSQL?.length || 0,
    hasSQL: !!state.generatedSQL,
    isConfirmed: state.isConfirmed,
    isQuerySafe: state.isQuerySafe,
    needsConfirmation: state.needsConfirmation,
  })

  // Check if this operation needs confirmation but user hasn't confirmed yet
  if (state.needsConfirmation && !state.isConfirmed) {
    chatbotLogger.info(
      "[LangGraph] Mutation requires confirmation but not yet confirmed - this should not happen",
    )

    if (emitter) {
      emitter.error("executeQuery", "Approval required")
    }

    return {
      error: "This operation requires approval.",
      executionTime: Date.now() - startTime,
    }
  }

  // Critical check: SQL must exist
  if (!state.generatedSQL || state.generatedSQL.trim().length === 0) {
    const stateInfo = JSON.stringify({
      generatedSQL: state.generatedSQL,
      sqlQueries: state.sqlQueries,
      isConfirmed: state.isConfirmed,
      needsConfirmation: state.needsConfirmation,
    })
    chatbotLogger.error(`[LangGraph] ERROR: No SQL to execute! State: ${stateInfo}`)

    if (emitter) {
      emitter.error("executeQuery", "No request to process")
    }

    return {
      error: "No request to process. A system error has occurred.",
      executionTime: Date.now() - startTime,
    }
  }

  chatbotLogger.info(`[LangGraph] Executing SQL:\n${state.generatedSQL}`)

  // Emit progress
  if (emitter) {
    emitter.progress("executeQuery", "Searching for data...")
  }

  try {
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Query execution timeout (60 seconds)")),
        MAX_EXECUTION_TIME,
      )
    })

    // 쿼리 실행
    const queryPromise = db.execute(sql.raw(state.generatedSQL))

    const result: unknown = await Promise.race([queryPromise, timeoutPromise])

    const executionTime = Date.now() - startTime

    // 결과 데이터 파싱
    const resultData = result as { rows?: unknown[]; rowCount?: number } | unknown[]
    const rows = (
      resultData && typeof resultData === "object" && "rows" in resultData
        ? resultData.rows
        : resultData
    ) as unknown[]

    // rowCount 추출 (UPDATE/DELETE/INSERT 등)
    const affectedRows =
      resultData && typeof resultData === "object" && "rowCount" in resultData
        ? (resultData.rowCount as number)
        : rows?.length || 0

    // SELECT 쿼리: rows가 있는 경우
    if (rows && rows.length > 0) {
      if (rows.length > MAX_ROWS) {
        chatbotLogger.nodeSuccess(
          `executeQuery (${rows.length} rows, limited to ${MAX_ROWS})`,
          executionTime,
        )
        return {
          queryResult: rows.slice(0, MAX_ROWS),
          executionTime,
          affectedRows: rows.length,
          error: `Results limited to ${MAX_ROWS} rows (total: ${rows.length} rows)`,
        }
      }

      chatbotLogger.nodeSuccess(`executeQuery (${rows.length} rows)`, executionTime)

      return {
        queryResult: rows,
        executionTime,
        affectedRows: rows.length,
        error: null,
      }
    }

    // UPDATE/DELETE/INSERT 쿼리: rows는 없지만 affectedRows가 있는 경우
    chatbotLogger.nodeSuccess(
      `executeQuery (mutation: ${affectedRows} rows affected)`,
      executionTime,
    )

    return {
      queryResult: [],
      executionTime,
      affectedRows,
      error: null,
    }
  } catch (error) {
    const executionTime = Date.now() - startTime

    // Extract detailed database error information
    const dbError = error as {
      code?: string
      detail?: string
      hint?: string
      constraint?: string
      table?: string
      column?: string
      position?: string
      severity?: string
    }
    const dbErrorCode = dbError?.code
    const dbErrorDetail = dbError?.detail
    const dbErrorHint = dbError?.hint
    const dbErrorConstraint = dbError?.constraint
    const dbErrorTable = dbError?.table
    const dbErrorColumn = dbError?.column
    const dbErrorPosition = dbError?.position
    const dbErrorSeverity = dbError?.severity

    // 에러 타입별 사용자 친화적 메시지
    let errorMessage = "An error occurred while querying the database"
    let detailedError = ""
    let userFriendlyMessage = ""

    if (error instanceof Error) {
      detailedError = error.message

      // Division by zero error
      if (error.message.includes("division by zero")) {
        userFriendlyMessage = "No data available to calculate. Please try a different time period."
        errorMessage = userFriendlyMessage
      }
      // Timeout error
      else if (error.message.includes("timeout") || error.message.includes("timed out")) {
        userFriendlyMessage =
          "Processing is taking too long. Please reduce the search range or add more conditions."
        errorMessage = userFriendlyMessage
      }
      // Table/column does not exist
      else if (
        error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("column")
      ) {
        userFriendlyMessage = `Cannot find the requested data field. Please check again.`
        errorMessage = userFriendlyMessage
      }
      // NULL constraint violation
      else if (error.message.includes("violates not-null constraint") || dbErrorCode === "23502") {
        const columnName = dbErrorColumn || "field"
        userFriendlyMessage = `The '${columnName}' field is required.`
        errorMessage = userFriendlyMessage
      }
      // UNIQUE constraint violation
      else if (error.message.includes("violates unique constraint") || dbErrorCode === "23505") {
        userFriendlyMessage = `This data already exists. Duplicate data cannot be saved.`
        errorMessage = userFriendlyMessage
      }
      // FOREIGN KEY constraint violation
      else if (
        error.message.includes("violates foreign key constraint") ||
        dbErrorCode === "23503"
      ) {
        userFriendlyMessage = `Related data not found. Please check if the required data exists first.`
        errorMessage = userFriendlyMessage
      }
      // CHECK constraint violation
      else if (error.message.includes("violates check constraint") || dbErrorCode === "23514") {
        userFriendlyMessage = `The value you entered is invalid. Please check again.`
        errorMessage = userFriendlyMessage
      }
      // String data too long
      else if (error.message.includes("value too long") || dbErrorCode === "22001") {
        const match = error.message.match(/column "(\w+)"/)
        const columnName = match ? match[1] : "text"
        userFriendlyMessage = `The ${columnName} field content is too long. Please enter a shorter value.`
        errorMessage = userFriendlyMessage
      }
      // Invalid syntax
      else if (error.message.includes("syntax error") || dbErrorCode === "42601") {
        userFriendlyMessage = `An error occurred during processing. Let me try again.`
        errorMessage = `SQL syntax error at position ${dbErrorPosition || "unknown"}: ${error.message}`
      }
      // Other general errors
      else {
        userFriendlyMessage = `An error occurred while processing data: ${error.message}`
        errorMessage = userFriendlyMessage
      }
    }

    // Comprehensive error logging
    chatbotLogger.error(
      `[LangGraph] Query Execution Failed:\n` +
        `┌─────────────────────────────────────────────────────────────\n` +
        `│ ERROR DETAILS:\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ Message: ${detailedError}\n` +
        `│ Code: ${dbErrorCode || "N/A"}\n` +
        `│ Severity: ${dbErrorSeverity || "N/A"}\n` +
        `│ Table: ${dbErrorTable || "N/A"}\n` +
        `│ Column: ${dbErrorColumn || "N/A"}\n` +
        `│ Constraint: ${dbErrorConstraint || "N/A"}\n` +
        `│ Position: ${dbErrorPosition || "N/A"}\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ ADDITIONAL INFO:\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ Detail: ${dbErrorDetail || "N/A"}\n` +
        `│ Hint: ${dbErrorHint || "N/A"}\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ FAILED QUERY (first 500 chars):\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ ${state.generatedSQL?.substring(0, 500)}...\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ USER MESSAGE:\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ ${userFriendlyMessage}\n` +
        `└─────────────────────────────────────────────────────────────`,
    )

    chatbotLogger.nodeError("executeQuery", errorMessage, executionTime)

    return {
      queryResult: [],
      executionTime,
      error: errorMessage,
    }
  }
}
