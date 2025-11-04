import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getInsightGenerationPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-5",
})

export async function generateInsights(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("generateInsights")

  try {
    // 결과가 없거나 단순한 경우 인사이트 생략
    if (state.queryResult.length === 0 || state.queryResult.length === 1) {
      const duration = Date.now() - startTime
      chatbotLogger.nodeSuccess("generateInsights (skipped)", duration)
      return {
        insights: [],
      }
    }

    const prompt = getInsightGenerationPrompt(
      state.currentQuestion,
      state.analysis,
      state.queryResult,
    )

    const response = await llm.invoke(prompt)
    const content = response.content as string

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\[[\s\S]*\])/)
    const jsonStr = jsonMatch?.[1] || content

    const insights = JSON.parse(jsonStr.trim())

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess(
      `generateInsights (${Array.isArray(insights) ? insights.length : 0} insights)`,
      duration,
    )

    return {
      insights: Array.isArray(insights) ? insights : [],
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
    chatbotLogger.nodeError("generateInsights", errorMessage, duration)

    return {
      insights: [],
    }
  }
}
