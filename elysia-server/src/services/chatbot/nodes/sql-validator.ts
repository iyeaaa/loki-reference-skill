import { chatbotLogger } from "../../../utils/logger"
import type { ChatbotState } from "../state"

export async function validateSQL(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const emitter = state._emitter

  // 노드 시작 이벤트
  if (emitter) {
    emitter.nodeStart("validateSQL", "요청 내용을 확인하고 있어요...")
  }

  try {
    const sql = state.generatedSQL
    const sqlLower = sql.toLowerCase()

    // 중간 진행 상황 업데이트
    if (emitter) {
      emitter.progress("validateSQL", "안전하게 처리할 수 있는지 확인 중...")
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
        emitter.error("validateSQL", "보안상 허용되지 않는 작업이에요")
      }
      return {
        isQuerySafe: false,
        error:
          "안전하지 않은 작업이 포함되어 처리할 수 없어요. 데이터베이스 구조를 변경하려면 관리자에게 문의해주세요.",
      }
    }

    if (emitter) {
      emitter.progress("validateSQL", "데이터 접근 권한 확인 중...")
    }

    // 2. workspace_id filter check (required for data isolation)
    if (!sqlLower.includes("workspace_id")) {
      chatbotLogger.nodeError("validateSQL", "Missing workspace_id filter", 0)
      if (emitter) {
        emitter.error("validateSQL", "데이터 접근 권한 확인 실패")
      }
      return {
        isQuerySafe: false,
        error: "보안을 위해 귀하의 작업공간 데이터만 조회할 수 있어요.",
      }
    }

    if (emitter) {
      emitter.progress("validateSQL", "처리 가능 여부 확인 중...")
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
        emitter.error("validateSQL", "요청이 너무 복잡해요")
      }
      return {
        isQuerySafe: false,
        error: "처리하기에 너무 복잡한 요청이에요. 좀 더 간단하게 나눠서 요청해주시겠어요?",
      }
    }

    // 성공 이벤트
    if (emitter) {
      emitter.nodeComplete("validateSQL", "요청 확인 완료")
    }

    // All checks passed
    return {
      isQuerySafe: true,
      error: null,
      needsConfirmation: false,
    }
  } catch (error) {
    if (emitter) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
      emitter.error("validateSQL", errorMessage)
    }
    return {
      isQuerySafe: false,
      error: "요청을 확인하는 중 문제가 발생했어요.",
    }
  }
}
