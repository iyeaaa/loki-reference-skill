import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getVisualizationSuggestionPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.3,
})

export async function suggestVisualizations(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("suggestVisualizations")

  try {
    // 결과가 없는 경우 시각화 생략
    if (state.queryResult.length === 0) {
      const duration = Date.now() - startTime
      chatbotLogger.nodeSuccess("suggestVisualizations (skipped)", duration)
      return {
        visualizationSuggestions: [],
      }
    }

    const prompt = getVisualizationSuggestionPrompt(state.queryResult)

    if (!prompt) {
      const duration = Date.now() - startTime
      chatbotLogger.nodeSuccess("suggestVisualizations (no prompt)", duration)
      return {
        visualizationSuggestions: [],
      }
    }

    const response = await llm.invoke(prompt)
    const content = response.content as string

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\[[\s\S]*\])/)
    const jsonStr = jsonMatch?.[1] || content

    const suggestions = JSON.parse(jsonStr.trim())

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess(
      `suggestVisualizations (${Array.isArray(suggestions) ? suggestions.length : 0} suggestions)`,
      duration,
    )

    return {
      visualizationSuggestions: Array.isArray(suggestions) ? suggestions : [],
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
    chatbotLogger.nodeError("suggestVisualizations", errorMessage, duration)

    return {
      visualizationSuggestions: [],
    }
  }
}
