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

  // 노드 시작 이벤트
  if (emitter) {
    emitter.nodeStart("generateFollowUpQuestions", "추가 질문 제안 중...")
  }

  try {
    const prompt = getFollowUpQuestionsPrompt(state.currentQuestion, state.analysis)

    // Use non-streaming LLM call for intermediate node (no progress events)
    const response = await llm.invoke(prompt)
    const content = response.content as string

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\[[\s\S]*\])/)
    const jsonStr = jsonMatch?.[1] || content

    const questions = JSON.parse(jsonStr.trim())

    if (emitter) {
      emitter.nodeComplete(
        "generateFollowUpQuestions",
        `후속 질문 생성 완료 (${Array.isArray(questions) ? questions.length : 0}개)`,
        { followUpQuestions: Array.isArray(questions) ? questions : [] }, // 즉시 프론트엔드로 전송
      )
    }

    return {
      followUpQuestions: Array.isArray(questions) ? questions : [],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
    if (emitter) {
      emitter.error("generateFollowUpQuestions", errorMessage)
    }

    return {
      followUpQuestions: [],
    }
  }
}
