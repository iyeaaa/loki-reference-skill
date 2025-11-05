import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getAnalysisResultPrompt } from "../prompts"
import { streamLLMResponse } from "../sse-context"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.3, // Consistent analysis with some flexibility
  streaming: true, // Enable streaming for real-time response
})

export async function analyzeResults(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  // Emit node start event
  if (emitter) {
    emitter.nodeStart("analyzeResults", "결과를 정리하고 있어요...")
  }

  chatbotLogger.nodeStart("analyzeResults")

  try {
    // Detect mutation queries (UPDATE/DELETE/INSERT) or CTE with mutation
    const sqlLower = state.generatedSQL.toLowerCase().trim()
    const isMutation =
      sqlLower.startsWith("update") ||
      sqlLower.startsWith("delete") ||
      sqlLower.startsWith("insert") ||
      sqlLower.startsWith("with")

    // CTE (WITH) 구문 내의 INSERT/UPDATE/DELETE 감지
    const hasCTEMutation =
      sqlLower.includes("insert into") ||
      sqlLower.includes("update ") ||
      sqlLower.includes("delete from")

    // 결과가 없는 경우
    if (state.queryResult.length === 0) {
      const duration = Date.now() - startTime

      // Mutation 쿼리인 경우
      if (isMutation || hasCTEMutation) {
        const affectedRows = state.affectedRows || 0
        chatbotLogger.nodeSuccess(`analyzeResults (mutation: ${affectedRows} rows)`, duration)

        let operationType = "created"
        if (sqlLower.includes("update")) operationType = "updated"
        else if (sqlLower.includes("delete")) operationType = "deleted"
        else if (sqlLower.includes("insert")) operationType = "created"

        const operationText = operationType === "created" ? "저장" : operationType === "updated" ? "수정" : "삭제"
        const message = `✅ ${affectedRows || 1}건의 데이터를 ${operationText}했어요.\n\n데이터베이스에 성공적으로 반영되었습니다.`

        if (emitter) {
          emitter.nodeComplete("analyzeResults", "작업 완료", { analysis: message })
        }

        return { analysis: message }
      }

      // SELECT 쿼리인데 결과가 없는 경우
      chatbotLogger.nodeSuccess("analyzeResults (no results)", duration)

      const message = "조회된 결과가 없어요. 다른 조건으로 검색해보세요."
      if (emitter) {
        emitter.nodeComplete("analyzeResults", "조회 완료", { analysis: message })
      }

      return { analysis: message }
    }

    // CTE mutation의 경우 결과가 있어도 mutation 메시지 표시
    if (hasCTEMutation && state.queryResult.length > 0) {
      const duration = Date.now() - startTime
      chatbotLogger.nodeSuccess(
        `analyzeResults (CTE mutation: ${state.queryResult.length} rows returned)`,
        duration,
      )

      let operationType = "created"
      if (sqlLower.includes("update")) operationType = "updated"
      else if (sqlLower.includes("delete")) operationType = "deleted"
      else if (sqlLower.includes("insert")) operationType = "created"

      // Format the result data nicely
      const resultSummary =
        state.queryResult.length === 1
          ? "\n\n**Created record:**\n```json\n" +
            JSON.stringify(state.queryResult[0], null, 2) +
            "\n```"
          : `\n\n**${state.queryResult.length} records ${operationType}**`

      const operationText = operationType === "created" ? "저장" : operationType === "updated" ? "수정" : "삭제"
      const message = `✅ ${state.queryResult.length}건의 데이터를 ${operationText}했어요.${resultSummary}`

      if (emitter) {
        emitter.nodeComplete("analyzeResults", "작업 완료", { analysis: message })
      }

      return { analysis: message }
    }

    // Stream LLM response with progress updates
    if (emitter) {
      emitter.progress("analyzeResults", "결과를 분석하고 있어요...")
    }

    const prompt = getAnalysisResultPrompt(
      state.currentQuestion,
      state.generatedSQL,
      state.queryResult,
      state.executionTime,
    )

    let analysis = ""
    if (emitter) {
      // Use streaming for real-time response
      const stream = await llm.stream(prompt)
      analysis = await streamLLMResponse(emitter, "analyzeResults", stream, {
        onComplete: () => {
          emitter.progress("analyzeResults", "분석 완료")
        },
      })
    } else {
      // Fallback: non-streaming when emitter is not available
      const response = await llm.invoke(prompt)
      analysis = response.content as string
    }

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("analyzeResults", duration)

    if (emitter) {
      emitter.nodeComplete("analyzeResults", "분석 완료")
    }

    return { analysis }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    chatbotLogger.nodeError("analyzeResults", errorMessage, duration)

    if (emitter) {
      emitter.error("analyzeResults", errorMessage)
    }

    return {
      analysis: "결과를 분석하는 중 문제가 발생했어요.",
      error: errorMessage,
    }
  }
}
