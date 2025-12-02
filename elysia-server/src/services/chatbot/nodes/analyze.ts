import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getAnalysisPrompt, getAnalysisPromptWithCSV } from "../prompts"
import { getRelevantSchema } from "../schema-context"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.3, // Consistent analysis with some flexibility
})

export async function analyzeQuestion(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  // Emit node start event
  if (emitter) {
    emitter.nodeStart("analyzeQuestion", "Analyzing your request...")
  }

  chatbotLogger.nodeStart("analyzeQuestion")

  // Log input state
  chatbotLogger.nodeDetail("analyzeQuestion", {
    question: state.currentQuestion,
    workspaceId: state.workspaceId,
    messageCount: state.messages.length,
  })

  try {
    // PRIORITY CHECK: Sequence generation request bypasses normal analysis
    if (state.sequenceGenerationRequest) {
      chatbotLogger.info(
        `[Analyze] Detected sequence generation request for group: ${state.sequenceGenerationRequest.customerGroupName}`,
      )

      const duration = Date.now() - startTime
      chatbotLogger.nodeSuccess("analyzeQuestion (sequence bypass)", duration)

      if (emitter) {
        emitter.nodeComplete("analyzeQuestion", "Sequence generation request detected", {
          intent: "sequence_generation",
          isSequenceGenerationRequest: true,
        })
      }

      return {
        metadata: {
          intent: "sequence_generation",
          operationType: "create",
          requiredTables: ["sequences", "sequence_steps"],
        },
        isSequenceGenerationRequest: true,
        schemaContext: "",
        needsClarification: false,
      }
    }

    // Check if CSV data is present
    const hasCSV = !!state.csvData && state.csvData.rowCount > 0

    const prompt =
      hasCSV && state.csvData
        ? getAnalysisPromptWithCSV(
            state.currentQuestion,
            state.workspaceId,
            state.csvData,
            state.messages,
          )
        : getAnalysisPrompt(state.currentQuestion, state.workspaceId, state.messages)

    // Generate analysis using LLM (no intermediate progress events)
    const response = await llm.invoke(prompt)
    const content = response.content as string

    // JSON 추출 (마크다운 코드 블록 제거)
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch?.[1] || content

    const analysis = JSON.parse((jsonStr || content).trim())

    // Check if this is a sequence generation request from LLM analysis
    if (
      analysis.operationType === "sequence_generation" ||
      analysis.intent === "sequence_generation_request"
    ) {
      chatbotLogger.info("[Analyze] Detected sequence generation intent from LLM analysis")

      // Extract customer group info from conversation context
      // Look for leadGroupCreated metadata in recent messages
      let customerGroupInfo: {
        groupId?: string
        groupName?: string
        leadsCount?: number
      } = {}

      // Search through messages for lead group creation info
      for (let i = state.messages.length - 1; i >= 0; i--) {
        const msg = state.messages[i]
        if (msg?.metadata?.leadGroupCreated) {
          const leadGroup = msg.metadata.leadGroupCreated
          customerGroupInfo = {
            groupId: leadGroup.groupId,
            groupName: leadGroup.groupName,
            leadsCount: leadGroup.leadsCount,
          }
          chatbotLogger.info(
            `[Analyze] Found customer group from context: ${customerGroupInfo.groupName}`,
          )
          break
        }
      }

      const duration = Date.now() - startTime

      // If no customer group found in context, ask user to upload leads first
      if (!customerGroupInfo.groupId || !customerGroupInfo.groupName) {
        chatbotLogger.info("[Analyze] No customer group found in context")
        chatbotLogger.nodeSuccess("analyzeQuestion (no group)", duration)

        if (emitter) {
          emitter.nodeComplete("analyzeQuestion", "No customer group found", {
            intent: "sequence_generation_request",
            noCustomerGroup: true,
          })
        }

        return {
          metadata: {
            intent: "sequence_generation_request",
            operationType: "create",
          },
          analysis:
            "이메일 시퀀스를 생성하려면 먼저 리드를 업로드해주세요.\n\n" +
            '아래의 "Drop Your Leads Here" 버튼을 클릭하여 리드 파일(CSV/Excel)을 업로드하면, ' +
            "해당 리드들에 대한 맞춤형 이메일 시퀀스를 자동으로 생성해 드립니다.",
          needsClarification: false,
          schemaContext: "",
        }
      }

      chatbotLogger.nodeSuccess("analyzeQuestion (sequence direct)", duration)

      // Emit progress event - starting sequence generation
      if (emitter) {
        emitter.progress(
          "analyzeQuestion",
          `"${customerGroupInfo.groupName}" 그룹에 대한 이메일 시퀀스 생성을 시작합니다...`,
        )
        emitter.nodeComplete("analyzeQuestion", "Starting sequence generation", {
          intent: "sequence_generation",
          isSequenceGenerationRequest: true,
          customerGroupInfo,
        })
      }

      // Directly route to sequence generation flow (no modal)
      return {
        metadata: {
          intent: "sequence_generation",
          operationType: "create",
          requiredTables: ["sequences", "sequence_steps", "sequence_enrollments"],
        },
        sequenceGenerationRequest: {
          customerGroupId: customerGroupInfo.groupId,
          customerGroupName: customerGroupInfo.groupName,
          membersCount: customerGroupInfo.leadsCount || 0,
        },
        isSequenceGenerationRequest: true,
        needsClarification: false,
        schemaContext: "",
      }
    }

    // 스키마 컨텍스트 준비
    const schemaContext = getRelevantSchema(state.currentQuestion)

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("analyzeQuestion", duration)

    // Log output details
    chatbotLogger.nodeDetail("analyzeQuestion", {
      intent: analysis.intent,
      requiredTables: analysis.requiredTables,
      timeRange: analysis.timeRange,
      needsClarification: analysis.needsClarification || false,
      analysisType: analysis.analysisType,
    })

    // Emit node complete event
    if (emitter) {
      emitter.nodeComplete("analyzeQuestion", "Analysis complete", {
        intent: analysis.intent,
        needsClarification: analysis.needsClarification || false,
      })
    }

    return {
      metadata: analysis,
      needsClarification: analysis.needsClarification || false,
      clarificationQuestion: analysis.clarificationQuestion || "",
      schemaContext,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    chatbotLogger.nodeError("analyzeQuestion", errorMessage, duration)

    // Emit error event
    if (emitter) {
      emitter.error("analyzeQuestion", `Failed to analyze request: ${errorMessage}`)
    }

    return {
      error: `An error occurred while analyzing your request. Please try again.`,
      needsClarification: false,
    }
  }
}
