/**
 * Web Data Extraction Service
 * 웹사이트 크롤링 및 연락처 정보 추출
 */

import { createOpenAI } from "@ai-sdk/openai"
import { generateText, streamText } from "ai"
import type { CheerioAPI } from "cheerio"
import * as cheerio from "cheerio"
import type { AnyNode, Element } from "domhandler"
import pLimit from "p-limit"
import type {
  CompanyRecord,
  ExtractedContacts,
  ExtractionProgress,
  FetchResult,
  ProgressLog,
  WebExtractionConfig,
} from "../types/web-extraction.types"
import { GPT_COST_PER_REQUEST } from "../types/web-extraction.types"
import logger from "../utils/logger"
import { getNextApiKey } from "./openai-api-key.service"

/**
 * HTML에서 메타데이터 추출 (title, meta tags, Open Graph, JSON-LD)
 */
function extractMetadata($: CheerioAPI): string {
  const metadata: string[] = []

  // 1. Title
  const title = $("title").text().trim()
  if (title) {
    metadata.push(`[페이지 제목] ${title}`)
  }

  // 2. Meta description
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content")
  if (description) {
    metadata.push(`[설명] ${description.trim()}`)
  }

  // 3. Meta keywords
  const keywords = $('meta[name="keywords"]').attr("content")
  if (keywords) {
    metadata.push(`[키워드] ${keywords.trim()}`)
  }

  // 4. Open Graph tags
  const ogTags: Record<string, string> = {}
  $('meta[property^="og:"]').each((_, el) => {
    const property = $(el).attr("property")?.replace("og:", "")
    const content = $(el).attr("content")
    if (property && content && !["description", "image", "url"].includes(property)) {
      ogTags[property] = content.trim()
    }
  })
  if (ogTags.site_name) {
    metadata.push(`[사이트명] ${ogTags.site_name}`)
  }
  if (ogTags.title && ogTags.title !== title) {
    metadata.push(`[OG 제목] ${ogTags.title}`)
  }
  if (ogTags.type) {
    metadata.push(`[사이트 유형] ${ogTags.type}`)
  }
  if (ogTags.locale) {
    metadata.push(`[언어/지역] ${ogTags.locale}`)
  }

  // 5. Twitter Card
  const twitterSite = $('meta[name="twitter:site"]').attr("content")
  if (twitterSite) {
    metadata.push(`[트위터] ${twitterSite}`)
  }

  // 6. JSON-LD 구조화 데이터 (Organization, LocalBusiness 등)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonText = $(el).html()
      if (!jsonText) return

      const jsonData = JSON.parse(jsonText)
      const items = Array.isArray(jsonData) ? jsonData : [jsonData]

      for (const item of items) {
        // @graph 배열 처리
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
            if (entity.name) metadata.push(`[회사명] ${entity.name}`)
            if (entity.description) metadata.push(`[회사 설명] ${entity.description}`)
            if (entity.telephone) metadata.push(`[전화번호] ${entity.telephone}`)
            if (entity.email) metadata.push(`[이메일] ${entity.email}`)
            if (entity.foundingDate) metadata.push(`[설립일] ${entity.foundingDate}`)
            if (entity.numberOfEmployees?.value) {
              metadata.push(`[직원수] ${entity.numberOfEmployees.value}`)
            }

            // 주소
            if (entity.address) {
              const addr = entity.address
              if (typeof addr === "string") {
                metadata.push(`[주소] ${addr}`)
              } else if (addr.streetAddress || addr.addressLocality) {
                const parts = [
                  addr.streetAddress,
                  addr.addressLocality,
                  addr.addressRegion,
                  addr.postalCode,
                  addr.addressCountry,
                ].filter(Boolean)
                metadata.push(`[주소] ${parts.join(", ")}`)
              }
            }

            // 소셜 미디어
            if (entity.sameAs && Array.isArray(entity.sameAs)) {
              const socials = entity.sameAs.filter(
                (url: string) =>
                  url.includes("facebook") ||
                  url.includes("instagram") ||
                  url.includes("twitter") ||
                  url.includes("linkedin"),
              )
              if (socials.length > 0) {
                metadata.push(`[소셜미디어] ${socials.join(", ")}`)
              }
            }
          }

          // ContactPoint
          if (type === "ContactPoint" || entity.contactPoint) {
            const contact = entity.contactPoint || entity
            if (contact.telephone) metadata.push(`[연락처] ${contact.telephone}`)
            if (contact.email) metadata.push(`[이메일] ${contact.email}`)
          }
        }
      }
    } catch (_e) {
      // JSON 파싱 실패 - 무시
    }
  })

  // 7. 기타 유용한 메타 태그
  const author = $('meta[name="author"]').attr("content")
  if (author) {
    metadata.push(`[작성자/회사] ${author}`)
  }

  const copyright = $('meta[name="copyright"]').attr("content")
  if (copyright) {
    metadata.push(`[저작권] ${copyright}`)
  }

  // 중복 제거 후 반환
  const uniqueMetadata = [...new Set(metadata)]
  return uniqueMetadata.length > 0 ? `=== 메타데이터 ===\n${uniqueMetadata.join("\n")}\n\n` : ""
}

/**
 * 웹사이트에서 HTML 콘텐츠 가져오기
 */
