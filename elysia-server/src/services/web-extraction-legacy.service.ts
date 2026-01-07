/**
 * Web Data Extraction Service (Legacy v1.1)
 * 웹데추 전용 서비스 - Lead Discovery와 분리
 * 웹사이트 크롤링 및 연락처 정보 추출
 */

import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import * as cheerio from "cheerio"
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

    // 스크립트, 스타일, 주석 제거
    $("script, style, noscript").remove()
    $("*")
      .contents()
      .filter(function () {
        return this.type === "comment"
      })
      .remove()

    // 본문 텍스트 추출
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().substring(0, 50000)

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
 * 깊이 크롤링 (Contact, About 페이지 등) - v1.1 버전
 * 콜백 없이 단순하게 처리
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
    const $ = cheerio.load(html)

    // 스크립트, 스타일, 주석 제거
    $("script, style, noscript").remove()
    $("*")
      .contents()
      .filter(function () {
        return this.type === "comment"
      })
      .remove()

    // 본문 텍스트 추출
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().substring(0, 50000)

    if (bodyText) {
      pagesContent.set(normalizedUrl, bodyText)
    }

    // depth가 0이면 추가 크롤링 없이 반환
    if (depth === 0) {
      return { pagesContent, httpStatus }
    }

    // Contact, About 관련 링크 찾기
    const targetKeywords = ["contact", "about", "company", "team"]
    const links: string[] = []

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href")
      const text = $(element).text().toLowerCase()

      if (
        href &&
        targetKeywords.some((kw) => href.toLowerCase().includes(kw) || text.includes(kw))
      ) {
        try {
          const absoluteUrl = new URL(href, normalizedUrl).href
          if (links.length < 3 && !links.includes(absoluteUrl)) {
            links.push(absoluteUrl)
          }
        } catch {
          // Invalid URL, skip
        }
      }
    })

    // 추가 페이지 크롤링
    for (const link of links) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000)) // 1초 지연
        const pageResult = await fetchWebsiteContent(link, Math.floor(timeoutSeconds / 2))
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

    const crawlStartTime = Date.now()

    // 깊이 크롤링 (Legacy 버전)
    const { pagesContent, httpStatus } = await fetchWithDepthLegacy(
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

    // GPT로 연락처 추출
    const gptStartTime = Date.now()
    const contacts = await extractContactsWithGPTLegacy(
      pagesContent,
      config.gptTimeout,
      workspaceId,
      searchCriteria,
    )
    const gptElapsed = (Date.now() - gptStartTime) / 1000

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
 */
export async function processBatchLegacy(
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
  let estimatedCost = 0

  const addLog = (message: string, type: ProgressLog["type"]) => {
    const log: ProgressLog = {
      timestamp: Date.now(),
      message,
      type,
      processed,
      total: records.length,
    }
    logs.push(log)
    if (logs.length > 500) {
      logs.shift()
    }
  }

  addLog(
    `[Legacy v1.1] ${records.length}개 웹사이트 데이터 추출 시작 (동시성: ${config.maxConcurrent})`,
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
            logs: [...logs],
            estimatedCost,
          })

          return null
        }

        results.push(result)

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
          logs: [...logs],
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
          logs: [...logs],
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
    logs: [...logs],
    estimatedCost,
  })

  return results
}
