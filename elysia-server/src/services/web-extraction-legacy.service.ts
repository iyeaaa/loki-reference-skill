/**
 * Web Data Extraction Service (Legacy v1.1)
 * 웹데추 전용 서비스 - Lead Discovery와 분리
 * 웹사이트 크롤링 및 연락처 정보 추출
 */

import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { Parser } from "htmlparser2"
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
import { addResult as addResultToRedis } from "./web-extraction-redis.service"

// Pre-check 타임아웃 (3초)
const PRE_CHECK_TIMEOUT_MS = 3000

/**
 * 고속 HTML 텍스트 추출 (htmlparser2 스트리밍 방식)
 * Cheerio DOM 생성 없이 텍스트만 추출 - 메모리 90% 절약, 속도 3-5배 향상
 */
function fastExtractText(html: string, maxLength: number = 50000): string {
  let text = ""
  let inScript = false
  let inStyle = false
  let inBody = false
  let bodyFound = false

  const parser = new Parser(
    {
      onopentag(name) {
        const tagName = name.toLowerCase()
        if (tagName === "body") {
          inBody = true
          bodyFound = true
        } else if (tagName === "script") {
          inScript = true
        } else if (tagName === "style") {
          inStyle = true
        }
      },
      ontext(data) {
        // body 내부이고 script/style이 아닌 경우만 텍스트 수집
        if (inBody && !inScript && !inStyle && text.length < maxLength) {
          const trimmed = data.trim()
          if (trimmed) {
            text += `${trimmed} `
          }
        }
      },
      onclosetag(name) {
        const tagName = name.toLowerCase()
        if (tagName === "body") {
          inBody = false
        } else if (tagName === "script") {
          inScript = false
        } else if (tagName === "style") {
          inStyle = false
        }
      },
    },
    { decodeEntities: true },
  )

  parser.write(html)
  parser.end()

  // body 태그가 없는 경우 전체 텍스트 추출 (fallback)
  if (!bodyFound) {
    text = ""
    inScript = false
    inStyle = false
    const fallbackParser = new Parser(
      {
        onopentag(name) {
          const tagName = name.toLowerCase()
          if (tagName === "script") inScript = true
          else if (tagName === "style") inStyle = true
        },
        ontext(data) {
          if (!inScript && !inStyle && text.length < maxLength) {
            const trimmed = data.trim()
            if (trimmed) text += `${trimmed} `
          }
        },
        onclosetag(name) {
          const tagName = name.toLowerCase()
          if (tagName === "script") inScript = false
          else if (tagName === "style") inStyle = false
        },
      },
      { decodeEntities: true },
    )
    fallbackParser.write(html)
    fallbackParser.end()
  }

  // 연속 공백 제거 및 길이 제한
  return text.replace(/\s+/g, " ").trim().substring(0, maxLength)
}

/**
 * 고속 링크 추출 (Cheerio 최소 사용)
 * 링크 추출에만 Cheerio 사용, 텍스트는 별도 처리
 */
function fastExtractLinks(html: string, baseUrl: string, maxLinks: number = 10): string[] {
  const links: string[] = []
  const baseHostname = new URL(baseUrl).hostname
  const EXCLUDE_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|json|zip|doc|docx|xls|xlsx)$/i

  // 정규식으로 href 추출 (Cheerio보다 빠름)
  const hrefRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null = hrefRegex.exec(html)

  while (match !== null && links.length < maxLinks) {
    const href = match[1]
    if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
      try {
        const absoluteUrl = new URL(href, baseUrl).href
        const linkHostname = new URL(absoluteUrl).hostname
        const pathname = new URL(absoluteUrl).pathname

        if (
          linkHostname === baseHostname &&
          !links.includes(absoluteUrl) &&
          absoluteUrl !== baseUrl &&
          pathname !== "/" &&
          !EXCLUDE_EXTENSIONS.test(pathname)
        ) {
          links.push(absoluteUrl)
        }
      } catch {
        // Invalid URL, skip
      }
    }
    match = hrefRegex.exec(html)
  }

  return links
}

/**
 * 웹사이트 접속 가능 여부 사전 체크 (3초 타임아웃)
 * HEAD 요청으로 빠르게 확인, 실패 시 GET 요청으로 재시도
 */