export async function fetchWebsiteContent(
  url: string,
  timeoutSeconds: number,
): Promise<FetchResult> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000)

    // URL 정규화
    let normalizedUrl = url.trim()
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
      },
      redirect: "follow",
    })

    clearTimeout(timeoutId)

    const html = await response.text()
    const $ = cheerio.load(html)

    // 메타데이터 추출 (script 제거 전에 수행 - JSON-LD가 script 태그 안에 있음)
    const metadata = extractMetadata($)

    // 스크립트, 스타일, 주석 제거
    $("script, style, noscript").remove()
    $("*")
      .contents()
      .filter(function (this: AnyNode) {
        return this.type === "comment"
      })
      .remove()

    // 본문 텍스트 추출
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().substring(0, 48000) // 메타데이터 공간 확보를 위해 48KB로 제한

    // 메타데이터 + 본문 결합
    const content = metadata + bodyText

    return {
      content: content.substring(0, 50000), // 최종 50KB 제한
      statusCode: response.status,
      finalUrl: response.url,
    }
  } catch (error) {
    logger.error({ error, url }, "Failed to fetch website content")
    return {
      content: "",
      statusCode: 0,
      finalUrl: url,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 깊이 크롤링 (Contact, About 페이지 등)
 * 중복 fetch 제거: 한 번의 fetch로 content와 links를 모두 추출
 * 메모리 최적화: 콘텐츠 크기 제한 및 명시적 정리
 */
export interface PageInfo {
  url: string
  title?: string
  favicon?: string
  contentLength: number
  canEmbed?: boolean // X-Frame-Options 헤더 기반 iframe 임베딩 가능 여부
}

export async function fetchWithDepth(
  baseUrl: string,
  depth: number,
  timeoutSeconds: number,
  onPageFound?: (info: PageInfo) => void,
  onProgress?: (message: string) => void,
): Promise<{
  pagesContent: Map<string, string>
  httpStatus: number
  pages: PageInfo[]
  siteFavicon?: string
}> {
  const pagesContent = new Map<string, string>()
  const pages: PageInfo[] = []
  let httpStatus = 0
  let siteFavicon: string | undefined

  try {
    // URL 정규화
    let normalizedUrl = baseUrl.trim()
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    logger.debug(
      { url: normalizedUrl, depth, timeout: timeoutSeconds },
      "[fetchWithDepth] Starting crawl",
    )
    onProgress?.("웹사이트에 접속하고 있어요")

    // 첫 페이지 가져오기 (한 번만 fetch)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000)

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
      },
      redirect: "follow",
    })

    clearTimeout(timeoutId)
    httpStatus = response.status

    // X-Frame-Options 헤더 확인 (iframe 임베딩 가능 여부)
    const xFrameOptions = response.headers.get("X-Frame-Options")?.toUpperCase()
    const contentSecurityPolicy = response.headers.get("Content-Security-Policy")
    // frame-ancestors 지시어 확인 (CSP)
    const hasFrameAncestors =
      contentSecurityPolicy?.includes("frame-ancestors") &&
      !contentSecurityPolicy?.includes("frame-ancestors *")
    // X-Frame-Options DENY/SAMEORIGIN 또는 CSP frame-ancestors가 있으면 iframe 불가
    const canEmbed =
      !xFrameOptions?.includes("DENY") &&
      !xFrameOptions?.includes("SAMEORIGIN") &&
      !hasFrameAncestors

    logger.debug(
      { status: httpStatus, url: normalizedUrl, canEmbed, xFrameOptions },
      "[fetchWithDepth] Successfully fetched main page",
    )
    onProgress?.("홈페이지를 찾았어요")

    const html = await response.text()
    const $ = cheerio.load(html)

    // 페이지 제목 추출
    const title = $("title").text().trim() || $("h1").first().text().trim() || "제목 없음"

    // Favicon 추출
    const faviconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
    ]
    for (const selector of faviconSelectors) {
      const faviconHref = $(selector).attr("href")
      if (faviconHref) {
        try {
          siteFavicon = new URL(faviconHref, normalizedUrl).href
          break
        } catch {
          // Invalid URL, try next
        }
      }
    }
    // Fallback to /favicon.ico
    if (!siteFavicon) {
      siteFavicon = new URL("/favicon.ico", normalizedUrl).href
    }
    // Mixed Content 방지: http:// → https:// 변환
    if (siteFavicon?.startsWith("http://")) {
      siteFavicon = siteFavicon.replace("http://", "https://")
    }

    // 메타데이터 추출 (script 제거 전에 수행 - JSON-LD가 script 태그 안에 있음)
    const metadata = extractMetadata($)

    // 링크 추출 (script 제거 전에 수행)
    const links: string[] = []
    if (depth > 0) {
      const baseHostname = new URL(normalizedUrl).hostname

      // 제외할 페이지 패턴 (불필요한 페이지)
      const EXCLUDE_PATTERNS = [
        /privacy/i,
        /terms/i,
        /legal/i,
        /cookie/i,
        /policy/i,
        /disclaimer/i,
        /login/i,
        /signup/i,
        /sign-up/i,
        /register/i,
        /cart/i,
        /checkout/i,
        /sitemap/i,
        /feed/i,
        /rss/i,
        /cdn/i,
        /static/i,
        /faq/i,
        /support/i,
        /help/i,
        /blog\/\d/i, // 개별 블로그 포스트
        /news\/\d/i, // 개별 뉴스 기사
        /\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|json)$/i,
      ]

      // 우선 수집할 페이지 패턴 (중요한 페이지)
      const PRIORITY_PATTERNS = [
        /about/i,
        /company/i,
        /contact/i,
        /products?/i,
        /services?/i,
        /solutions?/i,
        /team/i,
        /who-we-are/i,
        /what-we-do/i,
        /our-story/i,
      ]

      // 최대 페이지 수
      const MAX_PAGES = 4

      // 모든 링크 수집 (필터링 전)
      const allLinks: string[] = []
      $("a[href]").each((_: number, element: Element) => {
        const href = $(element).attr("href")
        if (href) {
          try {
            const absoluteUrl = new URL(href, normalizedUrl).href
            const linkHostname = new URL(absoluteUrl).hostname
            const pathname = new URL(absoluteUrl).pathname

            // 같은 도메인이고, 중복이 아니고, 메인 페이지가 아닌 경우
            if (
              linkHostname === baseHostname &&
              !allLinks.includes(absoluteUrl) &&
              absoluteUrl !== normalizedUrl &&
              pathname !== "/" &&
              // 제외 패턴에 해당하지 않는 경우
              !EXCLUDE_PATTERNS.some((pattern) => pattern.test(pathname))
            ) {
              allLinks.push(absoluteUrl)
            }
          } catch (_e) {
            // Invalid URL, skip
          }
        }
      })

      // 우선순위 페이지 먼저 추가
      for (const url of allLinks) {
        if (links.length >= MAX_PAGES) break
        const pathname = new URL(url).pathname
        if (PRIORITY_PATTERNS.some((pattern) => pattern.test(pathname))) {
          links.push(url)
        }
      }

      // 남은 슬롯에 다른 페이지 추가
      for (const url of allLinks) {
        if (links.length >= MAX_PAGES) break
        if (!links.includes(url)) {
          links.push(url)
        }
      }

      logger.debug(
        { totalFound: allLinks.length, selected: links.length, links },
        "[fetchWithDepth] Filtered links",
      )
    }

    // 스크립트, 스타일, 주석 제거
    $("script, style, noscript").remove()
    $("*")
      .contents()
      .filter(function (this: AnyNode) {
        return this.type === "comment"
      })
      .remove()

    // 본문 텍스트 추출
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().substring(0, 48000) // 메타데이터 공간 확보

    // 메타데이터 + 본문 결합
    const pageContent = (metadata + bodyText).substring(0, 50000)

    if (pageContent) {
      pagesContent.set(normalizedUrl, pageContent)
      logger.debug(
        {
          contentLength: pageContent.length,
          metadataLength: metadata.length,
          url: normalizedUrl,
          title,
        },
        "[fetchWithDepth] Extracted content with metadata from main page",
      )
      onProgress?.("페이지 내용을 읽고 있어요")

      // 메인 페이지 정보 저장
      const mainPageInfo: PageInfo = {
        url: normalizedUrl,
        title,
        favicon: siteFavicon,
        contentLength: pageContent.length,
        canEmbed,
      }
      pages.push(mainPageInfo)

      // 페이지 발견 콜백 호출
      onPageFound?.(mainPageInfo)
    }

    // depth가 0이면 추가 크롤링 없이 반환
    if (depth === 0) {
      logger.debug(
        { totalPages: pagesContent.size },
        "[fetchWithDepth] Depth is 0, skipping additional pages",
      )
      return { pagesContent, httpStatus, pages, siteFavicon }
    }

    // 추가 페이지 크롤링 (링크는 위에서 이미 추출됨)
    logger.debug({ linksFound: links.length }, "[fetchWithDepth] Found additional links to crawl")
    if (links.length > 0) {
      onProgress?.(`${links.length}개의 추가 페이지를 발견했어요`)
    }

    for (const [i, link] of links.entries()) {
      try {
        // 페이지 이름 추출 (URL에서)
        const pageName = link.includes("contact")
          ? "연락처"
          : link.includes("about")
            ? "회사 소개"
            : link.includes("company")
              ? "회사 정보"
              : link.includes("team")
                ? "팀 소개"
                : "추가"
        logger.debug(
          { link, index: i + 1, total: links.length },
          "[fetchWithDepth] Fetching additional page",
        )
        onProgress?.(`${pageName} 페이지를 확인하는 중이에요`)
        await new Promise((resolve) => setTimeout(resolve, 3500)) // 3.5초 지연
        const pageResult = await fetchWebsiteContent(link, Math.floor(timeoutSeconds / 2))
        if (pageResult.content) {
          pagesContent.set(link, pageResult.content)

          // 추가 페이지 제목 추출 (간단하게)
          const pageName = link.split("/").pop() || "추가 페이지"

          logger.debug(
            { link, contentLength: pageResult.content.length },
            "[fetchWithDepth] Successfully fetched and extracted additional page",
          )

          // 추가 페이지 정보 저장
          const additionalPageInfo: PageInfo = {
            url: link,
            title: pageName,
            favicon: siteFavicon, // 사이트 공통 favicon 사용
            contentLength: pageResult.content.length,
            canEmbed, // 메인 페이지와 동일한 도메인이므로 동일한 값 사용
          }
          pages.push(additionalPageInfo)

          // 추가 페이지 발견 콜백 호출
          onPageFound?.(additionalPageInfo)
        }
      } catch (error) {
        logger.debug({ error, link }, "[fetchWithDepth] Failed to fetch additional page")
      }
    }

    logger.info({ totalPages: pagesContent.size }, "[fetchWithDepth] Completed crawling")
    onProgress?.(`총 ${pagesContent.size}개 페이지 수집 완료`)
  } catch (error) {
    logger.warn({ error, baseUrl }, "[fetchWithDepth] Failed to fetch with depth")
  }

  return { pagesContent, httpStatus, pages, siteFavicon }
}

