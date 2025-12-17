import { config } from "../config"
import logger from "../utils/logger"
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
    console.log(`[Hunter.io] ✅ Cache hit for ${domain}`)
    return cached
  }

  console.log(`[Hunter.io] Searching emails for domain: ${domain}`)
  const startTime = Date.now()

  try {
    // type=generic: 공식 이메일만 가져옴 (contact@, info@, sales@, support@ 등)
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&type=generic&api_key=${apiKey}`

    const response = await fetch(url)

    if (!response.ok) {
      const error = await response.json()
      console.error(`[Hunter.io] ❌ API error for ${domain}:`, error)
      logger.warn({ domain, error }, "Hunter.io API error")
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
    const elapsed = Date.now() - startTime

    const result = {
      emails: sortedEmails.slice(0, 5), // 상위 5개만
      organization: data.data?.organization,
      description: data.data?.description,
    }

    console.log(`[Hunter.io] ✅ Found ${result.emails.length} emails for ${domain} (${elapsed}ms)`)
    if (result.emails.length > 0) {
      console.log(`[Hunter.io]   - emails: ${result.emails.map((e) => e.value).join(", ")}`)
    }

    // Cache the result
    await cache.set(`hunter:${domain}`, result)

    return result
  } catch (error) {
    console.error(`[Hunter.io] ❌ Failed to fetch emails for ${domain}:`, error)
    logger.error({ error, domain }, "Failed to fetch emails from Hunter.io")
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
    console.log(`[JinaReader] ✅ Cache hit for ${url}`)
    return cached
  }

  const TIMEOUT_MS = 15000 // 15초 타임아웃

  console.log(`[JinaReader] Extracting content from: ${url}`)
  const startTime = Date.now()

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
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error(`[JinaReader] ❌ API error for ${url}: status ${response.status}`)
        logger.warn({ url, status: response.status }, "Jina Reader API error")
        return { content: "" }
      }

      const content = await response.text()
      const elapsed = Date.now() - startTime

      // 콘텐츠에서 제목과 설명 추출 시도
      const titleMatch = content.match(/^#\s*(.+)$/m)
      const title = titleMatch ? titleMatch[1] : undefined

      // 첫 몇 문장을 설명으로 사용
      const paragraphs = content.split("\n\n").filter((p) => p.trim().length > 50)
      const description = paragraphs.slice(0, 2).join(" ").slice(0, 500)

      console.log(`[JinaReader] ✅ Extracted ${content.length} chars from ${url} (${elapsed}ms)`)
      if (title) {
        console.log(`[JinaReader]   - title: ${title.substring(0, 50)}...`)
      }

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
        console.warn(`[JinaReader] ⚠️ Request timed out for ${url} (${TIMEOUT_MS}ms)`)
        logger.warn({ url, timeout: TIMEOUT_MS }, "Jina Reader request timed out")
        return { content: "" }
      }
      throw error
    }
  } catch (error) {
    console.error(`[JinaReader] ❌ Failed to extract content from ${url}:`, error)
    logger.error({ error, url }, "Failed to extract content with Jina Reader")
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
    console.log(`[Gemini] ✅ Cache hit for ${companyName}`)
    return cached
  }

  console.log(`[Gemini] Summarizing company info for: ${companyName}`)
  const startTime = Date.now()

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

    console.log(`[Gemini] Calling Gemini API...`)
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    })

    const text = response.text?.trim() || "{}"
    const cleaned = text.replace(/```json\n?/gi, "").replace(/```\n?/gi, "")
    const elapsed = Date.now() - startTime

    const result = JSON.parse(cleaned)
    console.log(`[Gemini] ✅ Summarized ${companyName} (${elapsed}ms)`)
    if (result.description) {
      console.log(`[Gemini]   - description: ${result.description.substring(0, 50)}...`)
    }
    if (result.industry) {
      console.log(`[Gemini]   - industry: ${result.industry}`)
    }

    // Cache the result
    await cache.set(`gemini:${contentHash}`, result)

    return result
  } catch (error) {
    console.error(`[Gemini] ❌ Failed to summarize ${companyName}:`, error)
    logger.error({ error, companyName }, "Failed to summarize company info")
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

  logger.info({ domain, companyName }, "Starting lead enrichment")

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
  logger.info(
    { domain, emailCount: result.emails.length, hasDescription: !!result.companyInfo.description },
    "Lead enrichment completed",
  )

  return result
}
