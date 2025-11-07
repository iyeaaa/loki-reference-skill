/**
 * Web Data Extraction Service
 * 웹사이트 크롤링 및 연락처 정보 추출
 */

import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import * as cheerio from "cheerio"
import type {
  CompanyRecord,
  ExtractedContacts,
  ExtractionProgress,
  FetchResult,
  WebExtractionConfig,
} from "../types/web-extraction.types"
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
 */
export async function fetchWithDepth(
  baseUrl: string,
  depth: number,
  timeoutSeconds: number,
): Promise<Map<string, string>> {
  const pagesContent = new Map<string, string>()

  try {
    // 첫 페이지 가져오기
    const firstPageResult = await fetchWebsiteContent(baseUrl, timeoutSeconds)
    if (firstPageResult.content) {
      pagesContent.set(baseUrl, firstPageResult.content)
    }

    if (depth === 0) {
      return pagesContent
    }

    // 메인 페이지에서 Contact/About 링크 찾기
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000)

    let normalizedUrl = baseUrl.trim()
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })

    clearTimeout(timeoutId)
    const html = await response.text()
    const $ = cheerio.load(html)

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

    // 추가 페이지 크롤링
    for (const link of links) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500)) // 짧은 지연
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

  return pagesContent
}

/**
 * GPT를 사용하여 연락처 정보 추출
 */
export async function extractContactsWithGPT(
  pagesContent: Map<string, string>,
  businessType: string,
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

비즈니스 타입: ${businessType || "N/A"}

웹사이트 콘텐츠:
${combinedContent.substring(0, 15000)}

다음 정보를 JSON 형식으로 추출해주세요 (찾을 수 없는 필드는 빈 문자열로):
{
  "companyName": "회사명",
  "foundCompanyName": "웹사이트에서 발견한 회사명 (있으면)",
  "nameUrlMatch": "URL과 회사명이 일치하는지 (yes/no/partial)",
  "isBusinessTypeMatched": "비즈니스 타입과 일치하는지 (yes/no/unknown)",
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
    const apiKey = workspaceId ? await getNextApiKey(workspaceId) : process.env.OPENAI_API_KEY || ""

    if (!apiKey) {
      return {
        errorMessage: "OpenAI API 키가 설정되지 않았습니다. 설정 페이지에서 API 키를 추가해주세요.",
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
    try {
      // ```json ... ``` 형식으로 감싸진 경우 제거
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      const jsonText = jsonMatch?.[1] ?? responseText

      const extracted: ExtractedContacts = JSON.parse(jsonText)
      return extracted
    } catch (parseError) {
      logger.error({ parseError, responseText }, "Failed to parse GPT response")
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
    const pagesContent = await fetchWithDepth(
      record.websiteUrl,
      config.crawlDepth,
      config.timeoutSeconds,
    )

    const crawlElapsed = (Date.now() - crawlStartTime) / 1000

    if (pagesContent.size === 0) {
      return {
        ...record,
        crawlTimeSeconds: crawlElapsed,
        collectedAt: new Date().toISOString(),
        errorMessage: "웹사이트 콘텐츠를 가져오는데 실패했습니다",
      }
    }

    // GPT로 연락처 추출
    const gptStartTime = Date.now()
    const contacts = await extractContactsWithGPT(
      pagesContent,
      record.businessType || "",
      config.gptTimeout,
      workspaceId,
    )
    const gptElapsed = (Date.now() - gptStartTime) / 1000

    // 결과 병합
    const result: CompanyRecord = {
      ...record,
      ...contacts,
      crawlTimeSeconds: crawlElapsed,
      gptTimeSeconds: gptElapsed,
      collectedAt: new Date().toISOString(),
    }

    // HTTP 상태는 첫 페이지에서 가져오기
    const firstPage = pagesContent.values().next()
    if (firstPage.value) {
      // statusCode는 별도로 저장되어 있지 않으므로 생략
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
  let processed = 0
  let success = 0
  let errors = 0
  let emailFound = 0
  let phoneFound = 0
  let addressFound = 0
  let socialFound = 0
  let gptRequests = 0

  // 동시성 제어를 위한 세마포어 패턴
  const queue: Promise<void>[] = []
  const maxConcurrent = config.maxConcurrent

  for (let i = 0; i < records.length; i++) {
    const record = records[i] as (typeof records)[0] & object

    const task = (async () => {
      try {
        const result = await processCompanyRecord(record, config, workspaceId)
        results.push(result)

        processed++
        gptRequests++

        // 통계 업데이트
        if (result.email) emailFound++
        if (result.phoneNumber) phoneFound++
        if (result.address) addressFound++
        if (result.facebookUrl || result.instagramUrl || result.twitterUrl || result.linkedinUrl) {
          socialFound++
        }

        if (!result.errorMessage) {
          success++
        } else {
          errors++
        }

        // 진행 상황 콜백
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
          currentCompany: record.companyName || record.websiteUrl,
          elapsedTime: elapsed,
          estimatedTimeRemaining,
          itemsPerSecond,
        })
      } catch (error) {
        logger.error({ error, record }, "Failed to process record in batch")
        errors++
        processed++
      }
    })()

    queue.push(task)

    // 동시 실행 수 제한
    if (queue.length >= maxConcurrent) {
      await Promise.race(queue)
      queue.splice(queue.indexOf(task), 1)
    }
  }

  // 모든 작업 완료 대기
  await Promise.all(queue)

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
  })

  return results
}
