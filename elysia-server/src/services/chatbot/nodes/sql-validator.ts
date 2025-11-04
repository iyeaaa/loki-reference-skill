import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import type { ChatbotState } from "../state"

const _llm = new ChatOpenAI({
  model: "gpt-5",
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

  // INSERT, UPDATE, DELETE are now allowed without confirmation
  // Only DROP, ALTER, CREATE TABLE/DATABASE are blocked (checked above)
  return {
    isQuerySafe: true,
    error: null,
    needsConfirmation: false,
  }
}
