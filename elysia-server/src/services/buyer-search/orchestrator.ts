/**
 * Buyer Search Orchestrator - 메인 오케스트레이터
 *
 * 전체 바이어 서치 프로세스를 관리
 * 1. Discovery: 모든 Provider를 **병렬로 동시 실행**하여 회사 검색
 * 2. Merge: 결과 병합 및 중복 제거
 * 3. Enrichment: 담당자 정보 수집 (병렬)
 * 4. Fill: 부족분 추가 검색 (최대 3회)
 *
 * 핵심 철학:
 * - **모든 Provider를 병렬로 동시에 실행**
 * - 결과를 합쳐서 최선의 30개 도출
 * - 공격적 병렬화 (Rate Limit까지 사용)
 * - Exponential Backoff 재시도
 * - Redis 캐싱 (24시간)
 */

import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { config } from "../../config"
import { VALID_HUNTERIO_INDUSTRIES } from "../../constants/hunterio-industries"
import logger from "../../utils/logger"
import { createProgressTracker, type ProgressTracker } from "./progress-tracker"
import { type AIGeneratedBuyerQuery, buildBuyerQueryPrompt, buildCountryISOPrompt } from "./prompts"
import {
  type CompanyFinderProvider,
  type ContactEnricherProvider,
  type ContactSearchResult,
  createHunterCompanyFinder,
  createHunterContactEnricher,
  type ProviderResult,
} from "./providers"
import type {
  BuyerSearchOptions,
  BuyerSearchResult,
  Company,
  CompanySearchParams,
  ContactSelectionCriteria,
  OrchestratorResult,
  ProgressCallback,
  SearchError,
} from "./types"

// ==================== DEFAULT CONFIGURATION ====================

/**
 * 기본 검색 옵션
 */
const DEFAULT_OPTIONS: BuyerSearchOptions = {
  targetCount: 30,
  maxRetries: 3,
  minContactConfidence: 70,
  concurrency: 20,
  timeoutMs: 60000,
}

/**
 * 기본 담당자 선택 기준
 */
const DEFAULT_CONTACT_CRITERIA: ContactSelectionCriteria = {
  minConfidence: 70,
  preferredTypes: ["personal", "generic"],
  preferredSeniorities: ["executive", "senior", "junior"],
}

/**
 * Fill 시도 최대 횟수
 */
const MAX_FILL_ATTEMPTS = 3

/**
 * Provider당 검색할 리드 수 계산
 * 목표 30개, Provider 2개면 각 20개씩 (여유분 포함)
 */
function calculatePerProviderLimit(targetCount: number, providerCount: number): number {
  if (providerCount <= 1) {
    return Math.min(100, Math.ceil(targetCount * 1.5))
  }
  // 각 Provider가 목표의 약 70%씩 검색 (중복/실패 대비)
  return Math.min(100, Math.ceil((targetCount * 0.7) / 1) + 5)
}

// ==================== AI 기반 국가 코드 변환 ====================

// ISO 코드 캐시 (동일 세션 내 재사용)
const isoCodeCache = new Map<string, string>()

/**
 * AI를 사용하여 국가명을 ISO 3166-1 alpha-2 코드로 변환
 * GPT-5-mini (reasoning effort: minimal) 사용
 *
 * @param country - 국가명 (한국어/영어/약어 등)
 * @returns ISO 3166-1 alpha-2 코드 (예: US, JP, KR)
 */
async function toISOCountryCode(country: string): Promise<string> {
  // 이미 ISO 코드인 경우 (2글자 대문자)
  if (/^[A-Z]{2}$/.test(country)) {
    return country
  }

  // 캐시 확인
  const cached = isoCodeCache.get(country.toLowerCase())
  if (cached) {
    return cached
  }

  try {
    const openai = createOpenAI({
      apiKey: config.openai.apiKey,
    })

    const { text } = await generateText({
      model: openai("gpt-5-mini"),
      prompt: buildCountryISOPrompt(country),
      temperature: 0,
    })

    const isoCode = text.trim().toUpperCase()

    // 유효성 검사 (2글자 대문자인지)
    if (/^[A-Z]{2}$/.test(isoCode)) {
      isoCodeCache.set(country.toLowerCase(), isoCode)
      console.log(`[toISOCountryCode] 🌍 "${country}" → "${isoCode}" (AI)`)
      return isoCode
    }

    // 유효하지 않으면 원본 반환
    console.warn(`[toISOCountryCode] Invalid AI response: "${text}", using original`)
    return country
  } catch (error) {
    console.error(`[toISOCountryCode] AI failed for "${country}":`, error)
    return country
  }
}