export async function preCheckWebsite(
  url: string,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    // URL 정규화
    let normalizedUrl = url.trim()
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PRE_CHECK_TIMEOUT_MS)

    try {
      // HEAD 요청으로 빠르게 확인
      const response = await fetch(normalizedUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        redirect: "follow",
      })

      clearTimeout(timeoutId)

      // 2xx, 3xx는 성공으로 처리
      if (response.status < 400) {
        return { success: true, statusCode: response.status }
      }

      // 4xx, 5xx는 실패
      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      }
    } catch {
      clearTimeout(timeoutId)

      // HEAD 요청 실패 시 GET 요청으로 재시도 (일부 서버는 HEAD를 지원하지 않음)
      const controller2 = new AbortController()
      const timeoutId2 = setTimeout(() => controller2.abort(), PRE_CHECK_TIMEOUT_MS)

      try {
        const response = await fetch(normalizedUrl, {
          method: "GET",
          signal: controller2.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "follow",
        })

        clearTimeout(timeoutId2)

        if (response.status < 400) {
          return { success: true, statusCode: response.status }
        }

        return {
          success: false,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
        }
      } catch (getError) {
        clearTimeout(timeoutId2)
        throw getError // GET도 실패하면 원래 에러 처리로
      }
    }
  } catch (error) {
    // AbortError = 타임아웃
    if (error instanceof Error && error.name === "AbortError") {
      logger.debug({ url }, "[PreCheck] Timeout after 3 seconds")
      return {
        success: false,
        error: "3초 내 접속 불가 (타임아웃)",
      }
    }

    // 기타 네트워크 에러
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    logger.debug({ url, error: errorMessage }, "[PreCheck] Connection failed")
    return {
      success: false,
      error: `접속 실패: ${errorMessage}`,
    }
  }
}

/**
 * 웹사이트에서 HTML 콘텐츠 가져오기 (고속 버전)
 * htmlparser2 스트리밍 방식으로 Cheerio 대비 3-5배 빠름
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

    // 고속 텍스트 추출 (Cheerio DOM 생성 없음)
    const bodyText = fastExtractText(html, 50000)

    return {
      content: bodyText,
      statusCode: response.status,
      finalUrl: response.url,
    }
  } catch (error) {
    logger.error({ error, url }, "[WebExtraction Legacy] Failed to fetch website content")
    return {
      content: "",
      statusCode: 0,
      finalUrl: url,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 깊이 크롤링 (Contact, About 페이지 등) - v1.1 고속 버전
 * htmlparser2 스트리밍 + 정규식 링크 추출로 Cheerio 대비 3-5배 빠름
 */
export async function fetchWithDepthLegacy(
  baseUrl: string,
  depth: number,
  timeoutSeconds: number,
): Promise<{ pagesContent: Map<string, string>; httpStatus: number }> {
  const pagesContent = new Map<string, string>()
  let httpStatus = 0

  try {
    // URL 정규화
    let normalizedUrl = baseUrl.trim()
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    // 첫 페이지 가져오기
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

    const html = await response.text()

    // 고속 텍스트 추출 (Cheerio DOM 생성 없음)
    const bodyText = fastExtractText(html, 50000)

    if (bodyText) {
      pagesContent.set(normalizedUrl, bodyText)
    }

    // depth가 0이면 추가 크롤링 없이 반환
    if (depth === 0) {
      return { pagesContent, httpStatus }
    }

    // 고속 링크 추출 (정규식 사용, Cheerio 없음)
    const MAX_PAGES = 10
    const links = fastExtractLinks(html, normalizedUrl, MAX_PAGES)

    // 추가 페이지 크롤링 (각 요청 3초 타임아웃, 1초 지연)
    for (const link of links) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000)) // 1초 지연
        const pageResult = await fetchWebsiteContent(link, 3)
        if (pageResult.content) {
          pagesContent.set(link, pageResult.content)
        }
      } catch (error) {
        logger.debug({ error, link }, "[WebExtraction Legacy] Failed to fetch additional page")
      }
    }
  } catch (error) {
    logger.error({ error, baseUrl }, "[WebExtraction Legacy] Failed to fetch with depth")
  }

  return { pagesContent, httpStatus }
}

