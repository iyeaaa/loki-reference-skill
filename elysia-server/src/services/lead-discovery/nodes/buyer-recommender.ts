/**
 * Buyer Recommender Node
 * Generates 3 buyer country/industry recommendations based on website analysis
 */

import { type Command, GraphInterrupt, interrupt } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"
import { v4 as uuidv4 } from "uuid"
import { leadDiscoveryLogger } from "../logger"
import type { BuyerRecommendation, LeadDiscoveryState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.5, // Some creativity for diverse recommendations
})

// Available industries in BigQuery
const AVAILABLE_INDUSTRIES = [
  "Business Services",
  "Manufacturing",
  "Retail",
  "Financial Services",
  "Healthcare",
  "Real Estate & Construction",
  "Computers & Electronics",
  "Software & Internet",
  "Education",
  "Media & Entertainment",
  "Consumer Services",
  "Travel, Recreation, and Leisure",
  "Telecommunications",
  "Non-Profit",
  "Transportation & Storage",
  "Other",
  "Energy & Utilities",
  "Wholesale & Distribution",
  "Government",
  "Agriculture & Mining",
  "Retail & Wholesale",
  "Services (Miscellaneous)",
  "Food & Beverage",
  "Travel & Accommodation",
  "Recreation & Leisure",
  "Conglomerates",
]

// Available countries
const AVAILABLE_COUNTRIES = ["USA", "Canada"]

// Generate buyer recommendations based on website analysis
async function generateRecommendations(
  analysis: {
    companyName?: string
    description?: string
    industry?: string
    products?: string[]
    targetMarkets?: string[]
    businessModel?: string
    strengths?: string[]
  },
  userInput: string,
): Promise<BuyerRecommendation[]> {
  const prompt = `Based on the following company analysis, recommend 3 potential buyer segments that would be interested in this company's products/services.

## Company Information:
- Name: ${analysis.companyName || "Unknown"}
- Description: ${analysis.description || "N/A"}
- Industry: ${analysis.industry || "N/A"}
- Products/Services: ${analysis.products?.join(", ") || "N/A"}
- Target Markets: ${analysis.targetMarkets?.join(", ") || "N/A"}
- Business Model: ${analysis.businessModel || "N/A"}
- Strengths: ${analysis.strengths?.join(", ") || "N/A"}

## User's Original Query:
"${userInput}"

## Available Options:
Countries: ${AVAILABLE_COUNTRIES.join(", ")}
Industries: ${AVAILABLE_INDUSTRIES.join(", ")}

## Task:
Generate exactly 3 diverse buyer recommendations. Each should target different market segments.

## Response Format (JSON array):
[
  {
    "country": "USA or Canada",
    "industry": "One of the available industries",
    "subIndustry": "Specific sub-industry if applicable (optional)",
    "reasoning": "Why this segment would be interested (2-3 sentences in Korean)",
    "estimatedLeadCount": "Estimated number of potential leads (rough number)",
    "keywords": ["relevant", "search", "keywords"]
  }
]

Rules:
- Provide exactly 3 recommendations
- Each recommendation should target a different industry or market angle
- Use only available countries and industries
- Write reasoning in Korean
- Be specific about why each segment would be interested
- Respond with JSON array only, no markdown

JSON:`

  const response = await llm.invoke(prompt)
  const responseText = (response.content as string).trim()

  // Parse JSON array from response
  const jsonMatch = responseText.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0])

    return parsed.map(
      (rec: {
        country: string
        industry: string
        subIndustry?: string
        reasoning: string
        estimatedLeadCount?: number
        keywords?: string[]
      }) => ({
        id: uuidv4(),
        country: rec.country,
        industry: rec.industry,
        subIndustry: rec.subIndustry,
        reasoning: rec.reasoning,
        estimatedLeadCount: rec.estimatedLeadCount,
        keywords: rec.keywords,
      }),
    )
  }

  // Fallback recommendations if parsing fails
  return [
    {
      id: uuidv4(),
      country: "USA",
      industry: "Business Services",
      reasoning: "일반적인 비즈니스 서비스 산업은 다양한 제품과 서비스에 관심을 가질 수 있습니다.",
      estimatedLeadCount: 500,
    },
    {
      id: uuidv4(),
      country: "USA",
      industry: "Software & Internet",
      reasoning: "소프트웨어 및 인터넷 기업들은 혁신적인 솔루션을 찾는 경향이 있습니다.",
      estimatedLeadCount: 300,
    },
    {
      id: uuidv4(),
      country: "Canada",
      industry: "Manufacturing",
      reasoning: "캐나다 제조업체들은 새로운 공급업체와 파트너십을 모색하고 있습니다.",
      estimatedLeadCount: 200,
    },
  ]
}

