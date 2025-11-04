import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import type { ChatbotState } from "../state"

const _llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
})

const DANGEROUS_KEYWORDS = [
  "drop",
  "delete",
  "truncate",
  "alter",
  "create",
  "update",
  "insert",
  "grant",
  "revoke",
  "exec",
  "execute",
  "pg_sleep",
  "pg_terminate_backend",
]

/**
 * Check if SQL contains dangerous keywords using word boundary matching
 * This prevents false positives like "created_at" containing "create"
 */
function _containsDangerousKeyword(sql: string): { found: boolean; keyword?: string } {
  const sqlLower = sql.toLowerCase()

  for (const keyword of DANGEROUS_KEYWORDS) {
    // Use word boundary (\b) to match only complete words
    // This prevents matching partial words like "created" or "updated"
    const regex = new RegExp(`\\b${keyword}\\b`, "i")
    if (regex.test(sqlLower)) {
      return { found: true, keyword }
    }
  }

  return { found: false }
}

export async function validateSQL(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("validateSQL")

  const _sql = state.generatedSQL

  // ⚠️ SECURITY VALIDATIONS TEMPORARILY DISABLED FOR TESTING
  // TODO: Re-enable these validations in production environment

  // 기본 보안 검사 - word boundary를 사용한 정확한 키워드 매칭
  // TEMPORARILY DISABLED: Allow all SQL operations for testing
  // const dangerousCheck = containsDangerousKeyword(sql)

  // if (dangerousCheck.found) {
  //   const duration = Date.now() - startTime
  //   chatbotLogger.nodeError(
  //     "validateSQL",
  //     `Dangerous keyword detected: ${dangerousCheck.keyword}`,
  //     duration,
  //   )
  //   return {
  //     isQuerySafe: false,
  //     error: `For security reasons, only read-only queries (SELECT) are allowed. Detected keyword: ${dangerousCheck.keyword?.toUpperCase()}`,
  //   }
  // }

  // workspace_id 필터 확인
  // TEMPORARILY DISABLED: Allow queries without workspace_id for testing
  // const sqlLower = sql.toLowerCase()
  // if (!sqlLower.includes("workspace_id")) {
  //   const duration = Date.now() - startTime
  //   chatbotLogger.nodeError("validateSQL", "Missing workspace_id filter", duration)
  //   return {
  //     isQuerySafe: false,
  //     error: "For security, workspace_id filter is required.",
  //   }
  // }

  // SELECT 쿼리인지 확인
  // TEMPORARILY DISABLED: Allow all SQL operations for testing
  // const trimmedSql = sqlLower.trim()
  // if (!trimmedSql.startsWith("select") && !trimmedSql.startsWith("with")) {
  //   const duration = Date.now() - startTime
  //   chatbotLogger.nodeError("validateSQL", "Only SELECT queries allowed", duration)
  //   return {
  //     isQuerySafe: false,
  //     error: "Only SELECT queries are allowed.",
  //   }
  // }

  // AI 검증 (추가 검증)
  // TEMPORARILY DISABLED: Skip AI validation for faster testing
  // try {
  //   const prompt = getValidationPrompt(state.generatedSQL)
  //   const response = await llm.invoke(prompt)
  //   const content = response.content as string

  //   const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\{[\s\S]*\})/)
  //   const jsonStr = jsonMatch?.[1] || content
  //   const validation = JSON.parse(jsonStr.trim())

  //   if (!validation.isSafe) {
  //     const duration = Date.now() - startTime
  //     chatbotLogger.nodeError("validateSQL", validation.issues.join(", "), duration)
  //     return {
  //       isQuerySafe: false,
  //       error: validation.issues.join(", "),
  //     }
  //   }

  //   const duration = Date.now() - startTime
  //   chatbotLogger.nodeSuccess("validateSQL", duration)

  //   return {
  //     isQuerySafe: true,
  //     error: null,
  //   }
  // } catch (error) {
  //   const duration = Date.now() - startTime
  //   const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
  //   chatbotLogger.nodeError("validateSQL", errorMessage, duration)

  //   // 검증 실패 시 안전하게 차단
  //   return {
  //     isQuerySafe: false,
  //     error: "An error occurred during query validation. Execution blocked for safety.",
  //   }
  // }

  // For testing: Allow all queries (validations disabled)
  const duration = Date.now() - startTime
  chatbotLogger.nodeSuccess("validateSQL (validations disabled)", duration)

  // Check for dangerous operations (DROP, ALTER, CREATE TABLE)
  const sqlLower = state.generatedSQL.toLowerCase().trim()
  const isDangerous =
    sqlLower.startsWith("drop") ||
    sqlLower.startsWith("alter") ||
    sqlLower.startsWith("create table") ||
    sqlLower.startsWith("create database")

  if (isDangerous) {
    chatbotLogger.nodeError(
      "validateSQL",
      "Dangerous operation blocked: DROP/ALTER/CREATE TABLE",
      Date.now() - startTime,
    )
    return {
      isQuerySafe: false,
      error:
        "보안상의 이유로 DROP, ALTER, CREATE TABLE 작업은 허용되지 않습니다. 스키마 변경은 데이터베이스 관리자에게 문의해주세요.",
    }
  }

  // Check if mutation query needs confirmation (only INSERT, UPDATE, DELETE)
  // Handle both direct mutations, CTE-based mutations, and sequential queries
  let isMutation = false
  let allQueries = state.generatedSQL

  // Check for sequential queries
  if (state.sqlQueries && state.sqlQueries.length > 0) {
    // Multiple queries - check all of them
    allQueries = state.sqlQueries.join("\n\n")
    const allQueriesLower = allQueries.toLowerCase()
    isMutation =
      allQueriesLower.includes("insert into") ||
      allQueriesLower.includes("update ") ||
      allQueriesLower.includes("delete from")
  } else {
    // Single query
    isMutation =
      sqlLower.startsWith("insert") ||
      sqlLower.startsWith("update") ||
      sqlLower.startsWith("delete") ||
      // CTE (WITH) 구문 내의 mutation 감지
      (sqlLower.startsWith("with") &&
        (sqlLower.includes("insert into") ||
          sqlLower.includes("update ") ||
          sqlLower.includes("delete from")))
  }

  if (isMutation && !state.isConfirmed) {
    // Generate confirmation message
    let operationEmoji = ""
    let operationTitle = ""
    let operationDesc = ""

    // Detect operation type (handle both direct and CTE-based mutations)
    const checkSQL = allQueries.toLowerCase()
    if (checkSQL.includes("insert into")) {
      operationEmoji = "✨"
      operationTitle = "데이터 생성"
      operationDesc = "새로운 데이터를 데이터베이스에 추가합니다."
    } else if (checkSQL.includes("update ")) {
      operationEmoji = "✏️"
      operationTitle = "데이터 수정"
      operationDesc = "기존 데이터를 변경합니다."
    } else if (checkSQL.includes("delete from")) {
      operationEmoji = "🗑️"
      operationTitle = "데이터 삭제"
      operationDesc = "데이터를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다."
    }

    // Show appropriate queries in confirmation message
    let displayQueries = ""
    if (state.sqlQueries && state.sqlQueries.length > 1) {
      // Multiple queries - show each with a numbered label
      displayQueries = `**실행할 쿼리 (${state.sqlQueries.length}개):**\n\n`
      state.sqlQueries.forEach((query, index) => {
        displayQueries += `\`\`\`sql\n-- ${index + 1}) ${index === 0 ? "첫 번째 쿼리" : index === 1 ? "두 번째 쿼리" : index === 2 ? "세 번째 쿼리" : `${index + 1}번째 쿼리`}\n${query}\n\`\`\`\n\n`
      })
    } else {
      displayQueries = `**실행할 쿼리:**\n\`\`\`sql\n${state.generatedSQL}\n\`\`\``
    }

    const confirmationMessage = `${operationEmoji} **${operationTitle}**\n\n${operationDesc}\n\n${displayQueries}\n계속 진행하시겠습니까?`

    chatbotLogger.info(
      `[LangGraph] Mutation detected: ${operationTitle}, requesting user confirmation`,
    )
    chatbotLogger.nodeDetail("validateSQL", {
      isSequential: state.sqlQueries && state.sqlQueries.length > 1,
      queryCount: state.sqlQueries?.length || 1,
      confirmationMessageLength: confirmationMessage.length,
    })

    return {
      isQuerySafe: true,
      error: null,
      needsConfirmation: true,
      confirmationMessage,
    }
  }

  return {
    isQuerySafe: true,
    error: null,
    needsConfirmation: false,
  }
}
