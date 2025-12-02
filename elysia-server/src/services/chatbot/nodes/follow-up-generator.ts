import { ChatOpenAI } from "@langchain/openai"
import { getFollowUpQuestionsPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.8, // High creativity for diverse, engaging follow-up questions
})

export async function generateFollowUpQuestions(
  state: ChatbotState,
): Promise<Partial<ChatbotState>> {
  const emitter = state._emitter

  // Node start event
  if (emitter) {
    emitter.nodeStart("generateFollowUpQuestions", "Generating follow-up questions...")
  }

  try {
    const prompt = getFollowUpQuestionsPrompt(
      state.currentQuestion,
      state.analysis,
      state.locale || "ko",
    )

    // Use non-streaming LLM call for intermediate node (no progress events)
    const response = await llm.invoke(prompt)
    const content = response.content as string

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\[[\s\S]*\])/)
    const jsonStr = jsonMatch?.[1] || content

    const questions = JSON.parse(jsonStr.trim())

    if (emitter) {
      emitter.nodeComplete(
        "generateFollowUpQuestions",
        `Generated ${Array.isArray(questions) ? questions.length : 0} follow-up questions`,
        { followUpQuestions: Array.isArray(questions) ? questions : [] }, // Send to frontend immediately
      )
    }

    return {
      followUpQuestions: Array.isArray(questions) ? questions : [],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    if (emitter) {
      emitter.error("generateFollowUpQuestions", errorMessage)
    }

    return {
      followUpQuestions: [],
    }
  }
}
