import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getFollowUpQuestionsPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0,
})

export async function generateFollowUpQuestions(
  state: ChatbotState,
): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("generateFollowUpQuestions")

  try {
    const prompt = getFollowUpQuestionsPrompt(state.currentQuestion, state.analysis)

    const response = await llm.invoke(prompt)
    const content = response.content as string

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\[[\s\S]*\])/)
    const jsonStr = jsonMatch?.[1] || content

    const questions = JSON.parse(jsonStr.trim())

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess(
      `generateFollowUpQuestions (${Array.isArray(questions) ? questions.length : 0} questions)`,
      duration,
    )

    return {
      followUpQuestions: Array.isArray(questions) ? questions : [],
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
    chatbotLogger.nodeError("generateFollowUpQuestions", errorMessage, duration)

    return {
      followUpQuestions: [],
    }
  }
}