export async function recommendBuyers(
  state: LeadDiscoveryState,
): Promise<Partial<LeadDiscoveryState> | Command> {
  const startTime = Date.now()
  const emitter = state._emitter

  // 상세 로그: 바이어 추천 시작
  const companyName = state.websiteAnalysis?.companyName || "알 수 없는 회사"
  leadDiscoveryLogger.info(`[바이어 추천] 시작 - 회사: ${companyName}`)
  leadDiscoveryLogger.nodeStart("recommendBuyers", {
    hasAnalysis: !!state.websiteAnalysis,
    companyName: state.websiteAnalysis?.companyName,
  })

  if (emitter) {
    emitter.nodeStart("recommendBuyers", `${companyName}에 맞는 바이어를 찾고 있어요`)
  }

  try {
    // 이미 선택된 추천이 있는 경우 (interrupt에서 재개)
    if (state.selectedRecommendation) {
      leadDiscoveryLogger.info(
        `[바이어 추천] 이미 선택됨 - ${state.selectedRecommendation.country} / ${state.selectedRecommendation.industry}`,
      )
      const duration = Date.now() - startTime
      leadDiscoveryLogger.nodeSuccess("recommendBuyers", duration, {
        status: "resumed_with_selection",
      })
      return {} // 다음 노드로 진행
    }

    // 웹사이트 분석 기반 추천 생성
    leadDiscoveryLogger.info(`[바이어 추천] AI로 추천 바이어 생성 중`)
    if (emitter) {
      emitter.progress("recommendBuyers", "우리 제품에 관심 있을 바이어를 분석하고 있어요", 40)
    }

    const analysis = state.websiteAnalysis || {}
    const recommendations = await generateRecommendations(analysis, state.userInput)

    // 추천 결과 상세 로그
    leadDiscoveryLogger.info(`[바이어 추천] ${recommendations.length}개 바이어 타겟 생성 완료:`)
    recommendations.forEach((r, idx) => {
      leadDiscoveryLogger.info(`  ${idx + 1}. ${r.country} / ${r.industry}`)
      leadDiscoveryLogger.info(`     - 추천 이유: ${r.reasoning}`)
      leadDiscoveryLogger.info(`     - 예상 리드 수: ${r.estimatedLeadCount || "미정"}`)
    })

    leadDiscoveryLogger.recommendationsGenerated(
      recommendations.length,
      recommendations.map((r) => ({ country: r.country, industry: r.industry })),
    )

    if (emitter) {
      emitter.progress(
        "recommendBuyers",
        `${recommendations.length}개 바이어 타겟을 찾았어요`,
        80,
        {
          count: recommendations.length,
        },
      )
    }

    // Human-in-the-Loop 선택을 위한 interrupt
    leadDiscoveryLogger.info(`[바이어 추천] 사용자 선택 대기 중`)
    leadDiscoveryLogger.waitingForUserSelection(
      recommendations.map((r) => `${r.country} / ${r.industry}`),
    )

    // interrupt 전 state에 추천 저장
    const stateUpdate: Partial<LeadDiscoveryState> = {
      buyerRecommendations: recommendations,
      needsUserSelection: true,
    }

    // 클라이언트에 추천 목록 전송 (토스 스타일)
    if (emitter) {
      emitter.nodeComplete("recommendBuyers", "원하시는 바이어 타겟을 선택해주세요", {
        recommendations: recommendations.map((r) => ({
          id: r.id,
          country: r.country,
          industry: r.industry,
          subIndustry: r.subIndustry,
          reasoning: r.reasoning,
          estimatedLeadCount: r.estimatedLeadCount,
        })),
        requiresSelection: true,
      })
    }

    const duration = Date.now() - startTime
    leadDiscoveryLogger.nodeSuccess("recommendBuyers", duration, {
      recommendationCount: recommendations.length,
      status: "waiting_selection",
    })

    // Interrupt: 사용자 선택 대기
    // interrupt 호출 후 그래프 실행이 중단됨
    // resume 시 state.selectedRecommendation이 Command.update로 설정되어
    // 함수 시작 부분의 if (state.selectedRecommendation) 에서 처리됨
    interrupt({
      type: "buyer_selection_required",
      message: "원하시는 바이어 타겟을 선택해주세요",
      recommendations: recommendations.map((r) => ({
        id: r.id,
        country: r.country,
        industry: r.industry,
        subIndustry: r.subIndustry,
        reasoning: r.reasoning,
        estimatedLeadCount: r.estimatedLeadCount,
      })),
    })

    // interrupt 이후에는 실행되지 않음 (resume 시 함수가 처음부터 다시 실행됨)
    // 하지만 TypeScript를 위해 return 필요
    return stateUpdate
  } catch (error) {
    // GraphInterrupt는 정상적인 interrupt 동작이므로 다시 던짐
    if (error instanceof GraphInterrupt) {
      leadDiscoveryLogger.info(`[바이어 추천] Interrupt 발생 - 사용자 선택 대기`)
      throw error
    }

    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    leadDiscoveryLogger.error(`[바이어 추천] 오류 발생: ${errorMessage}`)
    leadDiscoveryLogger.nodeError("recommendBuyers", errorMessage, duration)

    if (emitter) {
      emitter.error("recommendBuyers", `바이어 추천 중 문제가 발생했어요: ${errorMessage}`)
    }

    return {
      error: `바이어 추천에 실패했어요: ${errorMessage}`,
    }
  }
}
