import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getSQLGenerationPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
})

export async function generateSQL(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("generateSQL")

  try {
    // 재시도 시 이전 오류 정보를 포함
    const previousError = state.retryCount > 0 ? state.error || undefined : undefined
    const previousSQL = state.retryCount > 0 ? state.generatedSQL || undefined : undefined

    const prompt = getSQLGenerationPrompt(
      state.currentQuestion,
      state.workspaceId,
      state.schemaContext,
      state.metadata || {},
      previousError,
      previousSQL,
    )

    const response = await llm.invoke(prompt)
    const content = response.content as string

    // JSON 추출
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch?.[1] || content

    const result = JSON.parse(jsonStr.trim())

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("generateSQL", duration)

    return {
      generatedSQL: result.sql,
      sqlExplanation: result.explanation,
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
