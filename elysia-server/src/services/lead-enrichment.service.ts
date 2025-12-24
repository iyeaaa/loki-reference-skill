import { config } from "../config"
import logger, { externalLogger } from "../utils/logger"
import { hashString, RedisCache } from "./redis-cache.service"

// Initialize cache for lead enrichment
const cache = RedisCache.fromConfig(config.cache.leadEnrichment)

// Cache value types
type HunterCacheValue = {
  emails: Array<{ value: string; type: string; confidence: number }>
  organization?: string
  description?: string
}

type JinaCacheValue = {
  content: string
  title?: string
  description?: string
}

type GeminiCacheValue = {
  description: string
  industry?: string
  products?: string
  attachedEmailValue?: string
  attachedEmailType?: string
}

// Enrichment 결과 타입
export interface EnrichmentResult {
  domain: string
  emails: Array<{
    value: string
    type: string
    confidence?: number
  }>
  companyInfo: {
    name?: string
    description?: string
    industry?: string
    size?: string
    founded?: string
    location?: string
  }
  socialLinks: {
    linkedin?: string
    twitter?: string
    facebook?: string
  }
  rawContent?: string
}

// Hunter.io API로 이메일 찾기 (공식 이메일만)
export const findEmailsWithHunter = async (
  domain: string,
  apiKey: string,
): Promise<{
  emails: Array<{ value: string; type: string; confidence: number }>
  organization?: string
  description?: string
}> => {
  // Check cache first
  const cached = await cache.get<HunterCacheValue>(`hunter:${domain}`)
  if (cached) {
    // Cache hit logged at debug level only
    logger.debug({ service: "hunter", domain, cached: true }, "[hunter] Cache hit")
    return cached
  }

  const call = externalLogger.start({
    service: "hunter",
    operation: "domain_search",
    endpoint: domain,
  })

  try {
    // type=generic: 공식 이메일만 가져옴 (contact@, info@, sales@, support@ 등)
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&type=generic&api_key=${apiKey}`

    const response = await fetch(url)

    if (!response.ok) {
      call.failure(`API error: ${response.status}`, { domain })
      return { emails: [] }
    }

    const data = (await response.json()) as {
      data?: {
        emails?: Array<{ value: string; type: string; confidence: number }>
        organization?: string
        description?: string
      }
    }

    // generic 타입만 필터링 (이중 보장)
    const genericEmails =
      data.data?.emails
        ?.filter((e) => e.type === "generic")
        .map((e) => ({
          value: e.value,
          type: e.type,
          confidence: e.confidence || 0,
        })) || []

    // 신뢰도 순으로 정렬
    const sortedEmails = genericEmails.sort((a, b) => b.confidence - a.confidence)

    const result = {
      emails: sortedEmails.slice(0, 5), // 상위 5개만
      organization: data.data?.organization,
      description: data.data?.description,
    }

    call.success({ emailCount: result.emails.length })

    // Cache the result
    await cache.set(`hunter:${domain}`, result)

    return result
  } catch (error) {
    call.failure(error instanceof Error ? error : String(error), { domain })
    return { emails: [] }
  }
}

// Jina Reader로 웹사이트 콘텐츠 추출 (15초 타임아웃)
export const extractWebsiteContent = async (
  url: string,
): Promise<{
  content: string
  title?: string
  description?: string
}> => {
  // Check cache first
  const cached = await cache.get<JinaCacheValue>(`jina:${url}`)
  if (cached) {
    logger.debug({ service: "jina", url, cached: true }, "[jina] Cache hit")
    return cached
  }

  const TIMEOUT_MS = 60000 // 60초 타임아웃 (느린 사이트 대응)

  const call = externalLogger.start({
    service: "jina",
    operation: "extract_content",
    endpoint: url,
  })

  try {
    // URL 정규화
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`

    // AbortController로 타임아웃 설정
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(`https://r.jina.ai/${normalizedUrl}`, {
        headers: {
          Accept: "text/plain",
          "X-Engine": "browser", // 브라우저 엔진 사용 (JavaScript 렌더링)
          "X-Timeout": "90000", // 90초 대기 (Jina 서버측 타임아웃)
          "X-Wait-For-Selector": "#main, #root, #app, .main-content, main, article", // 주요 콘텐츠 로딩 대기
          "X-With-Iframe": "true", // iframe 콘텐츠 포함
          "X-No-Cache": "true", // 캐시 비활성화 (최신 콘텐츠 가져오기)
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        call.failure(`API error: ${response.status}`, { url })
        return { content: "" }
      }

      const content = await response.text()

      // 콘텐츠에서 제목과 설명 추출 시도
      const titleMatch = content.match(/^#\s*(.+)$/m)
      const title = titleMatch ? titleMatch[1] : undefined

      // 첫 몇 문장을 설명으로 사용
      const paragraphs = content.split("\n\n").filter((p) => p.trim().length > 50)
      const description = paragraphs.slice(0, 2).join(" ").slice(0, 500)

      call.success({ contentLength: content.length })

      const result = {
        content: content.slice(0, 5000), // 최대 5000자
        title,
        description,
      }

      // Cache the result
      await cache.set(`jina:${url}`, result)

      return result
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === "AbortError") {
        call.failure("Request timeout", { url, timeout: TIMEOUT_MS })
        return { content: "" }
      }
      throw error
    }
  } catch (error) {
    call.failure(error instanceof Error ? error : String(error), { url })
    return { content: "" }
  }
}

// 회사 정보 요약 생성 (Gemini 사용)
export const summarizeCompanyInfo = async (
  content: string,
  companyName: string,
  geminiApiKey: string,
): Promise<{
  description: string
  industry?: string
  products?: string
  attachedEmailValue?: string
  attachedEmailType?: string
}> => {
  // Use content hash for caching to deduplicate similar content
  const contentHash = hashString(content.slice(0, 3000))
  const cached = await cache.get<GeminiCacheValue>(`gemini:${contentHash}`)
  if (cached) {
    logger.debug({ service: "gemini", companyName, cached: true }, "[gemini] Cache hit")
    return cached
  }

  const call = externalLogger.start({
    service: "gemini",
    operation: "summarize_company",
    endpoint: companyName,
  })

  try {
    const { GoogleGenAI } = await import("@google/genai")
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })

    const prompt = `Based on the following website content, provide a brief summary about the company "${companyName}".

Content:
${content.slice(0, 3000)}

Respond in JSON format:
{
  "attachedEmailValue": "example@example.com",
  "attachedEmailType": "personal",
  "description": "2-3 sentence description of what the company does (in Korean)",
  "industry": "main industry/sector",
  "products": "main products or services (in Korean)"
}

JSON response:`

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    })

    const text = response.text?.trim() || "{}"
    const cleaned = text.replace(/```json\n?/gi, "").replace(/```\n?/gi, "")

    const result = JSON.parse(cleaned)
    call.success({ hasDescription: !!result.description, industry: result.industry })

    // Cache the result
    await cache.set(`gemini:${contentHash}`, result)

    return result
  } catch (error) {
    call.failure(error instanceof Error ? error : String(error), { companyName })
    return { description: "" }
  }
}