// ==================== AI 기반 Industry 검증 ====================

/**
 * AI가 생성한 industry가 Hunter.io 유효 목록에 있는지 검증
 * 유효하지 않은 경우 가장 유사한 것을 찾아 반환
 */
function validateHunterIndustries(industries: string[]): string[] {
  const validated: string[] = []

  for (const ind of industries) {
    // 정확히 일치하는 경우
    if (VALID_HUNTERIO_INDUSTRIES.includes(ind as (typeof VALID_HUNTERIO_INDUSTRIES)[number])) {
      validated.push(ind)
      continue
    }

    // 대소문자 무시 매치
    const lowerInd = ind.toLowerCase()
    const matched = VALID_HUNTERIO_INDUSTRIES.find(
      (valid) => valid.toLowerCase() === lowerInd || valid.toLowerCase().includes(lowerInd),
    )
    if (matched) {
      validated.push(matched)
    }
  }

  return validated
}

// ==================== AI 기반 쿼리 생성 (GPT-5.2) ====================

/**
 * GPT-5.2를 사용하여 회사 설명을 기반으로 **잠재 고객** 검색 쿼리 생성
 *
 * 핵심 변경: 입력된 industry(내 회사)가 아닌, 잠재 고객의 industry를 AI가 생성
 *
 * @param description - 회사 설명 (한국어/영어)
 * @param targetType - 타겟 유형 (B2B/B2C)
 * @param myIndustry - 내 회사의 산업 (잠재 고객의 산업과 다름!)
 * @param countryISO - 국가 ISO 코드
 * @returns 검색 키워드, 잠재 고객 industry, 메타데이터
 */
async function generateBuyerQueryWithAI(
  description: string,
  targetType?: string,
  myIndustry?: string,
  countryISO?: string,
): Promise<AIGeneratedBuyerQuery> {
  const startTime = Date.now()

  try {
    const openai = createOpenAI({
      apiKey: config.openai.apiKey,
    })

    // 새로운 프롬프트 사용 (prompts.ts에서 가져옴)
    const prompt = buildBuyerQueryPrompt({
      description,
      targetType,
      myIndustry,
      countryISO,
    })

    const { text } = await generateText({
      model: openai("gpt-5.2"),
      prompt,
      temperature: 0.2,
    })

    // JSON 파싱
    let jsonText = text.trim()

    // 백틱 제거
    if (jsonText.startsWith("```")) {
      const startIdx = jsonText.indexOf("{")
      const endIdx = jsonText.lastIndexOf("}")
      if (startIdx !== -1 && endIdx !== -1) {
        jsonText = jsonText.substring(startIdx, endIdx + 1)
      }
    }

    const result = JSON.parse(jsonText) as AIGeneratedBuyerQuery

    // Hunter.io industry 검증 (유효한 것만 필터)
    const validatedIndustries = validateHunterIndustries(result.hunterIndustries || [])

    // 검증 및 기본값 설정
    const validatedResult: AIGeneratedBuyerQuery = {
      keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 10) : [],
      hunterIndustries: validatedIndustries.slice(0, 3), // 🆕 잠재 고객의 industry
      buyerTypes: Array.isArray(result.buyerTypes) ? result.buyerTypes.slice(0, 5) : [],
      excludeKeywords: Array.isArray(result.excludeKeywords)
        ? result.excludeKeywords.slice(0, 5)
        : [],
      industryHint: result.industryHint || "Unknown",
    }

    const elapsed = Date.now() - startTime
    console.log(
      `[BuyerSearchOrchestrator] 🤖 AI generated buyer query (GPT-5.2, ${elapsed}ms):\n` +
        `  Description: "${description.slice(0, 60)}..."\n` +
        `  Keywords: [${validatedResult.keywords.join(", ")}]\n` +
        `  🆕 Buyer Industries: [${validatedResult.hunterIndustries.join(", ")}]\n` +
        `  Buyer Types: [${validatedResult.buyerTypes.join(", ")}]\n` +
        `  Exclude: [${validatedResult.excludeKeywords.join(", ")}]\n` +
        `  Industry Hint: ${validatedResult.industryHint}`,
    )

    return validatedResult
  } catch (error) {
    console.error("[BuyerSearchOrchestrator] AI query generation failed:", error)

    // Fallback: 기본 키워드 (industry는 내 회사 산업이므로 무시)
    const fallbackKeywords = ["retailers", "distributors", "wholesalers", "importers"]

    console.log(
      `[BuyerSearchOrchestrator] Using fallback keywords: [${fallbackKeywords.join(", ")}]`,
    )

    return {
      keywords: fallbackKeywords,
      hunterIndustries: [], // AI 실패 시 industry 필터 없이 검색
      buyerTypes: ["retailers", "distributors"],
      excludeKeywords: [],
      industryHint: "General",
    }
  }
}

