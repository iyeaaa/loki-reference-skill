import { ChatOpenAI } from "@langchain/openai"
import { getVisualizationSuggestionPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.6, // Moderate creativity for varied visualization suggestions
})

export async function suggestVisualizations(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const emitter = state._emitter

  // Node start event
  if (emitter) {
    emitter.nodeStart("suggestVisualizations", "Creating visualizations...")
  }

  try {
    // Skip visualization if no results
    if (state.queryResult.length === 0) {
      if (emitter) {
        emitter.nodeComplete("suggestVisualizations", "Visualization skipped (no results)")
      }
      return {
        visualizationSuggestions: [],
      }
    }

    const prompt = getVisualizationSuggestionPrompt(state.queryResult)

    if (!prompt) {
      if (emitter) {
        emitter.nodeComplete("suggestVisualizations", "Visualization skipped (no prompt)")
      }
      return {
        visualizationSuggestions: [],
      }
    }

    // Use non-streaming LLM call for intermediate node (no progress events)
    const response = await llm.invoke(prompt)
    const content = response.content as string

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\[[\s\S]*\])/)
    const jsonStr = jsonMatch?.[1] || content

    const suggestions = JSON.parse(jsonStr.trim())

    if (emitter) {
      emitter.nodeComplete(
        "suggestVisualizations",
        `Generated ${Array.isArray(suggestions) ? suggestions.length : 0} visualization${Array.isArray(suggestions) && suggestions.length !== 1 ? "s" : ""}`,
        { visualizationSuggestions: Array.isArray(suggestions) ? suggestions : [] }, // Send to frontend immediately
      )
    }

    return {
      visualizationSuggestions: Array.isArray(suggestions) ? suggestions : [],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    if (emitter) {
      emitter.error("suggestVisualizations", errorMessage)
    }

    return {
      visualizationSuggestions: [],
    }
  }
}
