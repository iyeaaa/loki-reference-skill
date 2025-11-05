import { sql } from "drizzle-orm"
import { db } from "../../../db/drizzle"
import { chatbotLogger } from "../../../utils/logger"
import type { ChatbotState } from "../state"

const MAX_EXECUTION_TIME = 60000 // 60초 (increased for large CSV processing)
const MAX_ROWS = 1000

/**
 * Execute multiple SQL queries sequentially
 * Replaces placeholders like {{PREV_QUERY_1_ID}} with actual IDs from previous results
 */
export async function executeSequential(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("executeSequential")

  const queries = state.sqlQueries
  if (!queries || queries.length === 0) {
    const stateInfo = JSON.stringify({
      sqlQueries: state.sqlQueries,
      generatedSQL: state.generatedSQL,
      isConfirmed: state.isConfirmed,
      needsConfirmation: state.needsConfirmation,
    })
    chatbotLogger.error(`[LangGraph] ERROR: No sequential queries to execute! State: ${stateInfo}`)
    return {
      error: "No sequential queries to execute",
      queryResult: [],
    }
  }

  chatbotLogger.nodeDetail("executeSequential", {
    totalQueries: queries.length,
    currentIndex: state.currentQueryIndex,
    isConfirmed: state.isConfirmed,
    isQuerySafe: state.isQuerySafe,
  })

  // Log all queries for debugging
  chatbotLogger.info(`[LangGraph] Sequential queries to execute (${queries.length} total):`)
  queries.forEach((q, i) => {
    chatbotLogger.info(`  Query ${i + 1}:\n${q}`)
  })

  const sequentialResults: unknown[][] = []
  const previousIds: Map<number, string> = new Map() // Store IDs from each query

  try {
    for (let i = 0; i < queries.length; i++) {
      let query = queries[i]

      if (!query) {
        throw new Error(`Query ${i + 1} is undefined or empty`)
      }

      // Replace placeholders with actual IDs from previous queries
      for (const [queryIndex, id] of previousIds.entries()) {
        const placeholder = `{{PREV_QUERY_${queryIndex + 1}_ID}}`
        query = query.replaceAll(placeholder, id)
      }

      chatbotLogger.info(
        `[LangGraph] Executing sequential query ${i + 1}/${queries.length}:\n${query}`,
      )

      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`Query ${i + 1} execution timeout (60 seconds)`)),
          MAX_EXECUTION_TIME,
        )
      })

      const queryPromise = db.execute(sql.raw(query))
      const result: unknown = await Promise.race([queryPromise, timeoutPromise])

      // Parse result
      const resultData = result as { rows?: unknown[]; rowCount?: number } | unknown[]
      const rows = (
        resultData && typeof resultData === "object" && "rows" in resultData
          ? resultData.rows
          : resultData
      ) as unknown[]

      sequentialResults.push(rows || [])

      // Extract ID from RETURNING clause (first row, id field)
      if (rows && rows.length > 0) {
        const firstRow = rows[0] as Record<string, unknown>
        if (firstRow && "id" in firstRow && typeof firstRow.id === "string") {
          previousIds.set(i, firstRow.id)
          chatbotLogger.info(`[LangGraph] Captured ID from query ${i + 1}: ${firstRow.id}`)
        }
      }

      chatbotLogger.info(`[LangGraph] Query ${i + 1} completed: ${rows?.length || 0} rows`)
    }

    const executionTime = Date.now() - startTime

    // Get last query result as main result
    const lastResult = sequentialResults[sequentialResults.length - 1] || []

    // Limit rows if needed
    const finalResult = lastResult.length > MAX_ROWS ? lastResult.slice(0, MAX_ROWS) : lastResult

    chatbotLogger.nodeSuccess(
      `executeSequential (${queries.length} queries, ${finalResult.length} final rows)`,
      executionTime,
    )

    return {
      queryResult: finalResult,
      sequentialResults,
      executionTime,
      affectedRows: finalResult.length,
      error: null,
      currentQueryIndex: queries.length, // Mark all queries as executed
    }
  } catch (error) {
    const executionTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    // Extract database error details if available
    const dbError = error as {
      code?: string
      detail?: string
      hint?: string
      constraint?: string
      table?: string
      column?: string
      message?: string
      severity?: string
      position?: string
    }
    const dbErrorCode = dbError?.code
    const dbErrorDetail = dbError?.detail
    const dbErrorHint = dbError?.hint
    const dbErrorConstraint = dbError?.constraint
    const dbErrorTable = dbError?.table
    const dbErrorColumn = dbError?.column
    const _dbErrorMessage = dbError?.message
    const dbErrorSeverity = dbError?.severity
    const dbErrorPosition = dbError?.position

    // Log the current query that failed
    const currentQueryIndex = sequentialResults.length
    const failedQuery = queries[currentQueryIndex]

    // Generate user-friendly error message
    let userFriendlyMessage = ""

    if (errorMessage.includes("violates not-null constraint") || dbErrorCode === "23502") {
      const columnName = dbErrorColumn || "항목"
      userFriendlyMessage = `'${columnName}' 항목은 반드시 입력해야 해요. (${currentQueryIndex + 1}/${queries.length} 단계에서 문제 발생)`
    } else if (errorMessage.includes("violates unique constraint") || dbErrorCode === "23505") {
      userFriendlyMessage = `이미 동일한 데이터가 존재해요. 중복된 데이터는 저장할 수 없어요. (${currentQueryIndex + 1}/${queries.length} 단계에서 문제 발생)`
    } else if (
      errorMessage.includes("violates foreign key constraint") ||
      dbErrorCode === "23503"
    ) {
      userFriendlyMessage = `연결된 데이터를 찾을 수 없어요. 먼저 필요한 데이터가 있는지 확인해주세요. (${currentQueryIndex + 1}/${queries.length} 단계에서 문제 발생)`
    } else if (errorMessage.includes("violates check constraint") || dbErrorCode === "23514") {
      userFriendlyMessage = `입력하신 값이 올바르지 않아요. 다시 확인해주세요. (${currentQueryIndex + 1}/${queries.length} 단계에서 문제 발생)`
    } else if (errorMessage.includes("value too long") || dbErrorCode === "22001") {
      const match = errorMessage.match(/column "(\w+)"/)
      const columnName = match ? match[1] : "텍스트"
      userFriendlyMessage = `${columnName} 항목의 내용이 너무 길어요. 좀 더 짧게 입력해주세요. (${currentQueryIndex + 1}/${queries.length} 단계에서 문제 발생)`
    } else if (errorMessage.includes("syntax error") || dbErrorCode === "42601") {
      userFriendlyMessage = `처리 중 오류가 발생했어요. 다시 시도해볼게요. (${currentQueryIndex + 1}/${queries.length} 단계)`
    } else if (errorMessage.includes("does not exist")) {
      userFriendlyMessage = `요청하신 데이터 항목을 찾을 수 없어요. (${currentQueryIndex + 1}/${queries.length} 단계에서 문제 발생)`
    } else {
      userFriendlyMessage = `${currentQueryIndex + 1}/${queries.length} 단계에서 문제가 발생했어요: ${errorMessage}`
    }

    // Comprehensive error logging with box formatting
    chatbotLogger.error(
      `[LangGraph] Sequential Query Execution Failed:\n` +
        `┌─────────────────────────────────────────────────────────────\n` +
        `│ QUERY PROGRESS: ${currentQueryIndex}/${queries.length} completed\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ ERROR DETAILS:\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ Message: ${errorMessage}\n` +
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
        `│ FAILED QUERY #${currentQueryIndex + 1} (first 500 chars):\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ ${failedQuery?.substring(0, 500)}...\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ SUCCESSFULLY COMPLETED QUERIES: ${currentQueryIndex}/${queries.length}\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ USER MESSAGE:\n` +
        `├─────────────────────────────────────────────────────────────\n` +
        `│ ${userFriendlyMessage}\n` +
        `└─────────────────────────────────────────────────────────────`,
    )

    chatbotLogger.nodeError("executeSequential", userFriendlyMessage, executionTime)

    return {
      error: userFriendlyMessage,
      queryResult: [],
      sequentialResults,
      executionTime,
    }
  }
}