// ==================== RERANKING LOGIC ====================

/**
 * 이메일이 generic (support@, info@ 등)인지 확인
 */
function isGenericEmail(email: string): boolean {
  const genericPrefixes = [
    "info@",
    "support@",
    "contact@",
    "hello@",
    "help@",
    "admin@",
    "sales@",
    "marketing@",
    "team@",
    "office@",
    "general@",
    "feedback@",
    "enquiries@",
    "inquiries@",
    "customerservice@",
    "service@",
  ]
  const lowerEmail = email.toLowerCase()
  return genericPrefixes.some((prefix) => lowerEmail.startsWith(prefix))
}

/**
 * 관련없는 조직 유형인지 확인 (NPO, 정부기관 등)
 */
function isIrrelevantOrgType(companyName: string, domain: string): boolean {
  const irrelevantPatterns = [
    // NPO / 비영리
    /\b(foundation|association|society|institute|council|committee|federation|union|charity)\b/i,
    // 정부기관
    /\b(government|ministry|department|agency|bureau|administration)\b/i,
    // 학술/교육
    /\b(university|college|school|academy|research)\b/i,
    // 종교단체
    /\b(church|temple|mosque|synagogue|religious)\b/i,
    // 의료
    /\b(hospital|clinic|medical center|healthcare)\b/i,
  ]

  const combined = `${companyName} ${domain}`.toLowerCase()
  return irrelevantPatterns.some((pattern) => pattern.test(combined))
}

/**
 * AI 키워드와 회사명/도메인의 관련성 점수 계산
 */
function calculateRelevanceScore(
  companyName: string,
  domain: string,
  aiKeywords: string[],
): number {
  if (aiKeywords.length === 0) return 0

  const combined = `${companyName} ${domain}`.toLowerCase()
  let matchCount = 0

  for (const keyword of aiKeywords) {
    const lowerKeyword = keyword.toLowerCase()
    // 전체 키워드 매치
    if (combined.includes(lowerKeyword)) {
      matchCount += 2
    }
    // 부분 매치 (키워드가 2단어 이상인 경우)
    else {
      const keywordParts = lowerKeyword.split(/\s+/)
      for (const part of keywordParts) {
        if (part.length >= 3 && combined.includes(part)) {
          matchCount += 1
          break
        }
      }
    }
  }

  // 최대 30점
  return Math.min(30, matchCount * 5)
}

/**
 * Reranking 점수 계산 (0-100)
 *
 * 점수 구성:
 * - 🆕 관련성 점수: 최대 +30점 (AI 키워드 매치)
 * - 담당자 존재: +20점
 * - 담당자 신뢰도: 최대 +15점 (confidence 비례)
 * - 담당자 유형: personal +10점, generic -5점 (페널티!)
 * - 담당자 직급: executive +10점, senior +5점
 * - 회사 정보 완성도: 최대 +10점
 * - 🆕 관련없는 조직 페널티: -30점
 * - 🆕 Generic 이메일 페널티: -10점
 */