/**
 * GPT를 사용하여 연락처 정보 추출 (Lead Discovery 전용)
 * 항상 환경변수 API 키만 사용
 */
export async function extractContactsForLeadDiscovery(
  pagesContent: Map<string, string>,
  gptTimeout: number,
): Promise<ExtractedContacts> {
  try {
    // 모든 페이지 내용 합치기
    const combinedContent = Array.from(pagesContent.values()).join("\n\n")

    if (!combinedContent || combinedContent.length < 50) {
      return {
        errorMessage: "웹사이트 콘텐츠가 너무 짧거나 비어있습니다",
      }
    }

    // 환경변수 API 키 사용 (Lead Discovery는 항상 환경변수만 사용)
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      logger.error("[Lead Discovery] OPENAI_API_KEY not found in environment variables")
      return {
        errorMessage: "서버에 OpenAI API 키가 설정되어 있지 않습니다",
      }
    }

    logger.info("[Lead Discovery] Using OPENAI_API_KEY from environment variable")

    const prompt = `다음 웹사이트 콘텐츠에서 회사 정보와 연락처를 추출해주세요.

웹사이트 콘텐츠:
${combinedContent.substring(0, 15000)}

다음 정보를 JSON 형식으로 추출해주세요 (찾을 수 없는 필드는 빈 문자열로):
{
  "foundCompanyName": "웹사이트에서 발견한 회사명",
  "description": "회사 설명 (100자 이내)",
  "companyType": "업체 유형 (제조업체, 브랜드사, 유통업체, 수입업체, 대리점, 소매업체 등)",
  "address": "주소",
  "country": "국가",
  "city": "도시",
  "state": "주/도",
  "foundedYear": "설립년도",
  "phoneNumber": "전화번호 (여러개면 쉼표로 구분)",
  "email": "이메일 (여러개면 쉼표로 구분)",
  "facebookUrl": "페이스북 URL",
  "instagramUrl": "인스타그램 URL",
  "twitterUrl": "트위터/X URL",
  "linkedinUrl": "링크드인 URL",
  "employeeCount": "직원 수",
  "products": "주요 제품/서비스 (쉼표로 구분)",
  "businessSectors": "비즈니스 섹터 (쉼표로 구분)",
  "productCategories": "제품 카테고리 (쉼표로 구분)",
  "industryTypes": "산업 유형 (쉼표로 구분)"
}

중요: 반드시 유효한 JSON만 반환하고, 추가 설명은 포함하지 마세요.`

    const openai = createOpenAI({
      apiKey: apiKey,
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), gptTimeout * 1000)

    const { text: responseText } = await generateText({
      model: openai("gpt-4o-mini"),
      system:
        "You are a data extraction assistant. Extract company information from website content and return it as valid JSON only.",
      prompt: prompt,
      temperature: 0.1,
      abortSignal: controller.signal,
    })

    clearTimeout(timeoutId)

    // JSON 파싱
    let jsonText = responseText.trim()

    // 백틱 제거
    if (jsonText.startsWith("`") && jsonText.includes("}")) {
      const startIdx = jsonText.indexOf("{")
      const endIdx = jsonText.lastIndexOf("}")
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonText = jsonText.substring(startIdx, endIdx + 1)
      }
    }

    // JSON 객체만 추출
    if (!jsonText.startsWith("{")) {
      const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonObjectMatch?.[0]) {
        jsonText = jsonObjectMatch[0]
      }
    }

    try {
      const extracted: ExtractedContacts = JSON.parse(jsonText)
      return extracted
    } catch (parseError) {
      logger.error(
        {
          parseError: parseError instanceof Error ? parseError.message : "Unknown parse error",
          responseText,
          extractedJsonText: jsonText,
        },
        "[Lead Discovery] Failed to parse GPT response",
      )
      return {
        errorMessage: "GPT 응답을 파싱할 수 없습니다",
      }
    }
  } catch (error) {
    logger.error({ error }, "[Lead Discovery] GPT extraction failed")
    return {
      errorMessage: error instanceof Error ? error.message : "GPT 추출 실패",
    }
  }
}

