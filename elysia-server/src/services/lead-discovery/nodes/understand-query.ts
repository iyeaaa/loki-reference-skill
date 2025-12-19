/**
 * Understand Query Node
 * Analyzes user input confidence and triggers clarification for ambiguous queries
 * This node runs after mode-router for advanced mode searches
 */

import { type Command, GraphInterrupt, interrupt } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"
import { createErrorContext } from "../error-classifier"
import { leadDiscoveryLogger } from "../logger"
import type { ClarificationQuestion, ClarificationState, LeadDiscoveryState } from "../state"
import { AVAILABLE_COUNTRIES, AVAILABLE_INDUSTRIES } from "./buyer-recommender"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0,
})

// Confidence threshold below which we ask for clarification
const CONFIDENCE_THRESHOLD = 70

// Simplified country options for clarification UI
const COUNTRY_OPTIONS = ["USA", "Canada", "전체 (All)"]

// Simplified industry options for clarification UI (top categories)
const INDUSTRY_OPTIONS = [
  "Business Services",
  "Software & Internet",
  "Healthcare",
  "Manufacturing",
  "Financial Services",
  "Retail",
  "Real Estate & Construction",
  "Education",
  "기타 (Other)",
]

// Analyze user input and determine what's missing or ambiguous
async function analyzeQueryConfidence(
  userInput: string,
  existingParams?: {
    country?: string
    industry?: string
    employeeRange?: string
  },
): Promise<{
  confidence: number
  understood: {
    country?: string
    industry?: string
    employeeRange?: string
    keywords?: string[]
  }
  missingFields: Array<"country" | "industry" | "employeeRange">
  reasoning: string
}> {
  const prompt = `Analyze the following user search query for a B2B lead database and determine what information is clearly specified vs missing/ambiguous.

User Query: "${userInput}"
${existingParams?.country ? `Pre-detected Country: ${existingParams.country}` : ""}
${existingParams?.industry ? `Pre-detected Industry: ${existingParams.industry}` : ""}

## Available Options:
Countries: ${AVAILABLE_COUNTRIES.slice(0, 5).join(", ")}
Industries: ${AVAILABLE_INDUSTRIES.slice(0, 20).join(", ")}

## Task:
Analyze what the user clearly wants vs what is ambiguous or missing.

## Response Format (JSON):
{
  "confidence": 0-100,
  "understood": {
    "country": "Detected country or null if not specified",
    "industry": "Detected industry or null if not specified", 
    "employeeRange": "Detected employee range or null",
    "keywords": ["extracted", "search", "keywords"]
  },
  "missingFields": ["country", "industry", "employeeRange"],
  "reasoning": "Brief explanation of confidence score"
}

## Scoring Guidelines:
- 90-100: Both country AND industry are clearly specified (e.g., "미국 헬스케어 회사")
- 70-89: One of country/industry is specified, the other can be reasonably inferred
- 50-69: Only vague criteria given (e.g., "좋은 회사", "IT 회사" without country)
- 0-49: Very vague or unclear query (e.g., "회사 찾아줘")

Important:
- If user says "미국" or "USA", country is specified
- If user mentions a specific industry like "헬스케어", "소프트웨어", "제조업", industry is specified
- Generic terms like "회사", "기업", "바이어" do NOT count as industry specification
- "스타트업" suggests small employee range but NOT a specific industry

Respond with JSON only, no markdown.`

  try {
    const response = await llm.invoke(prompt)
    const content = (response.content as string).trim()

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        confidence: parsed.confidence || 50,
        understood: {
          country: parsed.understood?.country || existingParams?.country,
          industry: parsed.understood?.industry || existingParams?.industry,
          employeeRange: parsed.understood?.employeeRange || existingParams?.employeeRange,
          keywords: parsed.understood?.keywords || [],
        },
        missingFields: parsed.missingFields || [],
        reasoning: parsed.reasoning || "Analysis completed",
      }
    }

    // Fallback
    return {
      confidence: 50,
      understood: {
        country: existingParams?.country,
        industry: existingParams?.industry,
        employeeRange: existingParams?.employeeRange,
        keywords: [],
      },
      missingFields: ["country", "industry"],
      reasoning: "Could not parse LLM response",
    }
  } catch (error) {
    leadDiscoveryLogger.warn(`Query analysis LLM failed: ${error}`)
    return {
      confidence: 50,
      understood: {
        country: existingParams?.country,
        industry: existingParams?.industry,
        employeeRange: existingParams?.employeeRange,
        keywords: [],
      },
      missingFields: ["country", "industry"],
      reasoning: "LLM analysis failed",
    }
  }
}