// 메인 enrichment 함수
export const enrichLead = async (
  webAddress: string,
  companyName: string,
  options: {
    hunterApiKey?: string
    geminiApiKey?: string
    skipHunter?: boolean
    skipJina?: boolean
  } = {},
): Promise<EnrichmentResult> => {
  const domain = webAddress.replace(/^https?:\/\//, "").replace(/\/.*$/, "")

  // Debug level only - individual enrichment
  logger.debug({ domain, companyName }, "[lead-enrichment] Starting enrichment")

  const result: EnrichmentResult = {
    domain,
    emails: [],
    companyInfo: {},
    socialLinks: {},
  }

  // Jina Reader로 웹사이트 콘텐츠 추출
  if (!options.skipJina) {
    const jinaResult = await extractWebsiteContent(webAddress)
    result.rawContent = jinaResult.content

    // Gemini로 요약 생성
    if (jinaResult.content && options.geminiApiKey) {
      const summary = await summarizeCompanyInfo(
        jinaResult.content,
        companyName || domain,
        options.geminiApiKey,
      )
      if (summary.attachedEmailValue) {
        result.emails = [{ value: summary.attachedEmailValue, type: "personal" }]
        if (summary.attachedEmailType) {
          result.emails = [{ value: summary.attachedEmailValue, type: summary.attachedEmailType }]
        }
        if (summary.attachedEmailValue === "example@example.com") {
          result.emails = []
        }
      }

      result.companyInfo.description = summary.description || result.companyInfo.description
      result.companyInfo.industry = summary.industry
    }
  }

  // Hunter.io로 이메일 찾기
  if (!options.skipHunter && options.hunterApiKey) {
    const hunterResult = await findEmailsWithHunter(domain, options.hunterApiKey)
    if (hunterResult.emails.length !== 0) {
      for (const email of hunterResult.emails) {
        let found = false
        result.emails.forEach((e) => {
          if (email.value === e.value) {
            found = true
          }
        })
        if (found) {
          continue
        }
        result.emails.push({
          value: email.value,
          type: email.type,
        })
      }
    }
    result.emails = hunterResult.emails
    if (hunterResult.organization) {
      result.companyInfo.name = hunterResult.organization
    }
    if (hunterResult.description) {
      result.companyInfo.description = hunterResult.description
    }
  }
  // Debug level - individual completion
  logger.debug(
    { domain, emailCount: result.emails.length, hasDescription: !!result.companyInfo.description },
    "[lead-enrichment] Enrichment completed",
  )

  return result
}
