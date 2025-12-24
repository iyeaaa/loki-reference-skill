/**
 * Lead Description Enrichment Service
 *
 * 웹사이트 크롤링 + AI 기반 비즈니스 설명 생성 서비스
 * - 웹사이트 메타데이터 추출 (og:description, meta description, JSON-LD)
 * - AI를 활용한 비즈니스 설명 생성
 * - 검색 쿼리와 리드의 관련성 스코어 계산
 */

import { GoogleGenAI } from "@google/genai"
import * as cheerio from "cheerio"
import pLimit from "p-limit"
import { config } from "../config"
import logger from "../utils/logger"

// ====================================
// TYPES
// ====================================

export interface WebsiteMetadata {
  title?: string
  description?: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  siteName?: string
  companyName?: string
  companyDescription?: string
  industry?: string
  products?: string[]
  address?: string
  phone?: string
  email?: string
}

export interface LeadForDescriptionEnrichment {
  companyName: string
  websiteUrl: string
  industry?: string
  country?: string
  existingDescription?: string
}

export interface EnrichedLeadDescription {
  companyName: string
  websiteUrl: string
  description: string
  businessType?: "B2B" | "B2C" | "Both"
  products?: string[]
  targetCustomers?: string
  enrichmentSource: "website" | "ai" | "existing"
}

// ====================================
// CONSTANTS
// ====================================

const FETCH_TIMEOUT_MS = 10000 // 10초 타임아웃
const MAX_CONCURRENT_FETCHES = 5 // 동시 요청 제한
const MAX_DESCRIPTION_LENGTH = 300 // 최대 설명 길이

// User-Agent 목록 (봇 차단 우회)
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]

// ====================================
// HELPER FUNCTIONS
// ====================================

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] || USER_AGENTS[0] || ""
}

function normalizeUrl(url: string): string {
  let normalized = url.trim()
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `https://${normalized}`
  }
  return normalized
}

// ====================================
// WEBSITE METADATA EXTRACTION
// ====================================

/**
 * Content-Type 헤더에서 charset 추출
 */
