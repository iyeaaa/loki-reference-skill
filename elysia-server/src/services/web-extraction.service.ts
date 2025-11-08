/**
 * Web Data Extraction Service
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
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().substring(0, 50000) // GPT 토큰 제한을 고려하여 50KB로 제한

    return {
      content: bodyText,
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
 */
export async function fetchWithDepth(
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

    // Contact, About 관련 링크 찾기 (이미 로드된 HTML에서 추출)
    const targetKeywords = ["contact", "about", "company", "team"]
    const links: string[] = []

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href")
      const text = $(element).text().toLowerCase()

      if (
        href &&
        targetKeywords.some((kw) => href.toLowerCase().includes(kw) || text.includes(kw))
      ) {
        // 상대 경로를 절대 경로로 변환
        try {
          const absoluteUrl = new URL(href, normalizedUrl).href
          if (links.length < 3 && !links.includes(absoluteUrl)) {
            // 최대 3개까지만
            links.push(absoluteUrl)
          }
        } catch (_e) {
          // Invalid URL, skip
        }
      }
    })

    // 추가 페이지 크롤링 (더 긴 딜레이 적용 - tmp/csv-tools와 동일하게 3~4초)
    for (const link of links) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 3500)) // 3.5초 지연 (Go 코드의 3~4.5초와 유사)
        const pageResult = await fetchWebsiteContent(link, Math.floor(timeoutSeconds / 2))
        if (pageResult.content) {
          pagesContent.set(link, pageResult.content)
        }
      } catch (error) {
        logger.debug({ error, link }, "Failed to fetch additional page")
      }
    }
  } catch (error) {
    logger.error({ error, baseUrl }, "Failed to fetch with depth")
  }

  return { pagesContent, httpStatus }
}

/**
 * GPT를 사용하여 연락처 정보 추출
 */
export async function extractContactsWithGPT(
  pagesContent: Map<string, string>,
  gptTimeout: number,
  workspaceId?: string,
): Promise<ExtractedContacts> {
  try {
    // 모든 페이지 내용 합치기
    const combinedContent = Array.from(pagesContent.values()).join("\n\n")

    if (!combinedContent || combinedContent.length < 50) {
      return {
        errorMessage: "웹사이트 콘텐츠가 너무 짧거나 비어있습니다",
      }
    }

    const prompt = `다음 웹사이트 콘텐츠에서 회사 정보와 연락처를 추출해주세요.

웹사이트 콘텐츠:
${combinedContent.substring(0, 15000)}

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
  "industryTypes": "산업 유형 (쉼표로 구분)"
}

중요: 반드시 유효한 JSON만 반환하고, 추가 설명은 포함하지 마세요.`

    // Workspace에 설정된 API 키 가져오기 (round-robin)
    const apiKey = workspaceId ? await getNextApiKey(workspaceId) : null

    if (!apiKey) {
      logger.error({ workspaceId }, "No API key available for GPT extraction")
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
 * 단일 회사 레코드 처리
 */
export async function processCompanyRecord(
  record: CompanyRecord,
  config: WebExtractionConfig,
  workspaceId?: string,
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

    // GPT로 연락처 추출
    const gptStartTime = Date.now()
    const contacts = await extractContactsWithGPT(pagesContent, config.gptTimeout, workspaceId)
    const gptElapsed = (Date.now() - gptStartTime) / 1000

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

        const result = await processCompanyRecord(record, config, workspaceId)
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
