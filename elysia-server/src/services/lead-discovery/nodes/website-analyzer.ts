/**
 * Website Analyzer Node
 * Crawls and analyzes company website to extract business information
 * Streams analysis summary to frontend
 */

import { ChatOpenAI } from "@langchain/openai"
import type { NodeEventEmitter } from "../../chatbot/sse-context"
import { fetchWithDepth, type PageInfo } from "../../web-extraction.service"
import { leadDiscoveryLogger } from "../logger"
import type { LeadDiscoveryState, WebsiteAnalysis } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.3,
})

// 스트리밍용 LLM (더 빠른 응답)
const streamingLlm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.5,
  streaming: true,
})

// 스트리밍으로 분석 요약 생성
async function streamAnalysisSummary(
  analysis: WebsiteAnalysis,
  websiteUrl: string,
  emitter: NodeEventEmitter,
): Promise<string> {
  // 분석된 페이지 정보 정리
  const analyzedPagesInfo =
    analysis.analyzedPages
      ?.map((p) => `  - ${p.title || p.url} (${p.contentLength.toLocaleString()}자)`)
      .join("\n") || "없음"

  const prompt = `당신은 B2B 수출 바이어 발굴 전문가입니다. 아래 웹사이트 분석 결과를 바탕으로 이 회사의 제품/서비스에 관심을 가질 최적의 해외 바이어를 찾기 위한 상세 분석을 작성해주세요.

## 분석 대상 회사 정보

### 기본 정보
- 웹사이트: ${websiteUrl}
- 회사명: ${analysis.companyName || "알 수 없음"}
- 산업 분야: ${analysis.industry || "알 수 없음"}
- 비즈니스 모델: ${analysis.businessModel || "알 수 없음"}

### 제품/서비스
${analysis.products?.map((p) => `- ${p}`).join("\n") || "- 정보 없음"}

### 타겟 시장
${analysis.targetMarkets?.map((m) => `- ${m}`).join("\n") || "- 정보 없음"}

### 핵심 강점 및 차별화 포인트
${analysis.strengths?.map((s) => `- ${s}`).join("\n") || "- 정보 없음"}

### 회사 설명
${analysis.description || "정보 없음"}

### 분석된 페이지 목록
${analyzedPagesInfo}

## 작성 요구사항
위 정보를 종합하여 전문 컨설팅 보고서 형태로 작성해주세요.

## 보고서 구조 (Markdown 형식)

### 1. 기업 개요
- 회사 소개 및 핵심 사업 영역
- 주요 제품/서비스 라인업

### 2. 경쟁력 분석
- 핵심 강점 및 차별화 요소
- 기술력/품질 우위 사항

### 3. 타겟 바이어 프로파일
- 추천 산업군 및 근거
- 적합 기업 규모 (대기업/중견/중소)
- 유망 타겟 국가·지역 및 선정 이유

### 4. Value Proposition
- 해외 바이어 관점의 핵심 어필 포인트
- 거래 시 기대 효과

### 5. 수출 경쟁력 평가
- 글로벌 시장 경쟁력
- 성공 가능성 및 리스크 요인

## 작성 스타일
- 한국어로 작성
- 전문 컨설팅 업체의 보고서 어투 사용 (예: "~로 분석됨", "~할 것으로 판단됨", "~가 유효함")
- Markdown 문법 활용 (헤더, 볼드, 리스트 등)
- 객관적이고 분석적인 톤 유지
- 구체적인 데이터와 인사이트 기반 서술
- 각 섹션별 2-3문장 이상 충실히 작성

## 중요
- 코드 블록(\`\`\`markdown 또는 \`\`\`)으로 감싸지 마세요
- 마크다운 문법을 직접 사용하여 바로 작성하세요

분석 결과:`

  let accumulated = ""

  try {
    const stream = await streamingLlm.stream(prompt)

    for await (const chunk of stream) {
      const textContent = typeof chunk.content === "string" ? chunk.content : ""
      if (textContent) {
        accumulated += textContent
        emitter.textChunk("analyzeWebsite", textContent, accumulated)
      }
    }

    return accumulated
  } catch (error) {
    leadDiscoveryLogger.error(`[웹사이트 분석] 요약 스트리밍 실패: ${error}`)
    return ""
  }
}