function extractCharsetFromContentType(contentType: string): string | null {
  const match = contentType.match(/charset=([^\s;]+)/i)
  return match?.[1]?.replace(/['"]/g, "") || null
}

/**
 * HTML에서 charset 메타 태그 추출 (바이너리에서 ASCII 부분만 파싱)
 */
function extractCharsetFromHtmlBytes(bytes: Uint8Array): string | null {
  // HTML의 처음 2KB만 확인 (메타 태그는 보통 앞부분에 있음)
  const headBytes = bytes.slice(0, 2048)
  // iso-8859-1으로 임시 디코딩 (charset 태그는 ASCII 범위 내에 있음)
  // biome-ignore lint/suspicious/noExplicitAny: TextDecoder accepts iso-8859-1 at runtime
  const headText = new TextDecoder("iso-8859-1" as any).decode(headBytes)

  // <meta charset="xxx">
  const charsetMatch = headText.match(/<meta[^>]+charset=["']?([^"'\s>]+)/i)
  if (charsetMatch?.[1]) {
    return charsetMatch[1]
  }

  // <meta http-equiv="Content-Type" content="text/html; charset=xxx">
  const httpEquivMatch = headText.match(
    /<meta[^>]+http-equiv=["']?Content-Type["']?[^>]+content=["'][^"']*charset=([^"'\s;]+)/i,
  )
  if (httpEquivMatch?.[1]) {
    return httpEquivMatch[1]
  }

  // content 먼저 오는 경우
  const contentFirstMatch = headText.match(
    /<meta[^>]+content=["'][^"']*charset=([^"'\s;]+)[^>]+http-equiv=["']?Content-Type/i,
  )
  if (contentFirstMatch?.[1]) {
    return contentFirstMatch[1]
  }

  return null
}

/**
 * charset 이름 정규화 (일본어 인코딩 처리)
 */
function normalizeCharset(charset: string): string {
  const normalized = charset.toLowerCase().replace(/[_-]/g, "")

  // 일본어 인코딩 매핑
  const charsetMap: Record<string, string> = {
    shiftjis: "shift-jis",
    shift_jis: "shift-jis",
    sjis: "shift-jis",
    xsjis: "shift-jis",
    eucjp: "euc-jp",
    euc_jp: "euc-jp",
    xeucjp: "euc-jp",
    iso2022jp: "iso-2022-jp",
    // 한국어 인코딩
    euckr: "euc-kr",
    ksc5601: "euc-kr",
    // 중국어 인코딩
    gb2312: "gb2312",
    gbk: "gbk",
    gb18030: "gb18030",
    big5: "big5",
    // 기본
    utf8: "utf-8",
  }

  return charsetMap[normalized] || charset.toLowerCase()
}

/**
 * 웹사이트에서 HTML을 가져옴 (인코딩 자동 감지)
 */
async function fetchWebsiteHtml(url: string): Promise<string | null> {
  const normalizedUrl = normalizeUrl(url)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(normalizedUrl, {
      method: "GET",
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ko;q=0.8,ja;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
      redirect: "follow",
    })

    clearTimeout(timeout)

    if (!response.ok) {
      logger.warn(`[DescriptionEnrich] HTTP error ${response.status} for ${normalizedUrl}`)
      return null
    }

    const contentType = response.headers.get("content-type") || ""
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      logger.warn(`[DescriptionEnrich] Not HTML content for ${normalizedUrl}: ${contentType}`)
      return null
    }

    // 바이너리로 가져와서 인코딩 감지
    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // 1. Content-Type 헤더에서 charset 확인
    let charset = extractCharsetFromContentType(contentType)

    // 2. HTML 메타 태그에서 charset 확인
    if (!charset) {
      charset = extractCharsetFromHtmlBytes(bytes)
    }

    // 3. 기본값: UTF-8
    if (!charset) {
      charset = "utf-8"
    }

    // 4. charset 정규화
    const normalizedCharset = normalizeCharset(charset)

    // 5. 적절한 인코딩으로 디코딩
    // TextDecoder가 지원하는 인코딩 목록: https://encoding.spec.whatwg.org/
    const supportedEncodings = [
      "utf-8",
      "utf-16le",
      "utf-16be",
      "shift-jis",
      "euc-jp",
      "iso-2022-jp",
      "euc-kr",
      "gb2312",
      "gbk",
      "gb18030",
      "big5",
      "iso-8859-1",
      "windows-1252",
    ]

    const encodingToUse = supportedEncodings.includes(normalizedCharset)
      ? normalizedCharset
      : "utf-8"

    if (encodingToUse !== normalizedCharset) {
      logger.warn(
        `[DescriptionEnrich] Unsupported charset "${normalizedCharset}" for ${normalizedUrl}, using UTF-8`,
      )
    }

    // biome-ignore lint/suspicious/noExplicitAny: TextDecoder accepts these encodings at runtime
    const decoder = new TextDecoder(encodingToUse as any)
    const html = decoder.decode(bytes)
    return html
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.warn(`[DescriptionEnrich] Failed to fetch ${normalizedUrl}: ${errorMsg}`)
    return null
  }
}

/**
 * HTML에서 메타데이터 추출
 */
function extractMetadataFromHtml(html: string): WebsiteMetadata {
  const $ = cheerio.load(html)
  const metadata: WebsiteMetadata = {}

  // 1. Title
  metadata.title = $("title").text().trim() || undefined

  // 2. Meta description
  metadata.description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    undefined

  // 3. Keywords
  metadata.keywords = $('meta[name="keywords"]').attr("content")?.trim() || undefined

  // 4. Open Graph
  metadata.ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || undefined
  metadata.ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || undefined
  metadata.siteName = $('meta[property="og:site_name"]').attr("content")?.trim() || undefined

  // 5. JSON-LD 구조화 데이터
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonText = $(el).html()
      if (!jsonText) return

      const jsonData = JSON.parse(jsonText)
      const items = Array.isArray(jsonData) ? jsonData : [jsonData]

      for (const item of items) {
        const entities = item["@graph"] ? item["@graph"] : [item]

        for (const entity of entities) {
          const type = entity["@type"]
          if (!type) continue

          // Organization, LocalBusiness, Company 등
          if (
            typeof type === "string" &&
            (type.includes("Organization") ||
              type.includes("Business") ||
              type.includes("Company") ||
              type.includes("Corporation"))
          ) {
            if (entity.name && !metadata.companyName) {
              metadata.companyName = entity.name
            }
            if (entity.description && !metadata.companyDescription) {
              metadata.companyDescription = entity.description
            }
            if (entity.telephone && !metadata.phone) {
              metadata.phone = entity.telephone
            }
            if (entity.email && !metadata.email) {
              metadata.email = entity.email
            }

            // 주소
            if (entity.address && !metadata.address) {
              const addr = entity.address
              if (typeof addr === "string") {
                metadata.address = addr
              } else if (addr.streetAddress || addr.addressLocality) {
                const parts = [
                  addr.streetAddress,
                  addr.addressLocality,
                  addr.addressRegion,
                  addr.postalCode,
                  addr.addressCountry,
                ].filter(Boolean)
                metadata.address = parts.join(", ")
              }
            }
          }

          // Product 정보
          if (type === "Product" && entity.name) {
            if (!metadata.products) metadata.products = []
            metadata.products.push(entity.name)
          }
        }
      }
    } catch {
      // JSON 파싱 실패 무시
    }
  })

  return metadata
}