/**
 * GPT를 사용하여 연락처 정보 추출 (Web Extraction 전용)
 * Workspace API 키를 사용하며, 없으면 환경변수를 fallback으로 사용
 */
export async function extractContactsWithGPT(
  pagesContent: Map<string, string>,
  gptTimeout: number,
  workspaceId?: string,
  searchCriteria?: string[],
): Promise<ExtractedContacts> {
  try {
    // 모든 페이지 내용 합치기
    const combinedContent = Array.from(pagesContent.values()).join("\n\n")

    if (!combinedContent || combinedContent.length < 50) {
      return {
        errorMessage: "웹사이트 콘텐츠가 너무 짧거나 비어있습니다",
      }
    }

    // Build dynamic prompt with search criteria
    let customSearchFields = ""
    if (searchCriteria && searchCriteria.length > 0) {
      customSearchFields = "\n\n추가 검색 조건:\n"
      customSearchFields += searchCriteria
        .map(
          (criterion, index) =>
            `${index + 1}. "${criterion}" - 이 조건에 해당하는지 판단하고 "true" 또는 "false"로 답변해주세요. 또한 판단의 근거가 되는 구체적인 사실 3가지를 제시해주세요. 근거는 반드시 웹사이트 콘텐츠에서 실제로 발견된 구체적인 텍스트, 데이터, 또는 정보를 인용하여 작성해주세요.`,
        )
        .join("\n")
    }

    let customSearchJson = ""
    if (searchCriteria && searchCriteria.length > 0) {
      customSearchJson = ',\n  "customSearchResults": {\n'
      customSearchJson += searchCriteria
        .map(
          (criterion) => `    "${criterion}": {
      "result": "true 또는 false",
      "reasons": ["근거1", "근거2", "근거3"]
    }`,
        )
        .join(",\n")
      customSearchJson += "\n  }"
    }

    const prompt = `다음 웹사이트 콘텐츠에서 회사 정보와 연락처를 추출해주세요.

웹사이트 콘텐츠:
${combinedContent.substring(0, 15000)}${customSearchFields}

다음 정보를 JSON 형식으로 추출해주세요 (찾을 수 없는 필드는 빈 문자열로):
{
  "foundCompanyName": "웹사이트에서 발견한 회사명",
  "description": "회사 설명 (100자 이내)",
  "address": "주소",
  "country": "국가",
  "city": "도시",
  "state": "주/도",
  "foundedYear": "설립년도",
  "phoneNumber": "전화번호 (여러개면 쉼표로 구분)",
  "email": "이메일 (여러개면 쉼표로 구분)",
  "facebookUrl": "페이스북 URL",
  "instagramUrl": "인스타그램 URL",
  "twitterUrl": "트위터/X URL",
  "linkedinUrl": "링크드인 URL",
  "employeeCount": "직원 수",
  "products": "주요 제품/서비스 (쉼표로 구분)",
  "businessSectors": "비즈니스 섹터 (쉼표로 구분)",
  "productCategories": "제품 카테고리 (쉼표로 구분)",
  "industryTypes": "산업 유형 (쉼표로 구분)"${customSearchJson}
}

중요: 반드시 유효한 JSON만 반환하고, 추가 설명은 포함하지 마세요.

customSearchResults의 각 검색 조건에 대해서는:
1. result 필드에 "true" 또는 "false"를 입력
2. reasons 배열에 구체적인 근거 3가지를 입력해주세요
3. 각 근거는 웹사이트에서 실제로 발견된 내용을 기반으로 작성해야 합니다
4. 근거 작성 시 실제 텍스트, 숫자, 제품명, 회사명 등 구체적인 정보를 포함해주세요
5. 예시: "홈페이지에 '기업 고객 대상 솔루션 제공'이라는 문구가 있음", "제품 목록에 산업용 장비 3종(A-100, B-200, C-300)이 나열됨", "회사 소개에 '1987년 설립된 대한민국 대표 기업'이라고 명시됨"
6. 추상적이거나 일반적인 근거가 아닌, 페이지에서 확인 가능한 구체적인 증거를 제시해주세요`

    // Workspace API 키 가져오기 (round-robin)
    let apiKey = workspaceId ? await getNextApiKey(workspaceId) : null

    // Workspace API 키가 없으면 환경변수 사용 (fallback)
    if (!apiKey) {
      apiKey = process.env.OPENAI_API_KEY || null
      if (apiKey) {
        logger.info("[Web Extraction] Using OPENAI_API_KEY from environment variable (fallback)")
      }
    }

    if (!apiKey) {
      logger.error({ workspaceId }, "[Web Extraction] No API key available")
      return {
        errorMessage:
          "워크스페이스에 OpenAI API 키가 등록되어 있지 않습니다. API 키를 먼저 등록해주세요.",
      }
    }

    const openai = createOpenAI({
      apiKey: apiKey,
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), gptTimeout * 1000)

    const { text: responseText } = await generateText({
      model: openai("gpt-4o-mini"),
      system:
        "You are a data extraction assistant. Extract company information from website content and return it as valid JSON only.",
      prompt: prompt,
      temperature: 0.1,
      abortSignal: controller.signal,
    })

    clearTimeout(timeoutId)

    // JSON 파싱 (여러 전략 시도)
    let jsonText = responseText.trim()

    // 전략 1: 백틱으로 시작하고 끝나는 경우 제거 (유연하게)
    // 예: ```json ... ```, `````` ... ```, ``````json ... ```
    if (jsonText.startsWith("`") && jsonText.includes("}")) {
      // 첫 번째 {부터 마지막 }까지 추출
      const startIdx = jsonText.indexOf("{")
      const endIdx = jsonText.lastIndexOf("}")
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonText = jsonText.substring(startIdx, endIdx + 1)
      }
    }

    // 전략 2: JSON 객체만 추출 (백틱이 없는 경우)
    if (!jsonText.startsWith("{")) {
      const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonObjectMatch?.[0]) {
        jsonText = jsonObjectMatch[0]
      }
    }

    // JSON 파싱 시도
    try {
      const extracted: ExtractedContacts = JSON.parse(jsonText)
      return extracted
    } catch (parseError) {
      logger.error(
        {
          parseError: parseError instanceof Error ? parseError.message : "Unknown parse error",
          responseText,
          extractedJsonText: jsonText,
        },
        "Failed to parse GPT response",
      )
      return {
        errorMessage: "GPT 응답을 파싱하는데 실패했습니다",
      }
    }
  } catch (error) {
    logger.error({ error }, "Failed to extract contacts with GPT")
    return {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * GPT 스트리밍을 사용하여 웹사이트 분석 (단일 웹사이트 분석용)
 */
export async function analyzeWebsiteWithStreaming(
  pagesContent: Map<string, string>,
  gptTimeout: number,
  _workspaceId?: string,
) {
  try {
    // 모든 페이지 내용 합치기
    const combinedContent = Array.from(pagesContent.values()).join("\n\n")

    if (!combinedContent || combinedContent.length < 50) {
      throw new Error("웹사이트 콘텐츠가 너무 짧거나 비어있습니다")
    }

    // 자연스러운 대화형 프롬프트 (토스 스타일)
    const prompt = `아래 웹사이트 콘텐츠를 분석해서 이 회사가 어떤 일을 하는지 쉽게 설명해주세요.

웹사이트 콘텐츠:
${combinedContent.substring(0, 15000)}

분석할 때 다음 내용을 포함해주세요:

**이 회사는 뭐 하는 곳인가요?**
- 회사명과 간단한 소개를 자연스럽게 써주세요
- 어떤 제품이나 서비스를 만드는지 설명해주세요
- 어떤 업종이고, 누구를 위한 비즈니스인지 알려주세요

**기본 정보**
웹사이트에서 찾을 수 있는 정보가 있다면 자연스럽게 언급해주세요:
- 회사 위치 (국가, 도시, 주소)
- 설립 시기나 회사 규모
- 이메일, 전화번호 등 연락처
- SNS 계정 (LinkedIn, Facebook, Instagram 등)

**특징과 강점**
- 이 회사만의 특별한 점이 있나요?
- 어떤 고객들이 관심을 가질까요?
- 주목할 만한 내용이 있다면 알려주세요

**작성 가이드**:
- 마크다운 형식으로 깔끔하게 정리해주세요
- 이모지는 사용하지 마세요
- 정보를 찾을 수 없으면 억지로 만들지 말고 언급하지 마세요
- 친근하고 쉬운 말로 설명해주세요
- 한국어로 작성해주세요`

    // 환경변수에서 OpenAI API 키 사용
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      logger.error("[analyzeWebsiteWithStreaming] OPENAI_API_KEY environment variable not set")
      throw new Error("OpenAI API 키가 환경변수에 설정되어 있지 않습니다")
    }

    logger.info("[analyzeWebsiteWithStreaming] Using OPENAI_API_KEY from environment variable")
    logger.info("[analyzeWebsiteWithStreaming] Starting GPT streaming analysis")

    const openai = createOpenAI({
      apiKey: apiKey,
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), gptTimeout * 1000)

    const result = await streamText({
      model: openai("gpt-4o-mini"),
      system:
        "You are a friendly business analyst who explains company information in a clear, conversational way. Write in Korean using natural language, not rigid formats. Be informative but approachable.",
      prompt: prompt,
      temperature: 0.4,
      abortSignal: controller.signal,
    })

    clearTimeout(timeoutId)

    logger.info("[analyzeWebsiteWithStreaming] GPT streaming initialized successfully")

    return result
  } catch (error) {
    logger.error(
      { error },
      "[analyzeWebsiteWithStreaming] Failed to analyze website with streaming",
    )
    throw error
  }
}

/**
 * 단일 리드 강화 처리 (Lead Discovery 전용)
 * 항상 환경변수 API 키 사용, searchCriteria 없음
 */
export async function processLeadEnrichment(
  websiteUrl: string,
  config: WebExtractionConfig,
): Promise<CompanyRecord> {
  const startTime = Date.now()
  const record: CompanyRecord = { websiteUrl }

  try {
    // URL 검증
    if (!websiteUrl || websiteUrl.trim().length < 3) {
      return {
        ...record,
        collectedAt: new Date().toISOString(),
        errorMessage: "웹사이트 URL이 비어있습니다",
      }
    }

    logger.info({ websiteUrl }, "[Lead Discovery] Processing lead enrichment")

    // 랜덤 지연 (봇 탐지 회피)
    const delay =
      Math.random() * (config.randomDelayMax - config.randomDelayMin) + config.randomDelayMin
    await new Promise((resolve) => setTimeout(resolve, delay))

    const crawlStartTime = Date.now()

    // 웹사이트 크롤링
    const { pagesContent, httpStatus } = await fetchWithDepth(
      websiteUrl,
      config.crawlDepth,
      config.timeoutSeconds,
    )

    const crawlElapsed = (Date.now() - crawlStartTime) / 1000

    if (pagesContent.size === 0) {
      return {
        ...record,
        httpStatus,
        crawlTimeSeconds: crawlElapsed,
        collectedAt: new Date().toISOString(),
        errorMessage: "웹사이트 콘텐츠를 가져오는데 실패했습니다",
      }
    }

    // GPT로 연락처 추출 (Lead Discovery 전용 함수 사용)
    const gptStartTime = Date.now()
    const contacts = await extractContactsForLeadDiscovery(pagesContent, config.gptTimeout)
    const gptElapsed = (Date.now() - gptStartTime) / 1000

    // 메모리 해제: pagesContent Map 정리
    pagesContent.clear()

    // 결과 병합
    const result: CompanyRecord = {
      ...record,
      ...contacts,
      httpStatus,
      crawlTimeSeconds: crawlElapsed,
      gptTimeSeconds: gptElapsed,
      collectedAt: new Date().toISOString(),
    }

    logger.info(
      {
        websiteUrl,
        hasEmail: !!result.email,
        hasPhone: !!result.phoneNumber,
        elapsed: (Date.now() - startTime) / 1000,
      },
      "[Lead Discovery] Lead enrichment completed",
    )

    return result
  } catch (error) {
    const elapsed = (Date.now() - startTime) / 1000
    logger.error({ error, websiteUrl }, "[Lead Discovery] Failed to process lead enrichment")
    return {
      ...record,
      crawlTimeSeconds: elapsed,
      collectedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 단일 회사 레코드 처리 (Web Extraction 전용)
 * Workspace API 키 사용, searchCriteria 지원
 */
export async function processCompanyRecord(
  record: CompanyRecord,
  config: WebExtractionConfig,
  workspaceId?: string,
  searchCriteria?: string[],
): Promise<CompanyRecord> {
  const startTime = Date.now()

  try {
    // 웹사이트 URL 확인
    if (!record.websiteUrl || record.websiteUrl.trim().length < 3) {
      return {
        ...record,
        collectedAt: new Date().toISOString(),
        errorMessage: "웹사이트 URL이 비어있습니다",
      }
    }

    // 랜덤 지연 (봇 탐지 회피)
    const delay =
      Math.random() * (config.randomDelayMax - config.randomDelayMin) + config.randomDelayMin
    await new Promise((resolve) => setTimeout(resolve, delay))

    const crawlStartTime = Date.now()

    // 깊이 크롤링
    const { pagesContent, httpStatus } = await fetchWithDepth(
      record.websiteUrl,
      config.crawlDepth,
      config.timeoutSeconds,
    )

    const crawlElapsed = (Date.now() - crawlStartTime) / 1000

    if (pagesContent.size === 0) {
      return {
        ...record,
        httpStatus,
        crawlTimeSeconds: crawlElapsed,
        collectedAt: new Date().toISOString(),
        errorMessage: "웹사이트 콘텐츠를 가져오는데 실패했습니다",
      }
    }

    // GPT로 연락처 추출 (Web Extraction 전용 함수 사용)
    const gptStartTime = Date.now()
    const contacts = await extractContactsWithGPT(
      pagesContent,
      config.gptTimeout,
      workspaceId,
      searchCriteria,
    )
    const gptElapsed = (Date.now() - gptStartTime) / 1000

    // 메모리 해제: pagesContent Map 정리
    pagesContent.clear()

    // 결과 병합
    const result: CompanyRecord = {
      ...record,
      ...contacts,
      httpStatus,
      crawlTimeSeconds: crawlElapsed,
      gptTimeSeconds: gptElapsed,
      collectedAt: new Date().toISOString(),
    }

    return result
  } catch (error) {
    const elapsed = (Date.now() - startTime) / 1000
    logger.error({ error, websiteUrl: record.websiteUrl }, "Failed to process company record")
    return {
      ...record,
      crawlTimeSeconds: elapsed,
      collectedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 일괄 처리 (동시성 제어)
 */
export async function processBatch(
  records: CompanyRecord[],
  config: WebExtractionConfig,
  progressCallback: (progress: ExtractionProgress) => void,
  workspaceId?: string,
  searchCriteria?: string[],
): Promise<CompanyRecord[]> {
  const startTime = Date.now()
  const results: CompanyRecord[] = []
  const logs: ProgressLog[] = []
  let processed = 0
  let success = 0
  let errors = 0
  let emailFound = 0
  let phoneFound = 0
  let addressFound = 0
  let socialFound = 0
  let gptRequests = 0
  let estimatedCost = 0 // 누적 예상 비용

  // 로그 추가 헬퍼 함수
  const addLog = (message: string, type: ProgressLog["type"]) => {
    const log: ProgressLog = {
      timestamp: Date.now(),
      message,
      type,
      processed,
      total: records.length,
    }
    logs.push(log)
    // 최대 500개 로그만 유지 (메모리 절약)
    if (logs.length > 500) {
      logs.shift()
    }
  }

  // 시작 로그
  addLog(`${records.length}개 웹사이트 데이터 추출 시작 (동시성: ${config.maxConcurrent})`, "info")

  // p-limit을 사용한 동시성 제어
  const limit = pLimit(config.maxConcurrent)

  // 모든 레코드를 동시성 제한과 함께 처리
  const promises = records.map((record, i) =>
    limit(async () => {
      const recordIndex = i + 1
      const displayName = record.websiteUrl

      try {
        // 처리 시작 로그
        addLog(`[${recordIndex}/${records.length}] ${displayName} 처리 시작...`, "info")

        const result = await processCompanyRecord(record, config, workspaceId, searchCriteria)
        processed++

        // 에러가 발생한 경우 결과에 포함하지 않음
        if (result.errorMessage) {
          errors++
          const httpStatusText = result.httpStatus ? `[${result.httpStatus}] ` : ""
          addLog(
            `[${recordIndex}/${records.length}] ${httpStatusText}✗ ${displayName}: ${result.errorMessage}`,
            "error",
          )

          // 진행 상황 콜백 (에러 정보만, latestResult는 포함하지 않음)
          const elapsed = (Date.now() - startTime) / 1000
          const itemsPerSecond = processed / elapsed
          const remaining = records.length - processed
          const estimatedTimeRemaining = remaining / itemsPerSecond

          progressCallback({
            status: "processing",
            total: records.length,
            processed,
            success,
            errors,
            emailFound,
            phoneFound,
            addressFound,
            socialFound,
            gptRequests,
            percentage: (processed / records.length) * 100,
            currentCompany: record.websiteUrl,
            elapsedTime: elapsed,
            estimatedTimeRemaining,
            itemsPerSecond,
            logs: [...logs], // 복사본 전달
            estimatedCost, // 누적 예상 비용
          })

          return null // 에러가 발생한 경우 null 반환
        }

        // 성공한 경우에만 결과에 추가
        results.push(result)

        // GPT 요청이 성공한 경우에만 비용 계산
        if (result.collectedAt) {
          gptRequests++
          // GPT API 비용 계산 (요청당 고정 비용)
          const inputCost =
            (GPT_COST_PER_REQUEST.INPUT_TOKENS / 1_000_000) *
            GPT_COST_PER_REQUEST.INPUT_PRICE_PER_MILLION
          const outputCost =
            (GPT_COST_PER_REQUEST.OUTPUT_TOKENS / 1_000_000) *
            GPT_COST_PER_REQUEST.OUTPUT_PRICE_PER_MILLION
          estimatedCost += inputCost + outputCost
        }

        // 통계 업데이트
        if (result.email) emailFound++
        if (result.phoneNumber) phoneFound++
        if (result.address) addressFound++
        if (result.facebookUrl || result.instagramUrl || result.twitterUrl || result.linkedinUrl) {
          socialFound++
        }

        // 성공 로그
        success++
        const details: string[] = []
        if (result.email) details.push("이메일")
        if (result.phoneNumber) details.push("전화")
        if (result.address) details.push("주소")
        const detailText = details.length > 0 ? ` (${details.join(", ")})` : ""
        const resultName = result.foundCompanyName || displayName
        const httpStatusText = result.httpStatus ? `[${result.httpStatus}] ` : ""
        addLog(
          `[${recordIndex}/${records.length}] ${httpStatusText}✓ ${resultName}${detailText}`,
          "success",
        )

        // 진행 상황 콜백 (성공한 결과만 포함)
        const elapsed = (Date.now() - startTime) / 1000
        const itemsPerSecond = processed / elapsed
        const remaining = records.length - processed
        const estimatedTimeRemaining = remaining / itemsPerSecond

        progressCallback({
          status: "processing",
          total: records.length,
          processed,
          success,
          errors,
          emailFound,
          phoneFound,
          addressFound,
          socialFound,
          gptRequests,
          percentage: (processed / records.length) * 100,
          currentCompany: result.foundCompanyName || record.websiteUrl,
          elapsedTime: elapsed,
          estimatedTimeRemaining,
          itemsPerSecond,
          logs: [...logs], // 복사본 전달
          latestResult: result, // 성공한 최신 결과만 포함
          estimatedCost, // 누적 예상 비용
        })

        return result
      } catch (error) {
        logger.error({ error, record }, "Failed to process record in batch")
        errors++
        processed++

        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        addLog(`[${recordIndex}/${records.length}] ✗ ${record.websiteUrl}: ${errorMsg}`, "error")

        // 진행 상황 콜백 (에러 정보만, latestResult는 포함하지 않음)
        const elapsed = (Date.now() - startTime) / 1000
        const itemsPerSecond = processed / elapsed
        const remaining = records.length - processed
        const estimatedTimeRemaining = remaining / itemsPerSecond

        progressCallback({
          status: "processing",
          total: records.length,
          processed,
          success,
          errors,
          emailFound,
          phoneFound,
          addressFound,
          socialFound,
          gptRequests,
          percentage: (processed / records.length) * 100,
          currentCompany: record.websiteUrl,
          elapsedTime: elapsed,
          estimatedTimeRemaining,
          itemsPerSecond,
          logs: [...logs], // 복사본 전달
          estimatedCost, // 누적 예상 비용
        })

        return null // 에러가 발생한 경우 null 반환
      }
    }),
  )

  // 모든 작업 완료 대기
  await Promise.all(promises)

  // 완료 로그
  addLog(`✓ 처리 완료: 성공 ${success}개, 실패 ${errors}개 (총 ${records.length}개)`, "success")

  // 최종 진행 상황
  const elapsed = (Date.now() - startTime) / 1000
  progressCallback({
    status: "completed",
    total: records.length,
    processed,
    success,
    errors,
    emailFound,
    phoneFound,
    addressFound,
    socialFound,
    gptRequests,
    percentage: 100,
    elapsedTime: elapsed,
    estimatedTimeRemaining: 0,
    itemsPerSecond: processed / elapsed,
    message: "처리 완료",
    logs: [...logs], // 최종 로그
    estimatedCost, // 최종 예상 비용
  })

  return results
}
