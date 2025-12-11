/**
 * Fit Score Calculator
 * AI 기반 리드 적합도 계산 서비스
 */

import { ChatOpenAI } from "@langchain/openai"
import { leadDiscoveryLogger } from "./logger"

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
})

export interface LeadForScoring {
  id: string
  company_name?: string
  email?: string
  phone?: string
  web_address?: string
  country?: string
  industry?: string
  sub_industry?: string
  employee?: string
  revenue?: string
  title?: string
}

export interface WebsiteAnalysisContext {
  companyName?: string
  description?: string
  industry?: string
  products?: string[]
  targetMarkets?: string[]
  businessModel?: string
}

export interface FitScoreResult {
  leadId: string
  score: number
  reason?: string
}

/**
 * 배치로 리드 적합도 계산 (10개씩)
 */
export async function calculateFitScores(
  leads: LeadForScoring[],
  websiteAnalysis: WebsiteAnalysisContext,
  selectedTarget: { country: string; industry: string },
  onScore: (result: FitScoreResult) => void,
  userQuery?: string, // 사용자 검색 쿼리 추가
): Promise<void> {
  const BATCH_SIZE = 10

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE)

    try {
      const scores = await calculateBatchScores(batch, websiteAnalysis, selectedTarget, userQuery)

      for (const score of scores) {
        onScore(score)
      }
    } catch (error) {
      leadDiscoveryLogger.error(`Fit score calculation error for batch ${i}: ${error}`)
      // 에러 시 해당 배치는 50점으로 기본값 설정
      for (const lead of batch) {
        onScore({
          leadId: lead.id,
          score: 50,
          reason: "계산 중 오류 발생",
        })
      }
    }
  }
}

/**
 * 배치 적합도 계산
 */
async function calculateBatchScores(
  leads: LeadForScoring[],
  websiteAnalysis: WebsiteAnalysisContext,
  selectedTarget: { country: string; industry: string },
  userQuery?: string,
): Promise<FitScoreResult[]> {
  const leadsInfo = leads
    .map(
      (lead, idx) =>
        `${idx + 1}. ID: ${lead.id}
   - Company: ${lead.company_name || "N/A"}
   - Industry: ${lead.industry || "N/A"} / ${lead.sub_industry || "N/A"}
   - Country: ${lead.country || "N/A"}
   - Title: ${lead.title || "N/A"}
   - Employees: ${lead.employee || "N/A"}
   - Has Email: ${lead.email ? "Yes" : "No"}
   - Has Phone: ${lead.phone ? "Yes" : "No"}
   - Has Website: ${lead.web_address ? "Yes" : "No"}`,
    )
    .join("\n\n")

  // userQuery가 있으면 검색 쿼리 기반 평가, 없으면 판매자 정보 기반 평가
  const searchCriteria = userQuery
    ? `## User Search Query (MOST IMPORTANT):
"${userQuery}"

Evaluate each lead based on how well they match this search query.`
    : `## Seller Company (Our Client):
- Company Name: ${websiteAnalysis.companyName || "Unknown"}
- Description: ${websiteAnalysis.description || "N/A"}
- Industry: ${websiteAnalysis.industry || "N/A"}
- Products/Services: ${websiteAnalysis.products?.join(", ") || "N/A"}
- Target Markets: ${websiteAnalysis.targetMarkets?.join(", ") || "N/A"}
- Business Model: ${websiteAnalysis.businessModel || "N/A"}`

  const prompt = `You are evaluating potential buyer leads.

${searchCriteria}

## Selected Target Criteria:
- Target Country: ${selectedTarget.country}
- Target Industry: ${selectedTarget.industry}

## Leads to Evaluate:
${leadsInfo}

## Task:
For each lead, calculate a FIT SCORE (0-100) based on:
1. Match with search query/seller needs (40 points max) - MOST IMPORTANT
2. Country match with target (25 points max)
3. Industry relevance (25 points max)
4. Company data completeness - email, phone, website (10 points max)

${userQuery ? `IMPORTANT: Score high (80+) if the lead's industry/company closely matches "${userQuery}". Score low (below 50) if unrelated.` : ""}

## Response Format (JSON array only, no markdown):
[
  {"leadId": "id1", "score": 85},
  {"leadId": "id2", "score": 62}
]

Important: Return ONLY the JSON array, no explanation or markdown.`

  const response = await llm.invoke(prompt)
  const responseText = (response.content as string).trim()

  try {
    // JSON 파싱 시도
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ leadId: string; score: number }>
      return parsed.map((item) => ({
        leadId: item.leadId,
        score: Math.min(100, Math.max(0, item.score)),
      }))
    }
  } catch (parseError) {
    leadDiscoveryLogger.error(`Failed to parse fit scores: ${parseError}`)
  }

  // 파싱 실패 시 기본값 반환
  return leads.map((lead) => ({
    leadId: lead.id,
    score: 50,
    reason: "계산 중 오류",
  }))
}
