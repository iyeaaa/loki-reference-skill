/**
 * Onboarding Summary Service
 *
 * Generates LLM-powered summaries for onboarding phases:
 * - Phase 1 (Intelligence): Buyer persona analysis summary
 * - Phase 2 (Search): Buyer search results summary
 * - Phase 4 (Scoring): Scoring analysis summary
 * - Completion: Final campaign summary
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"
import { config } from "../config"
import logger from "../utils/logger"

// ============================================================================
// Types
// ============================================================================

export interface BuyerPersona {
  type: string
  typeKo?: string
  description?: string
}

// Phase summary types
export interface PhaseSummary {
  ko: string
  en: string
}

export interface IntelligenceSummaryInput {
  companyName: string
  companyDescription?: string
  buyerPersonas: BuyerPersona[]
  locale: "ko" | "en"
}

export interface SearchSummaryInput {
  companyName: string
  totalFound: number
  countryDistribution: Record<string, number>
  industryDistribution: Record<string, number>
  locale: "ko" | "en"
}

export interface ScoringSummaryInput {
  companyName: string
  scoredBuyers: Array<{ companyName: string; score: number; reason: string }>
  averageScore: number
  locale: "ko" | "en"
}

export interface BuyerSummary {
  companyName: string
  industry?: string
  country?: string
  score?: number
  size?: string
}

export interface EmailStepSummary {
  stepOrder: number
  delayDays: number
  emailSubject: string
}

export interface OnboardingSummaryInput {
  workspaceName: string
  companyDescription?: string
  buyerPersonas: BuyerPersona[]
  buyers: BuyerSummary[]
  emailSteps: EmailStepSummary[]
  searchMetadata?: {
    totalSearched?: number
    totalWithEmail?: number
  }
  locale: "ko" | "en"
}

export interface OnboardingSummary {
  ko: string
  en: string
}

// ============================================================================
// Service
// ============================================================================

class OnboardingSummaryService {
  private google: ReturnType<typeof createGoogleGenerativeAI>

  constructor(googleApiKey: string) {
    this.google = createGoogleGenerativeAI({
      apiKey: googleApiKey,
    })
  }

  /**
   * Generate completion summary using Gemini
   */
  async generateSummary(input: OnboardingSummaryInput): Promise<OnboardingSummary> {
    const startTime = Date.now()

    try {
      // Prepare context data
      const buyerCount = input.buyers.length
      const emailCount = buyerCount * input.emailSteps.length

      // Analyze buyer characteristics
      const countryDistribution = this.analyzeCountries(input.buyers)
      const industryDistribution = this.analyzeIndustries(input.buyers)
      const avgScore = this.calculateAverageScore(input.buyers)

      // Build persona summary
      const personaSummary = input.buyerPersonas.map((p) => p.typeKo || p.type).join(", ")

      // Build email steps summary
      const stepsSummary = input.emailSteps
        .map((s) => `Day ${s.delayDays}: ${s.emailSubject}`)
        .join("\n")

      const systemPrompt = `You are an expert B2B sales assistant helping Korean exporters.
Generate a warm, encouraging completion summary for an onboarding process.

The summary should include ALL of the following sections in this order:

1. **축하 인사** (2-3 sentences)
   - Warm congratulations
   - Brief mention of what was accomplished

2. **이메일 캠페인 안내**
   - Explain the 3-step email sequence purpose
   - Each step's timing and purpose
   - Mention that clicking each step allows editing

3. **바이어 분석**
   - How buyers were selected (personas used)
   - Geographic and industry distribution
   - Average fit score if available

4. **영업 팁** (2-3 actionable tips)
   - Based on the buyer profile, suggest approach
   - Timing recommendations
   - Key points to emphasize

IMPORTANT RULES:
- Output ONLY valid JSON: {"ko": "...", "en": "..."}
- Each language should be 250-400 words
- Use markdown formatting (headers with **, bullet points with -)
- Be encouraging and actionable
- Use emojis sparingly (1-2 per section max)
- Korean should feel natural, not translated
- DO NOT include any text before or after the JSON`

      const userPrompt = `Company: ${input.workspaceName}
Description: ${input.companyDescription || "N/A"}

Buyer Personas Used: ${personaSummary}

Selected Buyers: ${buyerCount}명
- Countries: ${countryDistribution}
- Industries: ${industryDistribution}
- Average Fit Score: ${avgScore}%

Email Sequence (${input.emailSteps.length} steps):
${stepsSummary}

Total Emails to Send: ${emailCount}

${input.searchMetadata ? `Search Stats: ${input.searchMetadata.totalSearched || 0} companies searched, ${input.searchMetadata.totalWithEmail || 0} with verified emails` : ""}

Generate the completion summary in both Korean and English.`

      const { text } = await generateText({
        model: this.google("gemini-3-flash-preview"),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      })

      // Parse JSON response
      const result = this.parseJsonResponse(text)

      const duration = Date.now() - startTime
      logger.info(
        { duration, buyerCount, emailCount },
        "[OnboardingSummary] Generated completion summary",
      )

      return result
    } catch (error) {
      logger.error({ error }, "[OnboardingSummary] Failed to generate summary")

      // Return fallback summary
      return this.generateFallbackSummary(input)
    }
  }

  /**
   * Parse JSON response from LLM
   */
  private parseJsonResponse(text: string): OnboardingSummary {
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim()
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/^```json\n?/, "").replace(/\n?```$/, "")
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```\n?/, "").replace(/\n?```$/, "")
      }

      const parsed = JSON.parse(cleanText)

      if (parsed.ko && parsed.en) {
        return {
          ko: parsed.ko,
          en: parsed.en,
        }
      }

      throw new Error("Invalid response structure")
    } catch (error) {
      logger.warn({ error, text }, "[OnboardingSummary] Failed to parse JSON, using fallback")
      throw error
    }
  }

  /**
   * Generate fallback summary when LLM fails
   */
  private generateFallbackSummary(input: OnboardingSummaryInput): OnboardingSummary {
    const buyerCount = input.buyers.length
    const emailCount = buyerCount * input.emailSteps.length

    return {
      ko: `✨ **발송 준비가 됐어요!**

**${buyerCount}명**의 바이어와 **${emailCount}개**의 이메일 초안이 준비됐어요.

**📧 이메일 캠페인 구성**
- 1단계 (바로 발송): 첫 인사 이메일
- 2단계 (1일 후): 첫 번째 팔로업
- 3단계 (2일 후): 마지막 팔로업

각 단계를 클릭하면 발송 전에 이메일을 수정할 수 있어요.

**🎯 바이어 정보**
${input.buyerPersonas
  .slice(0, 2)
  .map((p) => `- ${p.typeKo || p.type}`)
  .join("\n")}

**📌 다음 단계**
- 이메일 계정을 연동하면 바로 발송할 수 있어요
- 발송 전 이메일 내용을 검토해보세요`,

      en: `✨ **Ready to send!**

**${buyerCount}** buyers and **${emailCount}** email drafts are prepared.

**📧 Email Campaign Structure**
- Step 1 (Immediate): Introduction email
- Step 2 (Day 1): First follow-up
- Step 3 (Day 2): Final follow-up

Click each step to edit emails before sending.

**🎯 Buyer Profile**
${input.buyerPersonas
  .slice(0, 2)
  .map((p) => `- ${p.type}`)
  .join("\n")}

**📌 Next Steps**
- Connect your email account to start sending
- Review email content before sending`,
    }
  }

  /**
   * Analyze country distribution
   */
  private analyzeCountries(buyers: BuyerSummary[]): string {
    const countryCount: Record<string, number> = {}
    for (const buyer of buyers) {
      if (buyer.country) {
        countryCount[buyer.country] = (countryCount[buyer.country] || 0) + 1
      }
    }

    return (
      Object.entries(countryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([country, count]) => `${country} (${count})`)
        .join(", ") || "N/A"
    )
  }

  /**
   * Analyze industry distribution
   */
  private analyzeIndustries(buyers: BuyerSummary[]): string {
    const industryCount: Record<string, number> = {}
    for (const buyer of buyers) {
      if (buyer.industry) {
        industryCount[buyer.industry] = (industryCount[buyer.industry] || 0) + 1
      }
    }

    return (
      Object.entries(industryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([industry, count]) => `${industry} (${count})`)
        .join(", ") || "N/A"
    )
  }

  /**
   * Calculate average score
   */
  private calculateAverageScore(buyers: BuyerSummary[]): number {
    const scores = buyers.filter((b) => b.score !== undefined).map((b) => b.score as number)
    if (scores.length === 0) return 0
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }

  // ==========================================================================
  // Phase-specific Summary Generation
  // ==========================================================================

  /**
   * Phase 1: Generate buyer persona analysis summary
   * Called after intelligence phase completes
   */
  async generateIntelligenceSummary(input: IntelligenceSummaryInput): Promise<PhaseSummary> {
    const startTime = Date.now()

    try {
      const personaList = input.buyerPersonas
        .map((p) => `- ${p.typeKo || p.type}: ${p.description || ""}`)
        .join("\n")

      const systemPrompt = `You are a B2B export consultant helping Korean companies expand globally.
Generate a structured, insightful message about the buyer personas we identified.

CRITICAL REQUIREMENTS:
- Output ONLY valid JSON: {"ko": "...", "en": "..."}
- Korean: use 요/해요 ending, professional but warm
- English: professional tone
- MUST use markdown numbered list format (1. 2. 3.)
- NO emojis
- Each item should be 1 sentence

REQUIRED FORMAT (both ko and en):
1. **적합 바이어 유형**: [List the persona names]
2. **매칭 이유**: [Why these buyers fit]
3. **수출 전략 팁**: [One actionable insight]`

      const userPrompt = `Company: ${input.companyName}
${input.companyDescription ? `Product/Service: ${input.companyDescription}` : ""}

Identified ${input.buyerPersonas.length} ideal buyer personas:
${personaList}

Generate a numbered list summary with exactly 3 items:
1. List the specific buyer persona names found
2. Explain why these buyers would be interested
3. Give one export strategy tip for approaching them`

      const { text } = await generateText({
        model: this.google("gemini-3-flash-preview"),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      })

      const result = this.parseJsonResponse(text)

      logger.info(
        { duration: Date.now() - startTime, personaCount: input.buyerPersonas.length },
        "[OnboardingSummary] Generated intelligence summary",
      )

      return result
    } catch (error) {
      logger.warn({ error }, "[OnboardingSummary] Failed to generate intelligence summary")

      // Fallback with actual persona names
      const personaNames = input.buyerPersonas
        .slice(0, 3)
        .map((p) => p.typeKo || p.type)
        .join(", ")

      return {
        ko: `1. **적합 바이어 유형**: ${personaNames}\n2. **매칭 이유**: 귀사 제품/서비스에 대한 수요가 높은 바이어 유형이에요\n3. **수출 전략 팁**: 구체적인 성공 사례와 ROI 데이터를 준비하면 신뢰 구축에 효과적이에요`,
        en: `1. **Ideal Buyer Types**: ${personaNames}\n2. **Why They Match**: These buyers have high demand for your product/service\n3. **Export Tip**: Prepare concrete success stories and ROI data to build trust`,
      }
    }
  }

  /**
   * Phase 2: Generate search results summary
   * Called after search phase completes
   */
  async generateSearchSummary(input: SearchSummaryInput): Promise<PhaseSummary> {
    const startTime = Date.now()

    try {
      const countryList = Object.entries(input.countryDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([country, count]) => `${country}: ${count}개`)
        .join(", ")

      const industryList = Object.entries(input.industryDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([industry, count]) => `${industry}: ${count}개`)
        .join(", ")

      const topCountry = Object.entries(input.countryDistribution).sort((a, b) => b[1] - a[1])[0]

      const systemPrompt = `You are a B2B export consultant helping Korean companies expand globally.
Generate a structured, insightful message about the buyer search results.

CRITICAL REQUIREMENTS:
- Output ONLY valid JSON: {"ko": "...", "en": "..."}
- Korean: use 요/해요 ending, professional but warm
- English: professional tone
- MUST use markdown numbered list format (1. 2. 3.)
- NO emojis
- Each item should be 1 sentence

REQUIRED FORMAT (both ko and en):
1. **발굴 현황**: [Total count and top countries]
2. **주요 시장**: [Top market and why it's promising]
3. **시장 진입 팁**: [One actionable market entry insight]`

      const userPrompt = `Company: ${input.companyName}

Search Results:
- Total potential buyers found: ${input.totalFound}
- By Country: ${countryList}
- By Industry: ${industryList || "Mixed industries"}
- Top market: ${topCountry ? `${topCountry[0]} (${topCountry[1]} companies)` : "N/A"}

Generate a numbered list summary with exactly 3 items:
1. State the total number and breakdown by top countries
2. Highlight the most promising market and why
3. Give one market entry tip (trade shows, business culture, regulations, etc.)`

      const { text } = await generateText({
        model: this.google("gemini-3-flash-preview"),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      })

      const result = this.parseJsonResponse(text)

      logger.info(
        { duration: Date.now() - startTime, totalFound: input.totalFound },
        "[OnboardingSummary] Generated search summary",
      )

      return result
    } catch (error) {
      logger.warn({ error }, "[OnboardingSummary] Failed to generate search summary")

      // Fallback with specific data
      const topCountry = Object.entries(input.countryDistribution).sort((a, b) => b[1] - a[1])[0]
      const countryDetails = Object.entries(input.countryDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([country, count]) => `${country} ${count}개`)
        .join(", ")

      return {
        ko: `1. **발굴 현황**: 총 ${input.totalFound}개 바이어 발굴 (${countryDetails})\n2. **주요 시장**: ${topCountry ? `${topCountry[0]} 시장이 가장 많은 기회를 보여줘요` : "다양한 시장에서 기회가 있어요"}\n3. **시장 진입 팁**: 현지 무역박람회 참가나 현지 파트너 발굴이 효과적이에요`,
        en: `1. **Discovery Status**: Found ${input.totalFound} buyers (${countryDetails})\n2. **Top Market**: ${topCountry ? `${topCountry[0]} shows the most opportunity` : "Opportunities across multiple markets"}\n3. **Market Entry Tip**: Consider trade show participation or local partner development`,
      }
    }
  }

  /**
   * Phase 4: Generate scoring analysis summary
   * Called after scoring phase completes
   */
  async generateScoringSummary(input: ScoringSummaryInput): Promise<PhaseSummary> {
    const startTime = Date.now()

    try {
      const topBuyers = input.scoredBuyers
        .slice(0, 5)
        .map((b) => `- ${b.companyName} (${b.score}점): ${b.reason}`)
        .join("\n")

      // Analyze common patterns in top buyers
      const topReasons = input.scoredBuyers
        .slice(0, 10)
        .map((b) => b.reason)
        .join(" | ")

      const systemPrompt = `You are a B2B export consultant helping Korean companies expand globally.
Generate a structured, insightful message about the buyer scoring and ranking results.

CRITICAL REQUIREMENTS:
- Output ONLY valid JSON: {"ko": "...", "en": "..."}
- Korean: use 요/해요 ending, professional but warm
- English: professional tone
- MUST use markdown numbered list format (1. 2. 3.)
- NO emojis
- Each item should be 1 sentence

REQUIRED FORMAT (both ko and en):
1. **적합도 분석**: [Average score and what it means]
2. **상위 바이어 특징**: [Common pattern among top buyers]
3. **영업 접근 팁**: [One specific outreach recommendation]`

      const userPrompt = `Company: ${input.companyName}

Scoring Results:
- Total buyers evaluated: ${input.scoredBuyers.length}
- Average fit score: ${input.averageScore}% (100% = perfect match)
- Top scoring buyers and reasons:
${topBuyers}

Common themes in top buyer reasons: ${topReasons}

Generate a numbered list summary with exactly 3 items:
1. Explain what ${input.averageScore}% average score means for export potential
2. Identify the common pattern among top-scoring buyers
3. Give one specific outreach tip for approaching these buyers`

      const { text } = await generateText({
        model: this.google("gemini-3-flash-preview"),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      })

      const result = this.parseJsonResponse(text)

      logger.info(
        { duration: Date.now() - startTime, buyerCount: input.scoredBuyers.length },
        "[OnboardingSummary] Generated scoring summary",
      )

      return result
    } catch (error) {
      logger.warn({ error }, "[OnboardingSummary] Failed to generate scoring summary")

      // Fallback with specific insights
      const scoreInterpretation =
        input.averageScore >= 70
          ? "매우 높은 수출 가능성을 보여줘요"
          : input.averageScore >= 50
            ? "양호한 수출 가능성을 보여줘요"
            : "적당한 수출 가능성을 보여줘요"
      const scoreInterpretationEn =
        input.averageScore >= 70
          ? "indicates excellent export potential"
          : input.averageScore >= 50
            ? "indicates good export potential"
            : "indicates moderate export potential"

      return {
        ko: `1. **적합도 분석**: 평균 ${input.averageScore}% - ${scoreInterpretation}\n2. **상위 바이어 특징**: 귀사 제품/서비스에 대한 실질적 수요가 있는 기업들이에요\n3. **영업 접근 팁**: 첫 이메일에서 구체적인 협력 가치를 제안하면 응답률이 높아져요`,
        en: `1. **Fit Analysis**: ${input.averageScore}% average - ${scoreInterpretationEn}\n2. **Top Buyer Profile**: Companies with genuine demand for your offerings\n3. **Outreach Tip**: Lead with specific partnership value in your first email`,
      }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: OnboardingSummaryService | null = null

export function getOnboardingSummaryService(): OnboardingSummaryService {
  if (!instance) {
    const googleApiKey = config.gemini.apiKey
    if (!googleApiKey) {
      throw new Error("GEMINI_API_KEY is not configured")
    }
    instance = new OnboardingSummaryService(googleApiKey)
  }
  return instance
}

/**
 * Generate onboarding completion summary
 * Convenience function for direct usage
 */
export async function generateOnboardingSummary(
  input: OnboardingSummaryInput,
): Promise<OnboardingSummary> {
  const service = getOnboardingSummaryService()
  return service.generateSummary(input)
}

/**
 * Generate Phase 1 (Intelligence) summary
 * Called after buyer persona analysis completes
 */
export async function generateIntelligenceSummary(
  input: IntelligenceSummaryInput,
): Promise<PhaseSummary> {
  const service = getOnboardingSummaryService()
  return service.generateIntelligenceSummary(input)
}

/**
 * Generate Phase 2 (Search) summary
 * Called after buyer search completes
 */
export async function generateSearchSummary(input: SearchSummaryInput): Promise<PhaseSummary> {
  const service = getOnboardingSummaryService()
  return service.generateSearchSummary(input)
}

/**
 * Generate Phase 4 (Scoring) summary
 * Called after buyer scoring completes
 */
export async function generateScoringSummary(input: ScoringSummaryInput): Promise<PhaseSummary> {
  const service = getOnboardingSummaryService()
  return service.generateScoringSummary(input)
}