// Extract structured analysis from website content
async function extractAnalysis(content: string, websiteUrl: string): Promise<WebsiteAnalysis> {
  const prompt = `Analyze the following website content and extract structured business information.

Website URL: ${websiteUrl}
Content:
${content.substring(0, 20000)}

Extract the following information in JSON format:
{
  "companyName": "Company name",
  "description": "Brief description of what the company does (2-3 sentences)",
  "industry": "Primary industry (e.g., Software, Healthcare, Manufacturing)",
  "products": ["List of main products or services"],
  "targetMarkets": ["Target markets or customer segments"],
  "businessModel": "B2B, B2C, B2B2C, etc.",
  "strengths": ["Key competitive advantages or unique selling points"]
}

Rules:
- Only include information you can confidently extract
- Use null for fields you cannot determine
- Keep descriptions concise
- Respond with JSON only, no markdown

JSON:`

  const response = await llm.invoke(prompt)
  const responseText = (response.content as string).trim()

  // Parse JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      companyName: parsed.companyName || undefined,
      description: parsed.description || undefined,
      industry: parsed.industry || undefined,
      products: parsed.products || undefined,
      targetMarkets: parsed.targetMarkets || undefined,
      businessModel: parsed.businessModel || undefined,
      strengths: parsed.strengths || undefined,
      rawContent: content.substring(0, 5000), // Store truncated raw content
    }
  }

  return {
    rawContent: content.substring(0, 5000),
  }
}

