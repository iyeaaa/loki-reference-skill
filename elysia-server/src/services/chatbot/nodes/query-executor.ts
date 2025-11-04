import { sql } from "drizzle-orm"
import { db } from "../../../db/drizzle"
import { chatbotLogger } from "../../../utils/logger"
import type { ChatbotState } from "../state"

const MAX_EXECUTION_TIME = 10000 // 10초
const MAX_ROWS = 1000
const MAX_RETRIES = 10

export async function executeQuery(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("executeQuery")

  // Log input state
  chatbotLogger.nodeDetail("executeQuery", {
    sqlLength: state.generatedSQL?.length || 0,
    retryCount: state.retryCount,
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
    return {
      error: "This operation requires user confirmation.",
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
    return {
      error: "No SQL query to execute. This is a bug in the system.",
      executionTime: Date.now() - startTime,
    }
  }

  chatbotLogger.info(`[LangGraph] Executing SQL:\n${state.generatedSQL}`)

  try {
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Query execution timeout (10 seconds)")),
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

    // 에러 타입별 사용자 친화적 메시지
    let errorMessage = "An error occurred while querying the database"
    let detailedError = ""

    if (error instanceof Error) {
      detailedError = error.message

      // Division by zero 에러 처리
      if (error.message.includes("division by zero")) {
        errorMessage =
          "Cannot calculate ratio due to no results. Please try a different time period with data."
      }
      // 타임아웃 에러
      else if (error.message.includes("초과") || error.message.includes("timeout")) {
        errorMessage =
          "Query execution timeout. Please try a narrower time range or add more conditions."
      }
      // 테이블/컬럼이 존재하지 않는 경우
      else if (
        error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("column")
      ) {
        errorMessage = `Database schema error: ${error.message}. The query will be regenerated.`
      }
      // 그 외 일반 에러
      else {
        errorMessage = `Database query error: ${error.message}`
      }
    }

    // 재시도 정보 로깅
    const retryInfo =
      state.retryCount > 0 ? ` (Retry ${state.retryCount + 1}/${MAX_RETRIES + 1})` : ""
    chatbotLogger.nodeError("executeQuery", `${errorMessage}${retryInfo}`, executionTime)

    // 디버깅을 위한 상세 로그
    if (detailedError) {
      chatbotLogger.info(`[Query Error Details] ${detailedError}`)
      chatbotLogger.info(`[Failed Query] ${state.generatedSQL}`)
    }

    return {
      queryResult: [],
      executionTime,
      error: errorMessage,
      retryCount: state.retryCount + 1,
    }
  }
}
