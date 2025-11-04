import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getSQLGenerationPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-5",
})

export async function generateSQL(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("generateSQL")

  // Log input state
  chatbotLogger.nodeDetail("generateSQL", {
    question: state.currentQuestion,
    workspaceId: state.workspaceId,
    metadata: state.metadata,
    hasError: !!state.error,
  })

  try {
    const prompt = getSQLGenerationPrompt(
      state.currentQuestion,
      state.workspaceId,
      state.schemaContext,
      state.metadata || {},
    )

    const response = await llm.invoke(prompt)
    const content = response.content as string

    // JSON 추출 시도
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\{[\s\S]*\})/)

    // JSON 형식인 경우
    if (jsonMatch?.[1]) {
      const jsonStr = jsonMatch[1]
      const result = JSON.parse(jsonStr.trim())

      // queries 배열이 있는 경우 (복잡한 순차 실행)
      if (result.queries && Array.isArray(result.queries)) {
        const duration = Date.now() - startTime
        chatbotLogger.nodeSuccess("generateSQL (sequential)", duration)

        chatbotLogger.nodeDetail("generateSQL", {
          queryCount: result.queries.length,
          explanation: result.explanation,
        })
        chatbotLogger.info(
          `[LangGraph] Generated ${result.queries.length} sequential queries:\n${result.queries.map((q: string, i: number) => `${i + 1}. ${q.substring(0, 100)}...`).join("\n")}`,
        )

        return {
          sqlQueries: result.queries,
          generatedSQL: result.queries[0], // 첫 번째 쿼리를 기본값으로
          sqlExplanation: result.explanation,
        }
      }

      // 단일 SQL (result.sql)이 있는 경우
      if (result.sql) {
        const duration = Date.now() - startTime
        chatbotLogger.nodeSuccess("generateSQL", duration)

        chatbotLogger.nodeDetail("generateSQL", {
          sqlLength: result.sql.length,
          explanation: result.explanation,
          estimatedRows: result.estimatedRows,
        })
        chatbotLogger.info(`[LangGraph] Generated SQL:\n${result.sql}`)

        return {
          generatedSQL: result.sql,
          sqlExplanation: result.explanation,
          sqlQueries: [], // 순차 쿼리 없음
        }
      }
    }

    // JSON 형식이 아닌 경우, 직접 SQL로 간주 (기존 호환성)
    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("generateSQL (raw)", duration)

    chatbotLogger.info(`[LangGraph] Generated raw SQL:\n${content}`)

    return {
      generatedSQL: content.trim(),
      sqlExplanation: "SQL generated without explanation",
      sqlQueries: [],
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    chatbotLogger.nodeError("generateSQL", errorMessage, duration)

    return {
      error: `SQL generation error: ${errorMessage}`,
      generatedSQL: "",
      sqlExplanation: "",
    }
  }
}
