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
    emitter.nodeStart("executeQuery", "데이터를 불러오고 있어요...")
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
      emitter.error("executeQuery", "승인이 필요해요")
    }

    return {
      error: "이 작업은 승인이 필요해요.",
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
      emitter.error("executeQuery", "처리할 요청이 없어요")
    }

    return {
      error: "처리할 요청이 없어요. 시스템 오류가 발생했습니다.",
      executionTime: Date.now() - startTime,
    }
  }

  chatbotLogger.info(`[LangGraph] Executing SQL:\n${state.generatedSQL}`)

  // Emit progress
  if (emitter) {
    emitter.progress("executeQuery", "데이터를 검색하고 있어요...")
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

      // Division by zero 에러 처리
      if (error.message.includes("division by zero")) {
        userFriendlyMessage =
          "계산할 데이터가 없어요. 다른 기간으로 다시 시도해주세요."
        errorMessage = userFriendlyMessage
      }
      // 타임아웃 에러
      else if (error.message.includes("초과") || error.message.includes("timeout")) {
        userFriendlyMessage =
          "처리 시간이 너무 오래 걸리고 있어요. 검색 범위를 줄이거나 조건을 추가해주세요."
        errorMessage = userFriendlyMessage
      }
      // 테이블/컬럼이 존재하지 않는 경우
      else if (
        error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("column")
      ) {
        userFriendlyMessage = `요청하신 데이터 항목을 찾을 수 없어요. 다시 확인해주세요.`
        errorMessage = userFriendlyMessage
      }
      // NULL constraint violation
      else if (error.message.includes("violates not-null constraint") || dbErrorCode === "23502") {
        const columnName = dbErrorColumn || "항목"
        userFriendlyMessage = `'${columnName}' 항목은 반드시 입력해야 해요.`
        errorMessage = userFriendlyMessage
      }
      // UNIQUE constraint violation
      else if (error.message.includes("violates unique constraint") || dbErrorCode === "23505") {
        userFriendlyMessage = `이미 동일한 데이터가 존재해요. 중복된 데이터는 저장할 수 없어요.`
        errorMessage = userFriendlyMessage
      }
      // FOREIGN KEY constraint violation
      else if (
        error.message.includes("violates foreign key constraint") ||
        dbErrorCode === "23503"
      ) {
        userFriendlyMessage = `연결된 데이터를 찾을 수 없어요. 먼저 필요한 데이터가 있는지 확인해주세요.`
        errorMessage = userFriendlyMessage
      }
      // CHECK constraint violation
      else if (error.message.includes("violates check constraint") || dbErrorCode === "23514") {
        userFriendlyMessage = `입력하신 값이 올바르지 않아요. 다시 확인해주세요.`
        errorMessage = userFriendlyMessage
      }
      // String data too long
      else if (error.message.includes("value too long") || dbErrorCode === "22001") {
        const match = error.message.match(/column "(\w+)"/)
        const columnName = match ? match[1] : "텍스트"
        userFriendlyMessage = `${columnName} 항목의 내용이 너무 길어요. 좀 더 짧게 입력해주세요.`
        errorMessage = userFriendlyMessage
      }
      // Invalid syntax
      else if (error.message.includes("syntax error") || dbErrorCode === "42601") {
        userFriendlyMessage = `처리 중 오류가 발생했어요. 다시 시도해볼게요.`
        errorMessage = `SQL syntax error at position ${dbErrorPosition || "unknown"}: ${error.message}`
      }
      // 그 외 일반 에러
      else {
        userFriendlyMessage = `데이터 처리 중 문제가 발생했어요: ${error.message}`
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
