import { ChatOpenAI } from "@langchain/openai"
import { getInsightGenerationPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.7, // Higher temperature for creative, diverse insights
})

export async function generateInsights(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const emitter = state._emitter

  // Node start event
  if (emitter) {
    emitter.nodeStart("generateInsights", "Summarizing key insights...")
  }

  try {
    // Skip insights only if there are no results (can generate insights even for 1 row)
    if (state.queryResult.length === 0) {
      if (emitter) {
        emitter.nodeComplete("generateInsights", "Data insights skipped (no results)", {
          insights: [],
        })
      }
      return {
        insights: [],
      }
    }

    const prompt = getInsightGenerationPrompt(
      state.currentQuestion,
      state.analysis,
      state.queryResult,
      state.locale || "ko",
    )

    // Use non-streaming LLM call for intermediate node (no progress events)
    const response = await llm.invoke(prompt)
    const content = response.content as string

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\[[\s\S]*\])/)
    const jsonStr = jsonMatch?.[1] || content

    const insights = JSON.parse(jsonStr.trim())

    if (emitter) {
      emitter.nodeComplete(
        "generateInsights",
        `Summarized ${Array.isArray(insights) ? insights.length : 0} key insights`,
        { insights: Array.isArray(insights) ? insights : [] }, // Send to frontend immediately
      )
    }

    return {
      insights: Array.isArray(insights) ? insights : [],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    if (emitter) {
      emitter.error("generateInsights", errorMessage)
    }

    return {
      insights: [],
    }
  }
}