/**
 * 웹사이트에서 메타데이터 추출 (통합 함수)
 */
export async function fetchWebsiteMetadata(url: string): Promise<WebsiteMetadata | null> {
  const html = await fetchWebsiteHtml(url)
  if (!html) return null

  return extractMetadataFromHtml(html)
}

// ====================================
// AI DESCRIPTION GENERATION
// ====================================

/**
 * Gemini를 사용하여 비즈니스 설명 생성
 */
async function generateDescriptionWithAI(
  companyName: string,
  metadata: WebsiteMetadata,
  industry?: string,
  country?: string,
): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })

    // 컨텍스트 구성
    const contextParts: string[] = []
    if (metadata.title) contextParts.push(`Website Title: ${metadata.title}`)
    if (metadata.description) contextParts.push(`Meta Description: ${metadata.description}`)
    if (metadata.companyDescription)
      contextParts.push(`Company Description: ${metadata.companyDescription}`)
    if (metadata.siteName) contextParts.push(`Site Name: ${metadata.siteName}`)
    if (metadata.keywords) contextParts.push(`Keywords: ${metadata.keywords}`)
    if (metadata.products?.length)
      contextParts.push(`Products: ${metadata.products.slice(0, 5).join(", ")}`)
    if (industry) contextParts.push(`Industry: ${industry}`)
    if (country) contextParts.push(`Country: ${country}`)

    const context = contextParts.join("\n")

    const prompt = `You are a B2B lead research expert. Based on the following website metadata, write a concise business description (2-3 sentences, max 200 characters) for the company.

Company: ${companyName}
${context}

The description should:
1. Explain what the company does
2. Mention their main products or services
3. Indicate their target customers (B2B/B2C)
4. Be in English

Return ONLY the description, no quotes or additional text.`

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    })

    const description = response.text?.trim()
    if (description && description.length > 10) {
      return description.substring(0, MAX_DESCRIPTION_LENGTH)
    }

    return null
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.warn(`[DescriptionEnrich] AI generation failed for ${companyName}: ${errorMsg}`)
    return null
  }
}

// ====================================
// MAIN ENRICHMENT FUNCTIONS
// ====================================

/**
 * 단일 리드에 대한 description 보강
 */
export async function enrichLeadWithDescription(
  lead: LeadForDescriptionEnrichment,
): Promise<EnrichedLeadDescription> {
  const { companyName, websiteUrl, industry, country, existingDescription } = lead

  // 이미 좋은 description이 있으면 그대로 사용
  if (existingDescription && existingDescription.length > 50) {
    return {
      companyName,
      websiteUrl,
      description: existingDescription,
      enrichmentSource: "existing",
    }
  }

  // 1. 웹사이트 메타데이터 추출 시도
  const metadata = await fetchWebsiteMetadata(websiteUrl)

  if (metadata) {
    // 메타데이터에서 직접 description 사용
    const directDescription =
      metadata.companyDescription || metadata.description || metadata.ogDescription

    if (directDescription && directDescription.length > 30) {
      logger.info(`[DescriptionEnrich] Using website metadata for ${companyName}`)
      return {
        companyName,
        websiteUrl,
        description: directDescription.substring(0, MAX_DESCRIPTION_LENGTH),
        products: metadata.products,
        enrichmentSource: "website",
      }
    }

    // 2. AI로 description 생성
    const aiDescription = await generateDescriptionWithAI(companyName, metadata, industry, country)

    if (aiDescription) {
      logger.info(`[DescriptionEnrich] Generated AI description for ${companyName}`)
      return {
        companyName,
        websiteUrl,
        description: aiDescription,
        products: metadata.products,
        enrichmentSource: "ai",
      }
    }
  }

  // 3. Fallback: 기본 description 생성
  const fallbackDescription =
    existingDescription ||
    `${companyName} is a ${industry || "business"} company${country ? ` based in ${country}` : ""}.`

  return {
    companyName,
    websiteUrl,
    description: fallbackDescription,
    enrichmentSource: "existing",
  }
}