/**
 * GPT를 사용하여 연락처 정보 추출
 */
export async function extractContactsWithGPTLegacy(
  pagesContent: Map<string, string>,
  gptTimeout: number,
  workspaceId?: string,
  searchCriteria?: string[],
): Promise<ExtractedContacts> {
  try {
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
            `${index + 1}. "${criterion}" - 이 조건에 해당하는지 판단하고 "true" 또는 "false"로 답변해주세요. 또한 판단의 근거가 되는 구체적인 사실 3가지를 제시해주세요.`,
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

중요: 반드시 유효한 JSON만 반환하고, 추가 설명은 포함하지 마세요.`

    // Workspace에 설정된 API 키 가져오기
    const apiKey = workspaceId ? await getNextApiKey(workspaceId) : null

    if (!apiKey) {
      logger.error({ workspaceId }, "[WebExtraction Legacy] No API key available")
      return {
        errorMessage: "워크스페이스에 OpenAI API 키가 등록되어 있지 않습니다.",
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

    // JSON 파싱
    let jsonText = responseText.trim()

    if (jsonText.startsWith("`") && jsonText.includes("}")) {
      const startIdx = jsonText.indexOf("{")
      const endIdx = jsonText.lastIndexOf("}")
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonText = jsonText.substring(startIdx, endIdx + 1)
      }
    }

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
        },
        "[WebExtraction Legacy] Failed to parse GPT response",
      )
      return {
        errorMessage: "GPT 응답을 파싱하는데 실패했습니다",
      }
    }
  } catch (error) {
    logger.error({ error }, "[WebExtraction Legacy] Failed to extract contacts with GPT")
    return {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 단일 회사 레코드 처리
 */
export async function processCompanyRecordLegacy(
  record: CompanyRecord,
  config: WebExtractionConfig,
  workspaceId?: string,
  searchCriteria?: string[],
): Promise<CompanyRecord> {
  const startTime = Date.now()

  try {
    if (!record.websiteUrl || record.websiteUrl.trim().length < 3) {
      return {
        ...record,
        collectedAt: new Date().toISOString(),
        errorMessage: "웹사이트 URL이 비어있습니다",
      }
    }

    // Pre-check 제거 - fetchWithDepthLegacy에서 한 번에 처리
    // 타임아웃 3초로 단축 (각 HTTP 요청당)
    const crawlStartTime = Date.now()
    const crawlTimeout = 3

    // 깊이 크롤링 (Legacy 버전)
    const { pagesContent, httpStatus } = await fetchWithDepthLegacy(
      record.websiteUrl,
      config.crawlDepth,
      crawlTimeout,
    )

    const crawlElapsed = (Date.now() - crawlStartTime) / 1000

    // HTTP 4xx/5xx 에러 체크 (Pre-check 대체)
    if (httpStatus >= 400) {
      pagesContent.clear() // 메모리 해제
      return {
        ...record,
        httpStatus,
        crawlTimeSeconds: crawlElapsed,
        collectedAt: new Date().toISOString(),
        errorMessage: `HTTP ${httpStatus} 에러`,
      }
    }

    if (pagesContent.size === 0) {
      pagesContent.clear() // 메모리 해제
      return {
        ...record,
        httpStatus,
        crawlTimeSeconds: crawlElapsed,
        collectedAt: new Date().toISOString(),
        errorMessage:
          httpStatus === 0
            ? "웹사이트 접속 실패 (타임아웃)"
            : "웹사이트 콘텐츠를 가져오는데 실패했습니다",
      }
    }

    // GPT로 연락처 추출
    const gptStartTime = Date.now()
    const contacts = await extractContactsWithGPTLegacy(
      pagesContent,
      config.gptTimeout,
      workspaceId,
      searchCriteria,
    )
    const gptElapsed = (Date.now() - gptStartTime) / 1000

    // 메모리 해제: GPT 추출 완료 후 pagesContent 즉시 정리
    pagesContent.clear()

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
    logger.error(
      { error, websiteUrl: record.websiteUrl },
      "[WebExtraction Legacy] Failed to process company record",
    )
    return {
      ...record,
      crawlTimeSeconds: elapsed,
      collectedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 일괄 처리 (동시성 제어) - v1.1 버전
 * 동시성을 낮게 유지하여 안정성 확보
 * Redis 기반 결과 저장으로 메모리 사용량 최적화
 */
export async function processBatchLegacy(
  records: CompanyRecord[],
  config: WebExtractionConfig,
  progressCallback: (progress: ExtractionProgress) => void,
  workspaceId?: string,
  searchCriteria?: string[],
  jobId?: string, // Redis 저장용 jobId
): Promise<CompanyRecord[]> {
  const startTime = Date.now()
  const logs: ProgressLog[] = []
  let processed = 0
  let success = 0
  let errors = 0
  let emailFound = 0
  let phoneFound = 0
  let addressFound = 0
  let socialFound = 0
  let gptRequests = 0
  let estimatedCost = 0

  logger.info({ jobId }, "[WebExtraction Legacy] Using Redis for result storage (memory optimized)")

  const addLog = (message: string, type: ProgressLog["type"]) => {
    const log: ProgressLog = {
      timestamp: Date.now(),
      message,
      type,
      processed,
      total: records.length,
    }
    logs.push(log)
    // 메모리 최적화: 최대 100개만 유지
    if (logs.length > 100) {
      logs.shift()
    }
  }

  // 메모리 최적화: 최근 로그만 반환하는 헬퍼
  const getRecentLogs = () => logs.slice(-20)

  addLog(
    `[Legacy v1.1] ${records.length}개 웹사이트 데이터 추출 시작 (동시성: ${config.maxConcurrent}, Redis 저장)`,
    "info",
  )

  // p-limit을 사용한 동시성 제어
  const limit = pLimit(config.maxConcurrent)

  const promises = records.map((record, i) =>
    limit(async () => {
      const recordIndex = i + 1
      const displayName = record.websiteUrl

      try {
        addLog(`[${recordIndex}/${records.length}] ${displayName} 처리 시작...`, "info")

        const result = await processCompanyRecordLegacy(record, config, workspaceId, searchCriteria)
        processed++

        if (result.errorMessage) {
          errors++
          const httpStatusText = result.httpStatus ? `[${result.httpStatus}] ` : ""
          addLog(
            `[${recordIndex}/${records.length}] ${httpStatusText}✗ ${displayName}: ${result.errorMessage}`,
            "error",
          )

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
            logs: getRecentLogs(),
            estimatedCost,
          })

          return null
        }

        // Redis에 즉시 저장 - 메모리에서 해제됨
        if (jobId) {
          await addResultToRedis(jobId, result)
        }

        if (result.collectedAt) {
          gptRequests++
          const inputCost =
            (GPT_COST_PER_REQUEST.INPUT_TOKENS / 1_000_000) *
            GPT_COST_PER_REQUEST.INPUT_PRICE_PER_MILLION
          const outputCost =
            (GPT_COST_PER_REQUEST.OUTPUT_TOKENS / 1_000_000) *
            GPT_COST_PER_REQUEST.OUTPUT_PRICE_PER_MILLION
          estimatedCost += inputCost + outputCost
        }

        if (result.email) emailFound++
        if (result.phoneNumber) phoneFound++
        if (result.address) addressFound++
        if (result.facebookUrl || result.instagramUrl || result.twitterUrl || result.linkedinUrl) {
          socialFound++
        }

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
          logs: getRecentLogs(),
          latestResult: result,
          estimatedCost,
        })

        return result
      } catch (error) {
        logger.error({ error, record }, "[WebExtraction Legacy] Failed to process record in batch")
        errors++
        processed++

        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        addLog(`[${recordIndex}/${records.length}] ✗ ${record.websiteUrl}: ${errorMsg}`, "error")

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
          logs: getRecentLogs(),
          estimatedCost,
        })

        return null
      }
    }),
  )

  await Promise.all(promises)

  addLog(`✓ 처리 완료: 성공 ${success}개, 실패 ${errors}개 (총 ${records.length}개)`, "success")

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
    logs: getRecentLogs(),
    estimatedCost,
  })

  // 결과는 Redis에서 조회 (빈 배열 반환)
  return []
}