function calculateRankScore(
  result: {
    contact: {
      type: string
      confidence: number
      seniority?: string | null
      email?: string | null
    } | null
    company: {
      name: string
      domain: string
      description?: string | null
      industry?: string | null
      headcount?: string | null
    }
  },
  aiKeywords: string[] = [],
): number {
  let score = 0

  // 🆕 관련성 점수 (AI 키워드 매치)
  const relevanceScore = calculateRelevanceScore(
    result.company.name,
    result.company.domain,
    aiKeywords,
  )
  score += relevanceScore

  // 🆕 관련없는 조직 유형 페널티
  if (isIrrelevantOrgType(result.company.name, result.company.domain)) {
    score -= 30
    console.log(
      `[Reranking] ⚠️ Irrelevant org type detected: "${result.company.name}" - penalty -30`,
    )
  }

  // 담당자 점수
  if (result.contact) {
    score += 20 // 담당자 존재

    // 신뢰도 (0-15점)
    score += Math.round((result.contact.confidence / 100) * 15)

    // 유형 (개인 이메일 보너스, generic 페널티)
    if (result.contact.type === "personal") {
      score += 10
    } else if (result.contact.type === "generic") {
      score -= 5 // 페널티!
    }

    // 🆕 Generic 이메일 패턴 페널티
    if (result.contact.email && isGenericEmail(result.contact.email)) {
      score -= 10
      console.log(`[Reranking] ⚠️ Generic email detected: "${result.contact.email}" - penalty -10`)
    }

    // 직급
    if (result.contact.seniority === "executive") {
      score += 10
    } else if (result.contact.seniority === "senior") {
      score += 5
    }
  }

  // 회사 정보 완성도 (각 2.5점, 최대 10점)
  if (result.company.description) score += 2.5
  if (result.company.industry) score += 2.5
  if (result.company.headcount) score += 2.5
  if (result.company.description && result.company.description.length > 100) score += 2.5

  // 최소 0점, 최대 100점
  return Math.max(0, Math.min(100, Math.round(score)))
}

// ==================== ORCHESTRATOR CLASS ====================

/**
 * Buyer Search Orchestrator 옵션
 */
export interface OrchestratorOptions extends Partial<BuyerSearchOptions> {
  /** 언어 (ko/en) */
  locale?: "ko" | "en"
  /** Progress 콜백 */
  onProgress?: ProgressCallback
  /** 담당자 선택 기준 */
  contactCriteria?: Partial<ContactSelectionCriteria>
}

/**
 * Provider 조합 정의
 * 각 Provider는 독립적으로 병렬 실행됨
 */
interface ProviderPair {
  name: string
  companyFinder: CompanyFinderProvider
  contactEnricher: ContactEnricherProvider
}

/**
 * Buyer Search Orchestrator
 *
 * **핵심: 모든 Provider를 병렬로 동시에 실행하여 최선의 결과 도출**
 *
 * 현재 지원 Provider:
 * - Hunter.io (Discover + Domain Search)
 *
 * 향후 추가 예정:
 * - Apollo.io
 */
export class BuyerSearchOrchestrator {
  /** 모든 Provider 조합 (병렬 실행됨) */
  private readonly providers: ProviderPair[]
  private readonly options: BuyerSearchOptions
  private readonly contactCriteria: ContactSelectionCriteria
  private readonly locale: "ko" | "en"
  private progressTracker: ProgressTracker | null = null

  // 통계
  private stats = {
    companiesAttempted: 0,
    companiesSucceeded: 0,
    cacheHits: 0,
    retries: 0,
    fillAttempts: 0,
    providerStats: {} as Record<string, { found: number; enriched: number }>,
  }

  // 🆕 AI 생성 키워드 (리랭킹에서 관련성 체크용)
  private aiKeywords: string[] = []

  constructor(options: OrchestratorOptions = {}) {
    // 🚀 모든 Provider 등록 (병렬 실행됨)
    this.providers = [
      {
        name: "hunter",
        companyFinder: createHunterCompanyFinder(),
        contactEnricher: createHunterContactEnricher(),
      },
      // 향후 Apollo 추가:
      // {
      //   name: "apollo",
      //   companyFinder: createApolloCompanyFinder(),
      //   contactEnricher: createApolloContactEnricher(),
      // },
    ]

    // 옵션 병합
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.contactCriteria = {
      ...DEFAULT_CONTACT_CRITERIA,
      ...options.contactCriteria,
    }
    this.locale = options.locale || "ko"

    // Progress Tracker 생성
    if (options.onProgress) {
      this.progressTracker = createProgressTracker({
        targetCount: this.options.targetCount,
        locale: this.locale,
        onProgress: options.onProgress,
      })
    }
  }