export async function analyzeWebsite(
  state: LeadDiscoveryState,
): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  const websiteUrl = state.websiteUrl

  if (!websiteUrl) {
    leadDiscoveryLogger.nodeError("analyzeWebsite", "No website URL provided", 0)
    return {
      error: "Website URL is required for analysis",
      analysisProgress: 0,
      analysisStatus: "Error: No URL provided",
    }
  }

  // 상세 로그: 분석 시작
  leadDiscoveryLogger.info(`[웹사이트 분석] 시작 - URL: ${websiteUrl}`)
  leadDiscoveryLogger.nodeStart("analyzeWebsite", { websiteUrl })
  leadDiscoveryLogger.websiteAnalysisStart(websiteUrl)

  if (emitter) {
    emitter.nodeStart("analyzeWebsite", `${websiteUrl} 분석을 시작할게요`)
  }

  try {
    // 수집된 페이지 목록
    const collectedPages: PageInfo[] = []

    // Progress callback for real-time updates (토스 스타일)
    const onProgress = (message: string) => {
      leadDiscoveryLogger.info(`[웹사이트 분석] ${websiteUrl} - ${message}`)
      if (emitter) {
        emitter.progress("analyzeWebsite", message)
      }
    }

    // Page found callback (토스 스타일 + 상세 로그)
    const onPageFound = (info: PageInfo) => {
      leadDiscoveryLogger.info(
        `[웹사이트 분석] 페이지 발견 - URL: ${info.url}, 제목: ${info.title || "(없음)"}, 콘텐츠: ${info.contentLength}자`,
      )
      collectedPages.push(info)

      if (emitter) {
        const displayTitle = info.title || new URL(info.url).pathname
        emitter.progress("analyzeWebsite", `${displayTitle} 페이지를 읽고 있어요`, undefined, {
          page: info,
          pages: collectedPages,
        })
      }
    }

    // Step 1: 웹사이트 연결 (10%)
    leadDiscoveryLogger.info(`[웹사이트 분석] Step 1/4 - ${websiteUrl}에 연결 중`)
    leadDiscoveryLogger.websiteAnalysisProgress("Crawling website", 10)
    if (emitter) {
      emitter.progress("analyzeWebsite", `${new URL(websiteUrl).hostname}에 연결하고 있어요`, 10)
    }

    const { pagesContent, httpStatus, pages, siteFavicon } = await fetchWithDepth(
      websiteUrl,
      1, // depth = 1 (main + contact/about pages)
      30, // timeout 30 seconds
      onPageFound,
      onProgress,
    )

    // 연결 결과 로그
    leadDiscoveryLogger.info(
      `[웹사이트 분석] 연결 완료 - HTTP ${httpStatus}, 발견된 페이지: ${pagesContent.size}개`,
    )

    if (pagesContent.size === 0) {
      const duration = Date.now() - startTime
      leadDiscoveryLogger.error(
        `[웹사이트 분석] 실패 - ${websiteUrl} 접근 불가 (HTTP ${httpStatus})`,
      )
      leadDiscoveryLogger.nodeError(
        "analyzeWebsite",
        `Failed to fetch: HTTP ${httpStatus}`,
        duration,
      )
      return {
        error: `웹사이트에 접근할 수 없어요 (HTTP ${httpStatus})`,
        analysisProgress: 0,
        analysisStatus: "Error: Could not access website",
      }
    }

    // Step 2: 콘텐츠 처리 (30%)
    leadDiscoveryLogger.info(
      `[웹사이트 분석] Step 2/4 - ${pagesContent.size}개 페이지 콘텐츠 처리 중`,
    )
    leadDiscoveryLogger.websiteAnalysisProgress("Processing content", 30)
    if (emitter) {
      emitter.progress(
        "analyzeWebsite",
        `${pagesContent.size}개 페이지에서 정보를 추출하고 있어요`,
        30,
      )
    }

    const combinedContent = Array.from(pagesContent.values()).join("\n\n---PAGE BREAK---\n\n")
    const totalContentLength = combinedContent.length
    leadDiscoveryLogger.info(
      `[웹사이트 분석] 콘텐츠 병합 완료 - 총 ${totalContentLength.toLocaleString()}자`,
    )

    // Step 3: AI 분석 (50%)
    leadDiscoveryLogger.info(`[웹사이트 분석] Step 3/4 - AI로 비즈니스 정보 분석 중`)
    leadDiscoveryLogger.websiteAnalysisProgress("Analyzing with AI", 50)
    if (emitter) {
      emitter.progress("analyzeWebsite", "AI가 회사 정보를 분석하고 있어요", 50)
    }

    const analysis = await extractAnalysis(combinedContent, websiteUrl)

    // 분석 결과 상세 로그
    leadDiscoveryLogger.info(`[웹사이트 분석] AI 분석 완료:`)
    leadDiscoveryLogger.info(`  - 회사명: ${analysis.companyName || "(추출 실패)"}`)
    leadDiscoveryLogger.info(`  - 산업: ${analysis.industry || "(추출 실패)"}`)
    leadDiscoveryLogger.info(`  - 비즈니스 모델: ${analysis.businessModel || "(추출 실패)"}`)
    leadDiscoveryLogger.info(`  - 제품/서비스: ${analysis.products?.join(", ") || "(추출 실패)"}`)
    leadDiscoveryLogger.info(
      `  - 타겟 마켓: ${analysis.targetMarkets?.join(", ") || "(추출 실패)"}`,
    )

    // Step 4: 분석 요약 스트리밍 (70%)
    let analysisSummary = ""
    if (emitter) {
      leadDiscoveryLogger.info(`[웹사이트 분석] Step 4/5 - 분석 요약 생성 및 스트리밍`)
      emitter.progress("analyzeWebsite", "분석 결과를 정리하고 있어요", 70)

      analysisSummary = await streamAnalysisSummary(analysis, websiteUrl, emitter)
      leadDiscoveryLogger.info(`[웹사이트 분석] 요약 스트리밍 완료: ${analysisSummary.length}자`)
    }

    // Step 5: 완료 (100%)
    const duration = Date.now() - startTime
    leadDiscoveryLogger.info(
      `[웹사이트 분석] Step 4/4 - 분석 완료 (소요시간: ${(duration / 1000).toFixed(1)}초)`,
    )
    leadDiscoveryLogger.websiteAnalysisProgress("Analysis complete", 100)
    leadDiscoveryLogger.websiteAnalysisComplete(websiteUrl, duration, analysis.companyName)

    // 분석 결과에 페이지 목록과 요약 추가
    const analysisWithPages: WebsiteAnalysis = {
      ...analysis,
      analyzedPages: pages,
      siteFavicon,
      summary: analysisSummary,
    }

    if (emitter) {
      const companyInfo = analysis.companyName
        ? `${analysis.companyName} 분석을 완료했어요`
        : "웹사이트 분석을 완료했어요"
      emitter.nodeComplete("analyzeWebsite", companyInfo, {
        companyName: analysis.companyName,
        industry: analysis.industry,
        pageCount: pagesContent.size,
        analyzedPages: pages,
        siteFavicon,
        summary: analysisSummary,
      })
    }

    leadDiscoveryLogger.nodeSuccess("analyzeWebsite", duration, {
      companyName: analysis.companyName || "Unknown",
      industry: analysis.industry || "Unknown",
      pagesCrawled: pagesContent.size,
    })

    return {
      websiteAnalysis: analysisWithPages,
      analysisProgress: 100,
      analysisStatus: `Analysis complete: ${analysis.companyName || "Company analyzed"}`,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    leadDiscoveryLogger.error(`[웹사이트 분석] 오류 발생 - ${websiteUrl}: ${errorMessage}`)
    leadDiscoveryLogger.nodeError("analyzeWebsite", errorMessage, duration)

    if (emitter) {
      emitter.error("analyzeWebsite", `분석 중 문제가 발생했어요: ${errorMessage}`)
    }

    return {
      error: `웹사이트 분석에 실패했어요: ${errorMessage}`,
      analysisProgress: 0,
      analysisStatus: `Error: ${errorMessage}`,
    }
  }
}