// Build clarification questions based on missing fields
function buildClarificationQuestions(
  missingFields: Array<"country" | "industry" | "employeeRange">,
): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = []

  if (missingFields.includes("country")) {
    questions.push({
      field: "country",
      label: "어느 국가의 회사를 찾으시나요?",
      options: COUNTRY_OPTIONS,
      required: true,
    })
  }

  if (missingFields.includes("industry")) {
    questions.push({
      field: "industry",
      label: "어떤 산업의 회사를 찾으시나요?",
      options: INDUSTRY_OPTIONS,
      required: true,
    })
  }

  if (missingFields.includes("employeeRange")) {
    questions.push({
      field: "employeeRange",
      label: "회사 규모를 선택해주세요",
      options: [
        "1-50명 (스타트업)",
        "51-200명 (중소기업)",
        "201-1000명 (중견기업)",
        "1000명+ (대기업)",
        "전체",
      ],
      required: false,
    })
  }

  return questions
}

export async function understandQuery(
  state: LeadDiscoveryState,
): Promise<Partial<LeadDiscoveryState> | Command> {
  const startTime = Date.now()
  const emitter = state._emitter

  leadDiscoveryLogger.info(`[쿼리 이해] 시작 - 입력: "${state.userInput}"`)
  leadDiscoveryLogger.nodeStart("understandQuery", {
    userInput: state.userInput,
    hasExistingParams: !!state.bigQueryParams,
    hasClarificationAnswers: !!state.clarification?.answers,
  })

  if (emitter) {
    emitter.nodeStart("understandQuery", "검색 조건을 분석하고 있어요")
  }

  try {
    // If we already have clarification answers, apply them and proceed
    if (state.clarification?.answers && Object.keys(state.clarification.answers).length > 0) {
      leadDiscoveryLogger.info(`[쿼리 이해] 사용자 답변 적용 중`)

      const answers = state.clarification.answers
      const existingParams = state.bigQueryParams || { query: state.userInput }

      // Apply answers to params
      const updatedParams = {
        ...existingParams,
        country:
          answers.country && answers.country !== "전체 (All)"
            ? answers.country
            : existingParams.country,
        industry:
          answers.industry && answers.industry !== "기타 (Other)"
            ? answers.industry
            : existingParams.industry,
        employeeRange:
          answers.employeeRange && answers.employeeRange !== "전체"
            ? answers.employeeRange
            : existingParams.employeeRange,
      }

      const duration = Date.now() - startTime
      leadDiscoveryLogger.info(
        `[쿼리 이해] 답변 적용 완료 - 국가: ${updatedParams.country}, 산업: ${updatedParams.industry}`,
      )
      leadDiscoveryLogger.nodeSuccess("understandQuery", duration, { status: "answers_applied" })

      if (emitter) {
        emitter.nodeComplete("understandQuery", "검색 조건이 확정되었어요", {
          country: updatedParams.country,
          industry: updatedParams.industry,
        })
      }

      return {
        bigQueryParams: updatedParams,
        needsClarification: false,
        clarification: {
          ...state.clarification,
          needed: false,
        },
      }
    }

    // Analyze query confidence
    const existingParams = state.bigQueryParams
    const analysis = await analyzeQueryConfidence(state.userInput, {
      country: existingParams?.country,
      industry: existingParams?.industry,
      employeeRange: existingParams?.employeeRange,
    })

    leadDiscoveryLogger.info(`[쿼리 이해] 분석 결과:`)
    leadDiscoveryLogger.info(`  - 신뢰도: ${analysis.confidence}%`)
    leadDiscoveryLogger.info(`  - 이해된 국가: ${analysis.understood.country || "(없음)"}`)
    leadDiscoveryLogger.info(`  - 이해된 산업: ${analysis.understood.industry || "(없음)"}`)
    leadDiscoveryLogger.info(`  - 누락된 필드: ${analysis.missingFields.join(", ") || "(없음)"}`)
    leadDiscoveryLogger.info(`  - 분석 근거: ${analysis.reasoning}`)

    if (emitter) {
      emitter.progress("understandQuery", `검색 조건 신뢰도: ${analysis.confidence}%`, 50)
    }

    // If confidence is high enough, proceed without clarification
    if (analysis.confidence >= CONFIDENCE_THRESHOLD) {
      const duration = Date.now() - startTime
      leadDiscoveryLogger.info(`[쿼리 이해] 신뢰도 충분 (${analysis.confidence}%) - 검색 진행`)
      leadDiscoveryLogger.nodeSuccess("understandQuery", duration, { status: "high_confidence" })

      if (emitter) {
        emitter.nodeComplete("understandQuery", "검색 조건이 명확해요", {
          confidence: analysis.confidence,
          country: analysis.understood.country,
          industry: analysis.understood.industry,
        })
      }

      // Update bigQueryParams with understood values
      const updatedParams = {
        query: state.userInput,
        ...existingParams,
        country: analysis.understood.country || existingParams?.country,
        industry: analysis.understood.industry || existingParams?.industry,
        employeeRange: analysis.understood.employeeRange || existingParams?.employeeRange,
      }

      return {
        bigQueryParams: updatedParams,
        needsClarification: false,
      }
    }

    // Low confidence - need clarification
    leadDiscoveryLogger.info(`[쿼리 이해] 신뢰도 낮음 (${analysis.confidence}%) - 확인 질문 필요`)

    // Build clarification questions
    const questions = buildClarificationQuestions(analysis.missingFields)

    if (questions.length === 0) {
      // No questions to ask, proceed anyway
      leadDiscoveryLogger.info(`[쿼리 이해] 질문 없음 - 검색 진행`)
      return {
        needsClarification: false,
      }
    }

    // Create clarification state
    const clarificationState: ClarificationState = {
      needed: true,
      questions,
      answers: {},
      confidence: analysis.confidence,
      understood: analysis.understood,
    }

    // Send progress before interrupt
    if (emitter) {
      emitter.nodeComplete("understandQuery", "검색 조건을 더 명확히 해주세요", {
        requiresClarification: true,
        questionCount: questions.length,
      })
    }

    const duration = Date.now() - startTime
    leadDiscoveryLogger.nodeSuccess("understandQuery", duration, {
      status: "waiting_clarification",
      questionCount: questions.length,
    })

    // Interrupt for user clarification
    leadDiscoveryLogger.info(`[쿼리 이해] 사용자 확인 대기 중 - ${questions.length}개 질문`)

    interrupt({
      type: "clarification_required",
      message: "검색 조건을 더 명확히 해주세요",
      questions,
      understood: analysis.understood,
      confidence: analysis.confidence,
    })

    // This won't be reached due to interrupt, but TypeScript needs it
    return {
      clarification: clarificationState,
      needsClarification: true,
    }
  } catch (error) {
    // GraphInterrupt is normal interrupt behavior
    if (error instanceof GraphInterrupt) {
      leadDiscoveryLogger.info(`[쿼리 이해] Interrupt 발생 - 사용자 확인 대기`)
      throw error
    }

    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    // 구조화된 에러 컨텍스트 생성
    const errorContext = createErrorContext(error, "understandQuery", {
      sessionId: state.sessionId,
      retryCount: state.retryCount,
      details: {
        userInput: state.userInput,
        executionTimeMs: duration,
      },
    })

    leadDiscoveryLogger.error(`[쿼리 이해] 오류 발생: ${errorMessage}`)
    leadDiscoveryLogger.nodeError("understandQuery", errorMessage, duration)

    if (emitter) {
      emitter.error("understandQuery", `검색 조건 분석 중 문제가 발생했어요: ${errorMessage}`)
    }

    // On error, proceed without clarification to avoid blocking
    return {
      needsClarification: false,
      error: errorContext.message,
      errorContext,
    }
  }
}