/**
 * 여러 리드에 대한 description 일괄 보강
 */
export async function enrichLeadsWithDescriptions(
  leads: LeadForDescriptionEnrichment[],
  options?: {
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  },
): Promise<EnrichedLeadDescription[]> {
  const concurrency = options?.concurrency || MAX_CONCURRENT_FETCHES
  const limit = pLimit(concurrency)

  logger.info(
    `[DescriptionEnrich] Starting batch enrichment for ${leads.length} leads (concurrency: ${concurrency})`,
  )

  const startTime = Date.now()
  let completed = 0

  const enrichmentPromises = leads.map((lead) =>
    limit(async () => {
      const result = await enrichLeadWithDescription(lead)
      completed++

      if (options?.onProgress) {
        options.onProgress(completed, leads.length)
      }

      return result
    }),
  )

  const results = await Promise.all(enrichmentPromises)

  const duration = Date.now() - startTime
  const fromWebsite = results.filter((r) => r.enrichmentSource === "website").length
  const fromAI = results.filter((r) => r.enrichmentSource === "ai").length
  const existing = results.filter((r) => r.enrichmentSource === "existing").length

  logger.info(
    `[DescriptionEnrich] Batch complete in ${duration}ms: ` +
      `${fromWebsite} from website, ${fromAI} from AI, ${existing} existing`,
  )

  return results
}

// ====================================
// RELEVANCE SCORING
// ====================================

export interface RelevanceScoreResult {
  score: number // 0-100
  reasoning: string
  matchedKeywords: string[]
}

/**
 * 검색 쿼리와 리드 description의 관련성 스코어 계산
 */
export async function calculateDescriptionRelevance(
  searchQuery: string,
  leadDescription: string,
  leadIndustry?: string,
): Promise<RelevanceScoreResult> {
  try {
    const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })

    const prompt = `You are a B2B lead scoring expert. Calculate the relevance score between a search query and a company description.

Search Query: "${searchQuery}"
Company Description: "${leadDescription}"
${leadIndustry ? `Industry: ${leadIndustry}` : ""}

Score the relevance from 0-100 based on:
- How well the company's products/services match what the searcher is looking for
- Industry alignment
- B2B relevance
- Geographic match (if specified in query)

Return a JSON object with:
{
  "score": <number 0-100>,
  "reasoning": "<brief explanation>",
  "matchedKeywords": ["<keyword1>", "<keyword2>"]
}

Return ONLY the JSON, no markdown or extra text.`

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    })

    const text = response.text?.trim() || ""

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
        reasoning: String(parsed.reasoning || ""),
        matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [],
      }
    }

    return { score: 50, reasoning: "Could not parse AI response", matchedKeywords: [] }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.warn(`[DescriptionEnrich] Relevance scoring failed: ${errorMsg}`)
    return { score: 50, reasoning: "Scoring error", matchedKeywords: [] }
  }
}

/**
 * 여러 리드에 대한 관련성 스코어 일괄 계산
 */
export async function calculateBatchRelevanceScores(
  searchQuery: string,
  leads: Array<{ description: string; industry?: string }>,
  options?: {
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  },
): Promise<RelevanceScoreResult[]> {
  const concurrency = options?.concurrency || 3 // AI 요청은 더 낮은 동시성
  const limit = pLimit(concurrency)

  logger.info(
    `[DescriptionEnrich] Calculating relevance scores for ${leads.length} leads (concurrency: ${concurrency})`,
  )

  let completed = 0

  const scorePromises = leads.map((lead) =>
    limit(async () => {
      const result = await calculateDescriptionRelevance(
        searchQuery,
        lead.description,
        lead.industry,
      )
      completed++

      if (options?.onProgress) {
        options.onProgress(completed, leads.length)
      }

      return result
    }),
  )

  return Promise.all(scorePromises)
}