  /**
   * 바이어 검색 실행
   *
   * @param params - 검색 파라미터
   * @returns 검색 결과
   */
  async search(params: CompanySearchParams): Promise<OrchestratorResult> {
    const startTime = Date.now()
    const results: BuyerSearchResult[] = []

    // 통계 초기화
    this.stats = {
      companiesAttempted: 0,
      companiesSucceeded: 0,
      cacheHits: 0,
      retries: 0,
      fillAttempts: 0,
      providerStats: {},
    }

    // AI 생성 키워드 초기화
    this.aiKeywords = []

    try {
      // Phase 1: Init
      this.progressTracker?.setPhase("init")

      let searchParams = { ...params }

      // 1. Country ISO 코드 변환 (AI 기반)
      if (params.location?.country) {
        const isoCode = await toISOCountryCode(params.location.country)
        console.log(
          `[BuyerSearchOrchestrator] 🌍 Country: "${params.location.country}" → ISO: "${isoCode}"`,
        )
        searchParams = {
          ...searchParams,
          location: {
            ...params.location,
            country: isoCode,
          },
        }
      }

      // 2. 🆕 회사 설명이 있으면 AI가 keywords + 잠재 고객 industry 생성
      if (params.myCompanyDescription) {
        const countryISO = searchParams.location?.country || ""
        const myIndustry = params.industry?.include?.[0] || "" // 내 회사의 industry (참고용)

        // 🤖 OpenAI GPT-5.2로 잠재 고객 쿼리 생성
        const aiResult = await generateBuyerQueryWithAI(
          params.myCompanyDescription,
          params.targetType,
          myIndustry,
          countryISO,
        )

        // 🆕 AI 생성 키워드 저장 (리랭킹용)
        this.aiKeywords = [...aiResult.keywords, ...aiResult.buyerTypes]

        // 🆕 AI가 생성한 잠재 고객 industry를 사용 (입력된 내 회사 industry 무시!)
        const buyerIndustries = aiResult.hunterIndustries
        if (buyerIndustries.length > 0) {
          console.log(
            `[BuyerSearchOrchestrator] 🏭 Buyer Industries (AI generated): [${buyerIndustries.join(", ")}]`,
          )
          searchParams = {
            ...searchParams,
            industry: {
              include: buyerIndustries,
            },
          }
        } else {
          // AI가 industry를 생성하지 못하면 industry 필터 없이 검색
          console.log(
            `[BuyerSearchOrchestrator] ⚠️ No buyer industries from AI, searching without industry filter`,
          )
          searchParams = {
            ...searchParams,
            industry: undefined,
          }
        }

        // 생성된 키워드로 params 업데이트 (query 제거, keywords 중심)
        searchParams = {
          ...searchParams,
          query: undefined,
          keywords: {
            include: [...aiResult.keywords, ...(params.keywords?.include || [])],
            exclude: aiResult.excludeKeywords,
            match: "any" as const,
          },
        }
      }

      console.log(
        `[BuyerSearchOrchestrator] Starting search - target: ${this.options.targetCount}, ` +
          `params: ${JSON.stringify(searchParams)}`,
      )

      // Phase 2: Discovery - 회사 검색
      this.progressTracker?.setPhase("discovery")
      const companies = await this.discoverCompanies(searchParams)

      if (companies.length === 0) {
        return this.buildResult(results, startTime, {
          type: "not_found",
          message: "No companies found matching the criteria",
          retryable: false,
        })
      }

      // Phase 3: Enrichment - 담당자 정보 수집
      this.progressTracker?.setPhase("enrichment")
      const enrichedResults = await this.enrichContacts(companies)
      results.push(...enrichedResults)

      // 현재까지 결과 수 업데이트
      this.progressTracker?.updateResultsFound(results.length)

      // Phase 4: Fill - 부족분 채우기 (필요시)
      if (results.length < this.options.targetCount) {
        this.progressTracker?.setPhase("fill")
        const additionalResults = await this.fillMissing(
          params,
          results.length,
          companies.map((c) => c.domain),
        )
        results.push(...additionalResults)
        this.progressTracker?.updateResultsFound(results.length)
      }

      // 🏆 Reranking: 점수 기준 정렬 후 상위 N개 선별
      const rankedResults = results
        .sort((a, b) => b.rankScore - a.rankScore)
        .slice(0, this.options.targetCount)

      console.log(
        `[BuyerSearchOrchestrator] 🏆 Reranking: ${results.length} results → top ${rankedResults.length}`,
      )
      if (rankedResults.length > 0) {
        const topScores = rankedResults.slice(0, 5).map((r) => r.rankScore)
        console.log(`[BuyerSearchOrchestrator] Top 5 scores: [${topScores.join(", ")}]`)
      }

      // Phase 5: Complete
      this.progressTracker?.setComplete()

      console.log(
        `[BuyerSearchOrchestrator] Search complete - ` +
          `found ${rankedResults.length}/${this.options.targetCount}, ` +
          `time: ${Date.now() - startTime}ms, ` +
          `stats: ${JSON.stringify(this.stats)}`,
      )

      return this.buildResult(rankedResults, startTime)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[BuyerSearchOrchestrator] Error: ${errorMessage}`)
      logger.error({ error, params }, "BuyerSearchOrchestrator.search failed")

      this.progressTracker?.setError(errorMessage)

      return this.buildResult(results, startTime, {
        type: "unknown",
        message: errorMessage,
        retryable: true,
      })
    }
  }

  /**
   * Phase 2: 회사 검색 (Discovery)
   *
   * 🚀 모든 Provider를 병렬로 동시 실행하여 결과 수집
   * 예: 목표 30개, Provider 2개면 각 20개씩 검색 → 병합 → 중복 제거
   */
  private async discoverCompanies(params: CompanySearchParams): Promise<Company[]> {
    // 각 Provider당 검색할 수량 계산
    const perProviderLimit = calculatePerProviderLimit(
      this.options.targetCount,
      this.providers.length,
    )

    console.log(
      `[BuyerSearchOrchestrator] 🚀 Discovery: Running ${this.providers.length} providers in parallel ` +
        `(each fetching ~${perProviderLimit} companies)`,
    )

    // 🚀 모든 Provider 병렬 실행
    const providerResults = await Promise.allSettled(
      this.providers.map(async (provider) => {
        const startTime = Date.now()
        const result = await provider.companyFinder.searchCompanies({
          ...params,
          limit: perProviderLimit,
        })

        const elapsed = Date.now() - startTime
        console.log(
          `[BuyerSearchOrchestrator] Provider "${provider.name}": ` +
            `${result.success ? `${result.data?.companies.length || 0} companies` : "failed"} (${elapsed}ms)`,
        )

        return {
          providerName: provider.name,
          result,
        }
      }),
    )

    // 결과 수집 및 중복 제거
    const seenDomains = new Set<string>()
    const allCompanies: Array<Company & { source: string }> = []

    for (const settled of providerResults) {
      if (settled.status === "rejected") {
        console.error("[BuyerSearchOrchestrator] Provider failed:", settled.reason)
        continue
      }

      const { providerName, result } = settled.value

      if (!result.success || !result.data) {
        console.warn(`[BuyerSearchOrchestrator] Provider "${providerName}" returned no data`)
        continue
      }

      if (result.fromCache) {
        this.stats.cacheHits++
      }

      // 통계 초기화
      if (!this.stats.providerStats[providerName]) {
        this.stats.providerStats[providerName] = { found: 0, enriched: 0 }
      }

      // 중복 제거하며 추가
      for (const company of result.data.companies) {
        const domainLower = company.domain.toLowerCase()
        if (!seenDomains.has(domainLower)) {
          seenDomains.add(domainLower)
          allCompanies.push({ ...company, source: providerName })
          const stat = this.stats.providerStats[providerName]
          if (stat) stat.found++
        }
      }
    }

    this.progressTracker?.updateDiscoveryDetails(
      allCompanies.length,
      perProviderLimit * this.providers.length,
    )

    console.log(
      `[BuyerSearchOrchestrator] Discovery complete: ${allCompanies.length} unique companies ` +
        `from ${this.providers.length} providers`,
    )

    // source 필드 제거하고 반환
    return allCompanies.map(({ source, ...company }) => company)
  }

  /**
   * Phase 3: 담당자 정보 수집 (Enrichment)
   *
   * 🚀 모든 Provider의 ContactEnricher를 병렬로 실행
   * 각 도메인에 대해 가장 좋은 결과 선택
   */
  private async enrichContacts(companies: Company[]): Promise<BuyerSearchResult[]> {
    const results: BuyerSearchResult[] = []
    const domains = companies.map((c) => c.domain)

    console.log(
      `[BuyerSearchOrchestrator] 🚀 Enrichment: ${domains.length} domains with ` +
        `${this.providers.length} providers in parallel`,
    )

    // 🚀 모든 Provider 병렬 실행
    const providerResultMaps = await Promise.allSettled(
      this.providers.map(async (provider) => {
        const startTime = Date.now()
        const resultMap = await provider.contactEnricher.enrichContactsBatch(
          domains,
          this.contactCriteria,
          (completed, total) => {
            // Progress는 첫 번째 Provider 기준으로 업데이트
            if (provider.name === this.providers[0]?.name) {
              this.progressTracker?.updateEnrichmentDetails(completed, total)
              this.progressTracker?.setCurrentCompany(companies[completed - 1]?.name)
            }
          },
        )
        const elapsed = Date.now() - startTime
        console.log(
          `[BuyerSearchOrchestrator] Enrichment "${provider.name}": ${resultMap.size} results (${elapsed}ms)`,
        )
        return { providerName: provider.name, resultMap }
      }),
    )

    // 도메인별로 가장 좋은 결과 선택
    const bestResults = new Map<
      string,
      { result: ProviderResult<ContactSearchResult>; source: string }
    >()

    for (const settled of providerResultMaps) {
      if (settled.status === "rejected") {
        console.error("[BuyerSearchOrchestrator] Enrichment provider failed:", settled.reason)
        continue
      }

      const { providerName, resultMap } = settled.value

      for (const [domain, result] of resultMap) {
        if (!result.success || !result.data) continue

        const existing = bestResults.get(domain)

        // 더 좋은 결과인지 확인 (담당자가 있고 신뢰도가 높은 것 우선)
        if (!existing) {
          bestResults.set(domain, { result, source: providerName })
        } else if (result.data.contact && !existing.result.data?.contact) {
          bestResults.set(domain, { result, source: providerName })
        } else if (
          result.data.contact &&
          existing.result.data?.contact &&
          result.data.contact.confidence > existing.result.data.contact.confidence
        ) {
          bestResults.set(domain, { result, source: providerName })
        }
      }
    }

    // 결과 처리
    for (const company of companies) {
      this.stats.companiesAttempted++
      const best = bestResults.get(company.domain)

      if (best?.result.success && best.result.data) {
        if (best.result.fromCache) {
          this.stats.cacheHits++
        }

        // Provider 통계 업데이트
        const providerStat = this.stats.providerStats[best.source]
        if (providerStat) {
          providerStat.enriched++
        }

        const buyerResult = this.toBuyerResult(
          company,
          best.result.data,
          best.result.timeMs,
          best.result.fromCache,
          best.source as "hunter" | "apollo",
        )

        // 담당자가 있는 결과만 추가
        if (buyerResult.contact) {
          results.push(buyerResult)
          this.stats.companiesSucceeded++
        }
      }

      // 목표 달성 시 조기 종료
      if (results.length >= this.options.targetCount) {
        break
      }
    }

    return results
  }

  /**
   * Phase 4: 부족분 채우기 (Fill)
   *
   * 🚀 모든 Provider를 다시 병렬로 실행하여 추가 결과 수집
   */
  private async fillMissing(
    params: CompanySearchParams,
    currentCount: number,
    excludeDomains: string[],
  ): Promise<BuyerSearchResult[]> {
    const results: BuyerSearchResult[] = []
    const needed = this.options.targetCount - currentCount

    if (needed <= 0) {
      return results
    }

    console.log(`[BuyerSearchOrchestrator] Fill: need ${needed} more results`)

    for (let attempt = 0; attempt < MAX_FILL_ATTEMPTS; attempt++) {
      this.stats.fillAttempts++
      this.progressTracker?.updateFillDetails(attempt + 1, MAX_FILL_ATTEMPTS)

      // 오프셋을 사용하여 추가 검색
      const offset = excludeDomains.length + results.length
      const searchLimit = Math.min(100, Math.ceil(needed * 2))

      // 🚀 모든 Provider 병렬 실행
      const providerResults = await Promise.allSettled(
        this.providers.map(async (provider) => {
          const result = await provider.companyFinder.searchCompanies({
            ...params,
            limit: searchLimit,
            offset,
          })
          return { providerName: provider.name, result }
        }),
      )

      // 결과 수집 (중복 제거)
      const newCompanies: Company[] = []
      const seenDomains = new Set(excludeDomains.map((d) => d.toLowerCase()))

      for (const settled of providerResults) {
        if (settled.status === "rejected") continue
        const { result } = settled.value
        if (!result.success || !result.data) continue

        for (const company of result.data.companies) {
          const domainLower = company.domain.toLowerCase()
          if (!seenDomains.has(domainLower)) {
            seenDomains.add(domainLower)
            newCompanies.push(company)
          }
        }
      }

      if (newCompanies.length === 0) {
        console.log(`[BuyerSearchOrchestrator] Fill attempt ${attempt + 1}: no new companies`)
        break
      }

      // 담당자 정보 수집
      const enrichedResults = await this.enrichContacts(newCompanies)
      results.push(...enrichedResults)
      excludeDomains.push(...newCompanies.map((c) => c.domain))

      const totalCount = currentCount + results.length
      this.progressTracker?.updateResultsFound(totalCount)

      console.log(
        `[BuyerSearchOrchestrator] Fill attempt ${attempt + 1}: ` +
          `added ${enrichedResults.length}, total: ${totalCount}/${this.options.targetCount}`,
      )

      // 목표 달성 시 종료
      if (totalCount >= this.options.targetCount) {
        break
      }
    }

    return results.slice(0, needed)
  }

  /**
   * 결과 변환 + Reranking 점수 계산
   */
  private toBuyerResult(
    company: Company,
    enrichResult: ContactSearchResult,
    timeMs: number,
    fromCache: boolean,
    source: "hunter" | "apollo" = "hunter",
  ): BuyerSearchResult {
    const companyDetails = enrichResult.companyDetails || {
      domain: company.domain,
      name: company.name,
    }

    // 🏆 Reranking 점수 계산 (AI 키워드 관련성 포함)
    const rankScore = calculateRankScore(
      {
        contact: enrichResult.contact,
        company: companyDetails,
      },
      this.aiKeywords,
    )

    return {
      company: companyDetails,
      contact: enrichResult.contact,
      source,
      searchTimeMs: timeMs,
      fromCache,
      rankScore,
    }
  }

  /**
   * 최종 결과 빌드
   */
  private buildResult(
    results: BuyerSearchResult[],
    startTime: number,
    error?: SearchError,
  ): OrchestratorResult {
    return {
      success: error === undefined,
      results: results.slice(0, this.options.targetCount),
      totalTimeMs: Date.now() - startTime,
      stats: { ...this.stats },
      error,
    }
  }
}

// ==================== FACTORY FUNCTION ====================

/**
 * BuyerSearchOrchestrator 인스턴스 생성
 */
export function createBuyerSearchOrchestrator(
  options?: OrchestratorOptions,
): BuyerSearchOrchestrator {
  return new BuyerSearchOrchestrator(options)
}

// ==================== SIMPLE SEARCH FUNCTION ====================

/**
 * 간단한 바이어 검색 함수
 *
 * @param params - 검색 파라미터
 * @param options - 검색 옵션
 * @returns 검색 결과
 *
 * @example
 * ```typescript
 * const result = await searchBuyers({
 *   query: "AI startups in San Francisco",
 *   headcount: ["51-200", "201-500"],
 *   limit: 30,
 * }, {
 *   onProgress: (event) => console.log(event.progress, event.message),
 * })
 *
 * console.log(`Found ${result.results.length} buyers`)
 * ```
 */
export async function searchBuyers(
  params: CompanySearchParams,
  options?: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const orchestrator = createBuyerSearchOrchestrator({
    targetCount: params.limit || 30,
    ...options,
  })

  return orchestrator.search(params)
}
