/**
 * Web Data Extraction Routes
 * 웹사이트에서 회사 정보 및 연락처 추출 API
 */

import { Elysia, t } from "elysia"
import * as XLSX from "xlsx"
import { getActiveApiKeyCount } from "../services/openai-api-key.service"
// Lead Discovery용 서비스 (현재 버전 유지)
import { analyzeWebsiteWithStreaming, fetchWithDepth } from "../services/web-extraction.service"
// 웹데추용 Legacy 서비스 (v1.1 기반 - 안정화)
import {
  processBatchLegacy,
  processCompanyRecordLegacy,
} from "../services/web-extraction-legacy.service"
// BullMQ 기반 웹데추 서비스 (v2)
import {
  cancelExtraction,
  getExtractionProgress,
  getExtractionResults,
  getQueueStats,
  startWebExtraction,
  subscribeToProgress,
} from "../services/web-extraction-queue.service"
// Redis 기반 결과 저장 서비스
import {
  deleteResults as deleteResultsFromRedis,
  getAllResults as getResultsFromRedis,
  isRedisAvailable,
} from "../services/web-extraction-redis.service"
import {
  type CompanyRecord,
  DEFAULT_EXTRACTION_CONFIG,
  type ExtractionProgress,
} from "../types/web-extraction.types"
import logger from "../utils/logger"
import { createSSEResponse } from "../utils/sse-helper"

// 웹데추 v1.1 Legacy 설정
const LEGACY_CONFIG = {
  MAX_BATCH_SIZE: 2000, // 배치 크기 제한 (Redis 최적화로 2000개까지 지원)
  RECOMMENDED_BATCH_SIZE: 500, // 권장 배치 크기 (최적 성능)
  MAX_CONCURRENT: 20, // 동시 처리 수 (API 키 개수에 따라 자동 조정)
  MAX_FILE_SIZE_MB: 50, // 최대 파일 크기 (MB)
}

// 에러 코드 및 상세 메시지
const ERROR_CODES = {
  // 파일 관련 에러 (FILE_xxx)
  FILE_FORMAT_INVALID: {
    code: "FILE_FORMAT_INVALID",
    message: "지원하지 않는 파일 형식입니다",
    detail: "Excel 파일(.xlsx, .xls) 또는 CSV 파일(.csv)만 업로드 가능합니다.",
    suggestion: "파일 확장자를 확인하고 올바른 형식으로 다시 업로드해주세요.",
  },
  FILE_EMPTY: {
    code: "FILE_EMPTY",
    message: "파일에 데이터가 없습니다",
    detail: "업로드한 파일이 비어있거나 읽을 수 있는 데이터가 없습니다.",
    suggestion: "파일에 website_url 컬럼과 URL 데이터가 있는지 확인해주세요.",
  },
  FILE_SHEET_NOT_FOUND: {
    code: "FILE_SHEET_NOT_FOUND",
    message: "시트를 찾을 수 없습니다",
    detail: "Excel 파일에서 데이터 시트를 찾을 수 없습니다.",
    suggestion: "파일에 최소 하나의 시트가 있는지 확인해주세요.",
  },
  FILE_WORKSHEET_NOT_FOUND: {
    code: "FILE_WORKSHEET_NOT_FOUND",
    message: "워크시트를 읽을 수 없습니다",
    detail: "Excel 파일의 워크시트 데이터를 읽는 중 오류가 발생했습니다.",
    suggestion: "파일이 손상되지 않았는지 확인하거나 다른 Excel 프로그램으로 다시 저장해주세요.",
  },
  FILE_PARSE_ERROR: {
    code: "FILE_PARSE_ERROR",
    message: "파일 파싱 실패",
    detail: "파일 내용을 읽는 중 오류가 발생했습니다.",
    suggestion: "파일이 손상되지 않았는지 확인해주세요. CSV의 경우 UTF-8 인코딩을 권장합니다.",
  },

  // URL 관련 에러 (URL_xxx)
  URL_COLUMN_NOT_FOUND: {
    code: "URL_COLUMN_NOT_FOUND",
    message: "URL 컬럼을 찾을 수 없습니다",
    detail: "파일에서 website_url, websiteUrl, 또는 website 컬럼을 찾을 수 없습니다.",
    suggestion:
      "첫 번째 행에 'website_url', 'websiteUrl', 또는 'website' 컬럼명이 있는지 확인해주세요.",
  },
  URL_ALL_INVALID: {
    code: "URL_ALL_INVALID",
    message: "유효한 URL이 없습니다",
    detail: "파일의 모든 URL이 비어있거나 유효하지 않습니다.",
    suggestion: "URL 컬럼에 'https://example.com' 형식의 유효한 URL이 있는지 확인해주세요.",
  },

  // 배치 크기 관련 에러 (BATCH_xxx)
  BATCH_SIZE_EXCEEDED: {
    code: "BATCH_SIZE_EXCEEDED",
    message: "최대 처리 가능 URL 수 초과",
    detail: `한 번에 처리 가능한 최대 URL 수는 ${2000}개입니다.`,
    suggestion: "파일을 분할하여 업로드하거나, 대용량 처리를 위해 v2 API를 사용해주세요.",
  },
  BATCH_SIZE_WARNING: {
    code: "BATCH_SIZE_WARNING",
    message: "대용량 파일 경고",
    detail: "500개 이상의 URL은 처리 시간이 오래 걸릴 수 있습니다.",
    suggestion: "안정적인 네트워크 환경에서 처리하시고, 브라우저 탭을 닫지 마세요.",
  },

  // 시스템 관련 에러 (SYSTEM_xxx)
  REDIS_UNAVAILABLE: {
    code: "REDIS_UNAVAILABLE",
    message: "Redis 서버 연결 불가",
    detail:
      "결과 저장을 위한 Redis 서버에 연결할 수 없습니다. 메모리 모드로 동작하지만 대용량 처리 시 문제가 발생할 수 있습니다.",
    suggestion: "관리자에게 문의하거나 잠시 후 다시 시도해주세요.",
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    message: "내부 서버 오류",
    detail: "예상치 못한 오류가 발생했습니다.",
    suggestion: "잠시 후 다시 시도하거나 관리자에게 문의해주세요.",
  },
} as const

// 에러 응답 생성 헬퍼
function createErrorResponse(
  errorKey: keyof typeof ERROR_CODES,
  additionalInfo?: Record<string, unknown>,
) {
  const errorInfo = ERROR_CODES[errorKey]
  return {
    success: false,
    error: errorInfo.message,
    errorCode: errorInfo.code,
    detail: errorInfo.detail,
    suggestion: errorInfo.suggestion,
    ...additionalInfo,
  }
}

// Redis 기반 결과 저장 - 메모리 사용 최소화
// 결과는 Redis List에 저장되고 1시간 후 자동 삭제됨

export const webExtractionRoutes = new Elysia({ prefix: "/api/v1/admin/web-extraction" })
  /**
   * POST /api/v1/admin/web-extraction/lead-discovery/analyze
   * Lead Discovery 단일 웹사이트 URL 분석 (SSE로 스트리밍 응답 전송)
   */
  .post(
    "/lead-discovery/analyze",
    async ({ body }) => {
      const { websiteUrl, workspaceId } = body

      logger.info(
        {
          workspaceId,
          websiteUrl,
        },
        "Starting single website streaming analysis",
      )

      // URL 유효성 검사
      if (!websiteUrl || websiteUrl.trim().length < 3) {
        return {
          success: false,
          error: "유효한 웹사이트 URL을 입력해주세요",
        }
      }

      // SSE 스트림 생성
      return createSSEResponse(
        async (session) => {
          try {
            // 초기 연결 이벤트
            session.push({
              event: "connected",
              data: {
                type: "init",
                message: `${websiteUrl} 분석을 시작할게요`,
                timestamp: new Date().toISOString(),
              },
            })

            // 웹사이트 크롤링 (페이지 발견 시 실시간 알림)
            const { pagesContent } = await fetchWithDepth(
              websiteUrl.trim(),
              1, // depth
              30, // timeout
              (pageInfo) => {
                // 페이지 발견 이벤트 전송
                if (!session.closed) {
                  session.push({
                    event: "page_found",
                    data: {
                      type: "page_found",
                      url: pageInfo.url,
                      title: pageInfo.title,
                      contentLength: pageInfo.contentLength,
                      timestamp: new Date().toISOString(),
                    },
                  })
                }
              },
              (message) => {
                // 진행상황 메시지 전송
                if (!session.closed) {
                  session.push({
                    event: "progress",
                    data: {
                      type: "progress",
                      status: "crawling",
                      message,
                      timestamp: new Date().toISOString(),
                    },
                  })
                }
              },
            )

            if (pagesContent.size === 0) {
              throw new Error("앗, 웹사이트에 연결할 수 없어요. 주소를 다시 확인해주세요")
            }

            // GPT 분석 준비 알림
            session.push({
              event: "progress",
              data: {
                type: "progress",
                status: "analyzing",
                message: "AI가 분석을 시작해요",
                timestamp: new Date().toISOString(),
              },
            })

            // GPT 스트리밍 분석 시작
            const streamResult = await analyzeWebsiteWithStreaming(pagesContent, 60, workspaceId)

            // AI 응답 생성 시작 알림
            session.push({
              event: "progress",
              data: {
                type: "progress",
                status: "streaming",
                message: "분석 결과를 정리하고 있어요",
                timestamp: new Date().toISOString(),
              },
            })

            // 스트림 청크를 SSE로 전송
            logger.info("[Web Analysis] Starting to consume stream")
            let chunkCount = 0
            for await (const chunk of streamResult.textStream) {
              if (session.closed) {
                logger.info("[Web Analysis] Session closed, stopping stream")
                break
              }

              chunkCount++
              // 청크 전송 (DEBUG 로그 제거 - 너무 많은 로그 생성)
              session.push({
                event: "chunk",
                data: {
                  type: "chunk",
                  content: chunk,
                  timestamp: new Date().toISOString(),
                },
              })
            }

            logger.info({ totalChunks: chunkCount }, "[Web Analysis] Stream consumption completed")

            if (session.closed) return

            // 완료 메시지 전송
            session.push({
              event: "complete",
              data: {
                type: "complete",
                timestamp: new Date().toISOString(),
                message: "분석이 완료되었습니다",
              },
            })

            logger.info(
              {
                websiteUrl,
              },
              "[Web Analysis] Streaming completed",
            )

            await new Promise((resolve) => setTimeout(resolve, 100))
          } catch (error: unknown) {
            logger.error({ error }, "[Web Analysis] Stream error")
            session.push({
              event: "error",
              data: {
                type: "error",
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : "Analysis failed",
              },
            })
          }
        },
        {
          keepAlive: true,
          keepAliveInterval: 15000,
          onClose: () => {
            logger.info("[Web Analysis] Client disconnected")
          },
        },
      )
    },
    {
      body: t.Object({
        websiteUrl: t.String(),
        workspaceId: t.String(),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "단일 웹사이트 URL 분석 (SSE 스트리밍)",
        description:
          "단일 웹사이트 URL을 분석하여 AI가 생성한 상세 분석 결과를 스트리밍으로 전송합니다.",
      },
    },
  )

  /**
   * POST /api/v1/admin/web-extraction/analyze
   * 웹데추용 단일 웹사이트 URL 분석 (정형화된 JSON 응답)
   * Workspace API 키 사용
   */
  .post(
    "/analyze",
    async ({ body, set }) => {
      const { websiteUrl, workspaceId, searchCriteria } = body

      logger.info(
        {
          workspaceId,
          websiteUrl,
          searchCriteriaCount: searchCriteria?.length || 0,
        },
        "[Web Extraction] Starting single website analysis (structured)",
      )

      // URL 유효성 검사
      if (!websiteUrl || websiteUrl.trim().length < 3) {
        set.status = 400
        return {
          success: false,
          error: "유효한 웹사이트 URL을 입력해주세요",
        }
      }

      try {
        // processCompanyRecordLegacy 호출 (웹데추 v1.1 Legacy 버전)
        const result = await processCompanyRecordLegacy(
          { websiteUrl: websiteUrl.trim() },
          DEFAULT_EXTRACTION_CONFIG,
          workspaceId,
          searchCriteria,
        )

        // 에러가 있는 경우
        if (result.errorMessage) {
          return {
            success: false,
            error: result.errorMessage,
            data: {
              website_url: result.websiteUrl,
              http_status: result.httpStatus || null,
              crawl_time_seconds: result.crawlTimeSeconds || null,
            },
          }
        }

        // 성공 응답
        return {
          success: true,
          data: {
            website_url: result.websiteUrl,
            final_url: result.finalUrl || null,
            http_status: result.httpStatus || null,
            found_company_name: result.foundCompanyName || null,
            description: result.description || null,
            address: result.address || null,
            country: result.country || null,
            city: result.city || null,
            state: result.state || null,
            founded_year: result.foundedYear || null,
            phone_number: result.phoneNumber || null,
            email: result.email || null,
            facebook_url: result.facebookUrl || null,
            instagram_url: result.instagramUrl || null,
            twitter_url: result.twitterUrl || null,
            linkedin_url: result.linkedinUrl || null,
            employee_count: result.employeeCount || null,
            products: result.products || null,
            business_sectors: result.businessSectors || null,
            product_categories: result.productCategories || null,
            industry_types: result.industryTypes || null,
            custom_search_results: result.customSearchResults || null,
            crawl_time_seconds: result.crawlTimeSeconds || null,
            gpt_time_seconds: result.gptTimeSeconds || null,
            collected_at: result.collectedAt || null,
          },
        }
      } catch (error) {
        logger.error({ error, websiteUrl }, "Failed to analyze website")
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "분석 중 오류가 발생했습니다",
        }
      }
    },
    {
      body: t.Object({
        websiteUrl: t.String(),
        workspaceId: t.String(),
        searchCriteria: t.Optional(t.Array(t.String())),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "웹데추용 단일 웹사이트 URL 분석",
        description:
          "단일 웹사이트 URL을 분석하여 정형화된 회사 정보 및 연락처를 JSON으로 반환합니다.",
      },
    },
  )

  /**
   * POST /api/v1/admin/web-extraction/upload
   * Excel/CSV 파일 업로드 및 웹 데이터 추출 (SSE로 진행상황 전송)
   */
  .post(
    "/upload",
    async ({ body, set }) => {
      const { file, workspaceId, config } = body

      // Parse searchCriteria from JSON string if it exists
      let searchCriteria: string[] | undefined
      if (body.searchCriteria) {
        try {
          searchCriteria =
            typeof body.searchCriteria === "string"
              ? JSON.parse(body.searchCriteria)
              : body.searchCriteria
        } catch (error) {
          logger.error(
            { error, searchCriteria: body.searchCriteria },
            "Failed to parse searchCriteria",
          )
          searchCriteria = undefined
        }
      }

      logger.info(
        {
          workspaceId,
          fileSize: file.size,
          fileName: file.name,
          searchCriteriaCount: searchCriteria?.length || 0,
        },
        "Starting web data extraction",
      )

      // 파일 확장자 검증
      const fileName = file.name.toLowerCase()
      const isCSV = fileName.endsWith(".csv")
      const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")

      if (!isCSV && !isExcel) {
        set.status = 400
        return createErrorResponse("FILE_FORMAT_INVALID", {
          fileName: file.name,
          receivedExtension: fileName.split(".").pop() || "unknown",
        })
      }

      try {
        // 파일을 ArrayBuffer로 읽기
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // XLSX로 파싱
        const workbook = XLSX.read(buffer, { type: "buffer" })
        const sheetName = workbook.SheetNames[0]

        if (!sheetName) {
          set.status = 400
          return createErrorResponse("FILE_SHEET_NOT_FOUND", {
            fileName: file.name,
            availableSheets: workbook.SheetNames,
          })
        }

        const worksheet = workbook.Sheets[sheetName]

        if (!worksheet) {
          set.status = 400
          return createErrorResponse("FILE_WORKSHEET_NOT_FOUND", {
            fileName: file.name,
            sheetName,
          })
        }

        // JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

        if (jsonData.length === 0) {
          set.status = 400
          return createErrorResponse("FILE_EMPTY", {
            fileName: file.name,
            sheetName,
          })
        }

        logger.info({ recordCount: jsonData.length }, "Parsed Excel file")

        // CompanyRecord 배열로 변환
        const records: CompanyRecord[] = jsonData.map((row) => ({
          websiteUrl: String(row.website_url || row.websiteUrl || row.website || ""),
        }))

        // 빈 URL 제거
        const validRecords = records.filter((r) => r.websiteUrl && r.websiteUrl.trim().length > 0)

        // URL 컬럼 존재 여부 확인
        const firstRow = jsonData[0]
        const hasUrlColumn =
          firstRow &&
          ("website_url" in firstRow || "websiteUrl" in firstRow || "website" in firstRow)

        if (!hasUrlColumn) {
          set.status = 400
          return createErrorResponse("URL_COLUMN_NOT_FOUND", {
            fileName: file.name,
            availableColumns: firstRow ? Object.keys(firstRow) : [],
          })
        }

        if (validRecords.length === 0) {
          set.status = 400
          return createErrorResponse("URL_ALL_INVALID", {
            fileName: file.name,
            totalRows: jsonData.length,
          })
        }

        // 배치 크기 제한 (Redis 최적화로 2000개까지 지원)
        if (validRecords.length > LEGACY_CONFIG.MAX_BATCH_SIZE) {
          set.status = 400
          return createErrorResponse("BATCH_SIZE_EXCEEDED", {
            fileName: file.name,
            currentCount: validRecords.length,
            maxAllowed: LEGACY_CONFIG.MAX_BATCH_SIZE,
            recommendedAction: `파일을 ${Math.ceil(validRecords.length / LEGACY_CONFIG.RECOMMENDED_BATCH_SIZE)}개로 분할하거나 v2 API를 사용하세요.`,
          })
        }

        // 대용량 파일 경고 로그 (처리는 계속 진행)
        if (validRecords.length > LEGACY_CONFIG.RECOMMENDED_BATCH_SIZE) {
          logger.warn(
            {
              fileName: file.name,
              urlCount: validRecords.length,
              recommended: LEGACY_CONFIG.RECOMMENDED_BATCH_SIZE,
            },
            "[Web Extraction] Large batch detected - processing may take longer",
          )
        }

        // API 키 개수에 따른 동시성 설정 (API 키 1개당 20개씩 병렬 요청)
        const activeApiKeyCount = await getActiveApiKeyCount(workspaceId)
        // 최소 20, 최대 MAX_CONCURRENT(20)
        const defaultConcurrency = Math.min(
          activeApiKeyCount > 0 ? activeApiKeyCount * 20 : 20,
          LEGACY_CONFIG.MAX_CONCURRENT,
        )

        logger.info(
          {
            workspaceId,
            activeApiKeyCount,
            defaultConcurrency,
          },
          "Calculated concurrency based on API key count",
        )

        // 중복 제거 (설정에 따라)
        const extractionConfig = {
          ...DEFAULT_EXTRACTION_CONFIG,
          ...config,
          maxConcurrent: config?.maxConcurrent ?? defaultConcurrency,
        }
        let finalRecords = validRecords

        if (extractionConfig.deduplicateByUrl) {
          const seenUrls = new Set<string>()
          finalRecords = validRecords.filter((r) => {
            const url = r.websiteUrl.trim().toLowerCase()
            if (seenUrls.has(url)) {
              return false
            }
            seenUrls.add(url)
            return true
          })

          logger.info(
            {
              original: validRecords.length,
              deduplicated: finalRecords.length,
              removed: validRecords.length - finalRecords.length,
            },
            "Deduplicated by URL",
          )
        }

        // Redis에 저장할 jobId 미리 생성
        const jobId = `${workspaceId}-${Date.now()}`

        // Redis 가용성 확인
        const redisAvailable = isRedisAvailable()
        if (!redisAvailable) {
          logger.warn(
            { jobId, urlCount: finalRecords.length },
            "[Web Extraction] Redis unavailable - large batches may cause memory issues",
          )
        }

        logger.info(
          {
            finalRecords: finalRecords.length,
            maxConcurrent: extractionConfig.maxConcurrent,
            jobId,
            redisAvailable,
          },
          "[Web Extraction] Starting SSE stream with Redis storage",
        )

        // SSE 스트림 생성 (better-sse 패턴 적용)
        return createSSEResponse(
          async (session) => {
            try {
              // 초기 연결 이벤트 (Redis 상태 및 대용량 경고 포함)
              const initData: Record<string, unknown> = {
                type: "init",
                message: `${finalRecords.length}개의 웹사이트에서 데이터를 추출합니다`,
                timestamp: new Date().toISOString(),
                total: finalRecords.length,
                redisAvailable,
              }

              // 대용량 파일 경고 추가
              if (finalRecords.length > LEGACY_CONFIG.RECOMMENDED_BATCH_SIZE) {
                initData.warning = {
                  type: "LARGE_BATCH",
                  message: `${finalRecords.length}개의 URL을 처리합니다. 완료까지 시간이 걸릴 수 있습니다.`,
                  estimatedMinutes: Math.ceil((finalRecords.length * 3) / 60), // 약 3초/URL 추정
                }
              }

              // Redis 경고 추가
              if (!redisAvailable && finalRecords.length > 100) {
                initData.redisWarning = {
                  type: "REDIS_UNAVAILABLE",
                  message:
                    "Redis 서버에 연결할 수 없어 메모리 모드로 동작합니다. 대용량 처리 시 문제가 발생할 수 있습니다.",
                }
              }

              session.push({
                event: "connected",
                data: initData,
              })
              logger.info("[Web Extraction] Sent init event")

              // 추출 시작 (v1.1 Legacy 서비스 사용 - Redis에 결과 즉시 저장)
              await processBatchLegacy(
                finalRecords,
                extractionConfig,
                (progress: ExtractionProgress) => {
                  if (session.closed) return

                  try {
                    // 진행상황을 SSE로 전송 (최신 결과 포함)
                    const progressData: Record<string, unknown> = {
                      type: "progress",
                      timestamp: new Date().toISOString(),
                      status: progress.status,
                      total: progress.total,
                      processed: progress.processed,
                      success: progress.success,
                      errors: progress.errors,
                      emailFound: progress.emailFound,
                      phoneFound: progress.phoneFound,
                      addressFound: progress.addressFound,
                      socialFound: progress.socialFound,
                      gptRequests: progress.gptRequests,
                      percentage: progress.percentage,
                      currentCompany: progress.currentCompany,
                      elapsedTime: progress.elapsedTime,
                      estimatedTimeRemaining: progress.estimatedTimeRemaining,
                      itemsPerSecond: progress.itemsPerSecond,
                      logs: progress.logs,
                      estimatedCost: progress.estimatedCost || 0, // 예상 GPT API 비용
                    }

                    // 최신 결과가 있으면 포함
                    if (progress.latestResult) {
                      progressData.latestResult = {
                        website_url: progress.latestResult.websiteUrl,
                        final_url: progress.latestResult.finalUrl || null,
                        http_status: progress.latestResult.httpStatus || null,
                        found_company_name: progress.latestResult.foundCompanyName || null,
                        description: progress.latestResult.description || null,
                        address: progress.latestResult.address || null,
                        country: progress.latestResult.country || null,
                        city: progress.latestResult.city || null,
                        state: progress.latestResult.state || null,
                        founded_year: progress.latestResult.foundedYear || null,
                        phone_number: progress.latestResult.phoneNumber || null,
                        email: progress.latestResult.email || null,
                        facebook_url: progress.latestResult.facebookUrl || null,
                        instagram_url: progress.latestResult.instagramUrl || null,
                        twitter_url: progress.latestResult.twitterUrl || null,
                        linkedin_url: progress.latestResult.linkedinUrl || null,
                        employee_count: progress.latestResult.employeeCount || null,
                        products: progress.latestResult.products || null,
                        business_sectors: progress.latestResult.businessSectors || null,
                        product_categories: progress.latestResult.productCategories || null,
                        industry_types: progress.latestResult.industryTypes || null,
                        custom_search_results: progress.latestResult.customSearchResults || null,
                        crawl_time_seconds: progress.latestResult.crawlTimeSeconds || null,
                        gpt_time_seconds: progress.latestResult.gptTimeSeconds || null,
                        collected_at: progress.latestResult.collectedAt || null,
                        error_message: progress.latestResult.errorMessage || null,
                      }
                    }

                    session.push({
                      event: "progress",
                      data: progressData,
                    })
                    logger.debug(
                      { processed: progress.processed, total: progress.total },
                      "[Web Extraction] Sent progress",
                    )
                  } catch (err) {
                    logger.error({ err }, "[Web Extraction] Failed to send progress")
                  }
                },
                workspaceId,
                searchCriteria,
                jobId, // Redis 저장용 jobId 전달
              )

              if (session.closed) return

              // 완료 메시지 전송 (결과는 Redis에서 조회)
              session.push({
                event: "complete",
                data: {
                  type: "complete",
                  timestamp: new Date().toISOString(),
                  jobId,
                  totalRecords: finalRecords.length,
                  message: "웹 데이터 추출이 완료되었습니다",
                },
              })

              logger.info(
                {
                  totalRecords: finalRecords.length,
                  jobId,
                },
                "[Web Extraction] Sent complete message (results stored in Redis)",
              )

              // 클라이언트가 마지막 메시지를 처리할 시간 제공
              await new Promise((resolve) => setTimeout(resolve, 100))

              logger.info("[Web Extraction] Stream completed successfully")
            } catch (error: unknown) {
              logger.error({ error }, "[Web Extraction] Stream error")
              session.push({
                event: "error",
                data: {
                  type: "error",
                  timestamp: new Date().toISOString(),
                  error: error instanceof Error ? error.message : "Extraction failed",
                },
              })
            }
          },
          {
            keepAlive: true,
            keepAliveInterval: 15000,
            onClose: () => {
              logger.info("[Web Extraction] Client disconnected")
            },
          },
        )
      } catch (error: unknown) {
        logger.error({ error, fileName: file.name }, "Failed to parse file")
        set.status = 500
        return createErrorResponse("FILE_PARSE_ERROR", {
          fileName: file.name,
          errorDetail: error instanceof Error ? error.message : "Unknown error",
        })
      }
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: 50 * 1024 * 1024, // 50MB (MIME 타입 제한 제거 - 브라우저별로 다를 수 있음)
        }),
        workspaceId: t.String(),
        searchCriteria: t.Optional(t.Union([t.String(), t.Array(t.String())])), // Accept both string (JSON) and array
        config: t.Optional(
          t.Object({
            maxConcurrent: t.Optional(t.Number()),
            timeoutSeconds: t.Optional(t.Number()),
            gptTimeout: t.Optional(t.Number()),
            crawlDepth: t.Optional(t.Number()),
            deduplicateByUrl: t.Optional(t.Boolean()),
            expandEmailsToRows: t.Optional(t.Boolean()),
            randomDelayMin: t.Optional(t.Number()),
            randomDelayMax: t.Optional(t.Number()),
          }),
        ),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "Excel 또는 CSV 파일로 웹 데이터 추출 (SSE)",
        description:
          "Excel 또는 CSV 파일을 업로드하여 웹사이트에서 회사 정보 및 연락처를 추출합니다. 실시간 진행상황을 SSE로 전송합니다.",
      },
    },
  )

  /**
   * GET /api/v1/admin/web-extraction/results/:jobId
   * 추출 결과 다운로드 (Excel) - Redis에서 조회
   */
  .get(
    "/results/:jobId",
    async ({ params, set }) => {
      const { jobId } = params

      // Redis에서 결과 조회
      const results = await getResultsFromRedis(jobId)

      if (!results || results.length === 0) {
        set.status = 404
        return {
          success: false,
          error: "결과를 찾을 수 없습니다. Redis에 저장된 결과가 만료되었거나 존재하지 않습니다.",
        }
      }

      try {
        // Excel 생성
        const worksheet = XLSX.utils.json_to_sheet(
          results.map((r) => {
            const baseData: Record<string, unknown> = {
              website_url: r.websiteUrl,
              final_url: r.finalUrl || "",
              http_status: r.httpStatus || "",
              found_company_name: r.foundCompanyName || "",
              description: r.description || "",
              address: r.address || "",
              country: r.country || "",
              city: r.city || "",
              state: r.state || "",
              founded_year: r.foundedYear || "",
              phone_number: r.phoneNumber || "",
              email: r.email || "",
              facebook_url: r.facebookUrl || "",
              instagram_url: r.instagramUrl || "",
              twitter_url: r.twitterUrl || "",
              linkedin_url: r.linkedinUrl || "",
              employee_count: r.employeeCount || "",
              products: r.products || "",
              business_sectors: r.businessSectors || "",
              product_categories: r.productCategories || "",
              industry_types: r.industryTypes || "",
            }

            // Add custom search results as separate columns
            if (r.customSearchResults) {
              for (const [key, value] of Object.entries(r.customSearchResults)) {
                if (value && typeof value === "object" && "result" in value) {
                  baseData[`${key} (결과)`] = value.result || ""
                  baseData[`${key} (근거)`] =
                    value.reasons && Array.isArray(value.reasons) ? value.reasons.join(" | ") : ""
                } else {
                  // Fallback for old format
                  baseData[key] = String(value) || ""
                }
              }
            }

            baseData.crawl_time_seconds = r.crawlTimeSeconds || ""
            baseData.gpt_time_seconds = r.gptTimeSeconds || ""
            baseData.collected_at = r.collectedAt || ""
            baseData.error_message = r.errorMessage || ""

            return baseData
          }),
        )

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Results")

        const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

        set.headers["Content-Type"] =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        set.headers["Content-Disposition"] =
          `attachment; filename="web_extraction_results_${jobId}.xlsx"`

        return new Response(excelBuffer)
      } catch (error) {
        logger.error({ error, jobId }, "Failed to generate Excel file")
        set.status = 500
        return {
          success: false,
          error: "Excel 파일 생성 실패",
        }
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
    },
  )

  /**
   * GET /api/v1/admin/web-extraction/results/:jobId/json
   * 추출 결과 조회 (JSON) - Redis에서 조회
   */
  .get(
    "/results/:jobId/json",
    async ({ params, set }) => {
      const { jobId } = params

      // Redis에서 결과 조회
      const results = await getResultsFromRedis(jobId)

      if (!results || results.length === 0) {
        set.status = 404
        return {
          success: false,
          error: "결과를 찾을 수 없습니다. Redis에 저장된 결과가 만료되었거나 존재하지 않습니다.",
        }
      }

      return {
        success: true,
        data: results.map((r) => ({
          website_url: r.websiteUrl,
          final_url: r.finalUrl || null,
          http_status: r.httpStatus || null,
          found_company_name: r.foundCompanyName || null,
          description: r.description || null,
          address: r.address || null,
          country: r.country || null,
          city: r.city || null,
          state: r.state || null,
          founded_year: r.foundedYear || null,
          phone_number: r.phoneNumber || null,
          email: r.email || null,
          facebook_url: r.facebookUrl || null,
          instagram_url: r.instagramUrl || null,
          twitter_url: r.twitterUrl || null,
          linkedin_url: r.linkedinUrl || null,
          employee_count: r.employeeCount || null,
          products: r.products || null,
          business_sectors: r.businessSectors || null,
          product_categories: r.productCategories || null,
          industry_types: r.industryTypes || null,
          custom_search_results: r.customSearchResults || null,
          crawl_time_seconds: r.crawlTimeSeconds || null,
          gpt_time_seconds: r.gptTimeSeconds || null,
          collected_at: r.collectedAt || null,
          error_message: r.errorMessage || null,
        })),
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
    },
  )

  /**
   * DELETE /api/v1/admin/web-extraction/cleanup/:jobId
   * 작업 데이터 정리 (Redis에서 삭제)
   */
  .delete(
    "/cleanup/:jobId",
    async ({ params }) => {
      const { jobId } = params

      // Redis에서 결과 삭제
      await deleteResultsFromRedis(jobId)

      logger.info({ jobId }, "Cleaned up web extraction job data from Redis")

      return {
        success: true,
        message: "작업 데이터가 정리되었습니다",
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
    },
  )

  /**
   * POST /api/v1/admin/web-extraction/enrich-lead
   * Lead Enrichment용 빠른 이메일/회사정보 추출
   * 온보딩 및 Lead Discovery에 최적화 (Jina+Gemini 대체)
   *
   * 특징:
   * - 직접 크롤링 (Jina 대신 Cheerio) - 10초 타임아웃
   * - GPT-4o-mini 사용 (.env OPENAI_API_KEY)
   * - Hunter.io 폴백 지원
   */
  .post(
    "/enrich-lead",
    async ({ body, set }) => {
      const { websiteUrl, hunterApiKey, skipHunter, crawlDepth, timeoutSeconds } = body

      logger.info(
        {
          websiteUrl,
          skipHunter,
          crawlDepth,
          timeoutSeconds,
        },
        "[Lead Enrichment] Starting fast extraction",
      )

      // URL 유효성 검사
      if (!websiteUrl || websiteUrl.trim().length < 3) {
        set.status = 400
        return {
          success: false,
          error: "유효한 웹사이트 URL을 입력해주세요",
        }
      }

      try {
        // 동적 import로 순환 의존성 방지
        const { enrichLead } = await import("../services/lead-enrichment.service")

        const startTime = Date.now()

        const result = await enrichLead(websiteUrl.trim(), "", {
          hunterApiKey,
          skipHunter: skipHunter ?? !hunterApiKey,
        })

        const elapsedMs = Date.now() - startTime

        logger.info(
          {
            websiteUrl,
            emailCount: result.emails.length,
            hasDescription: !!result.companyInfo.description,
            elapsedMs,
          },
          "[Lead Enrichment] Extraction complete",
        )

        return {
          success: true,
          data: {
            domain: result.domain,
            emails: result.emails,
            companyInfo: result.companyInfo,
            socialLinks: result.socialLinks,
            elapsedMs,
          },
        }
      } catch (error) {
        logger.error({ error, websiteUrl }, "[Lead Enrichment] Extraction failed")
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "추출 중 오류가 발생했습니다",
        }
      }
    },
    {
      body: t.Object({
        websiteUrl: t.String(),
        hunterApiKey: t.Optional(t.String()),
        skipHunter: t.Optional(t.Boolean()),
        crawlDepth: t.Optional(t.Number()), // 0: 메인만, 1: Contact/About 포함
        timeoutSeconds: t.Optional(t.Number()),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "Lead Enrichment용 빠른 이메일/회사정보 추출",
        description:
          "웹사이트에서 이메일, 회사정보, 소셜링크를 빠르게 추출합니다. Jina+Gemini 대신 직접 크롤링+GPT-4o-mini를 사용하여 속도가 개선되었습니다.",
      },
    },
  )

  /**
   * POST /api/v1/admin/web-extraction/extract-email-quick
   * 이메일만 빠르게 추출 (온보딩 Lead Enrichment 최적화)
   */
  .post(
    "/extract-email-quick",
    async ({ body, set }) => {
      const { websiteUrl, hunterApiKey, skipHunter } = body

      if (!websiteUrl || websiteUrl.trim().length < 3) {
        set.status = 400
        return {
          success: false,
          error: "유효한 웹사이트 URL을 입력해주세요",
        }
      }

      try {
        const { enrichLead } = await import("../services/lead-enrichment.service")

        const startTime = Date.now()

        const enrichResult = await enrichLead(websiteUrl.trim(), "", {
          hunterApiKey,
          skipHunter: skipHunter ?? !hunterApiKey,
        })

        const elapsedMs = Date.now() - startTime

        // Extract first email from enrichment result
        const firstEmail = enrichResult.emails[0]
        const result = {
          email: firstEmail?.value || null,
          source: firstEmail?.type || null,
          confidence: firstEmail?.confidence || null,
        }

        logger.info(
          {
            websiteUrl,
            email: result.email ? "found" : "not found",
            source: result.source,
            elapsedMs,
          },
          "[Extract Email Quick] Complete",
        )

        return {
          success: true,
          data: {
            ...result,
            elapsedMs,
          },
        }
      } catch (error) {
        logger.error({ error, websiteUrl }, "[Extract Email Quick] Failed")
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "추출 중 오류가 발생했습니다",
        }
      }
    },
    {
      body: t.Object({
        websiteUrl: t.String(),
        hunterApiKey: t.Optional(t.String()),
        skipHunter: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "이메일만 빠르게 추출",
        description:
          "웹사이트에서 이메일만 빠르게 추출합니다. 온보딩 Lead Enrichment에 최적화되어 있습니다.",
      },
    },
  )

  // ============================================================================
  // BullMQ 기반 웹 추출 API (v2) - 장애 복구, 확장성 지원
  // ============================================================================

  /**
   * POST /api/v1/admin/web-extraction/v2/start
   * BullMQ 기반 웹 데이터 추출 시작
   */
  .post(
    "/v2/start",
    async ({ body, set }) => {
      const { file, workspaceId, searchCriteria, config } = body

      // 파일 확장자 확인
      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls") && !fileName.endsWith(".csv")) {
        set.status = 400
        return {
          success: false,
          error: "Excel 파일(.xlsx, .xls) 또는 CSV 파일(.csv)만 업로드 가능합니다",
        }
      }

      try {
        // 파일 파싱
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const workbook = XLSX.read(buffer, { type: "buffer" })
        const sheetName = workbook.SheetNames[0]

        if (!sheetName) {
          set.status = 400
          return { success: false, error: "시트를 찾을 수 없습니다" }
        }

        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) {
          set.status = 400
          return { success: false, error: "워크시트를 찾을 수 없습니다" }
        }

        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)
        if (jsonData.length === 0) {
          set.status = 400
          return { success: false, error: "파일에 데이터가 없습니다" }
        }

        // CompanyRecord 배열로 변환
        const records: CompanyRecord[] = jsonData.map((row) => ({
          websiteUrl: String(row.website_url || row.websiteUrl || row.website || ""),
        }))

        // 빈 URL 제거
        let validRecords = records.filter((r) => r.websiteUrl && r.websiteUrl.trim().length > 0)

        if (validRecords.length === 0) {
          set.status = 400
          return {
            success: false,
            error: "유효한 website_url이 없습니다. 컬럼명을 확인해주세요.",
          }
        }

        // 중복 제거
        const extractionConfig = { ...DEFAULT_EXTRACTION_CONFIG, ...config }
        if (extractionConfig.deduplicateByUrl) {
          const seenUrls = new Set<string>()
          validRecords = validRecords.filter((r) => {
            const url = r.websiteUrl.trim().toLowerCase()
            if (seenUrls.has(url)) return false
            seenUrls.add(url)
            return true
          })
        }

        // searchCriteria 파싱
        let parsedSearchCriteria: string[] | undefined
        if (searchCriteria) {
          if (typeof searchCriteria === "string") {
            try {
              parsedSearchCriteria = JSON.parse(searchCriteria)
            } catch {
              parsedSearchCriteria = [searchCriteria]
            }
          } else {
            parsedSearchCriteria = searchCriteria
          }
        }

        // BullMQ 기반 추출 시작
        const result = await startWebExtraction({
          workspaceId,
          records: validRecords,
          config: extractionConfig,
          searchCriteria: parsedSearchCriteria,
        })

        if (!result.success) {
          set.status = 500
          return result
        }

        logger.info(
          {
            batchJobId: result.batchJobId,
            totalRecords: result.totalRecords,
            workspaceId,
          },
          "[WebExtraction v2] Batch job started",
        )

        return result
      } catch (error) {
        logger.error({ error }, "[WebExtraction v2] Failed to start extraction")
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "추출 시작 실패",
        }
      }
    },
    {
      body: t.Object({
        file: t.File({ maxSize: 50 * 1024 * 1024 }),
        workspaceId: t.String(),
        searchCriteria: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        config: t.Optional(
          t.Object({
            maxConcurrent: t.Optional(t.Number()),
            timeoutSeconds: t.Optional(t.Number()),
            gptTimeout: t.Optional(t.Number()),
            crawlDepth: t.Optional(t.Number()),
            deduplicateByUrl: t.Optional(t.Boolean()),
            expandEmailsToRows: t.Optional(t.Boolean()),
            randomDelayMin: t.Optional(t.Number()),
            randomDelayMax: t.Optional(t.Number()),
          }),
        ),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "[v2] BullMQ 기반 웹 데이터 추출 시작",
        description:
          "BullMQ를 사용한 웹 데이터 추출입니다. 장애 복구, 확장성을 지원합니다. 진행상황은 /v2/progress/:batchJobId SSE 엔드포인트로 확인하세요.",
      },
    },
  )

  /**
   * GET /api/v1/admin/web-extraction/v2/progress/:batchJobId
   * BullMQ 배치 진행상황 조회 (SSE)
   */
  .get(
    "/v2/progress/:batchJobId",
    async ({ params }) => {
      const { batchJobId } = params

      return createSSEResponse(
        async (session) => {
          try {
            const abortController = new AbortController()

            // 클라이언트 연결 종료 시 정리
            session.closed && abortController.abort()

            for await (const progress of subscribeToProgress(batchJobId, abortController.signal)) {
              if (session.closed) break

              session.push({
                event: "progress",
                data: {
                  type: progress.status === "completed" ? "complete" : "progress",
                  timestamp: new Date().toISOString(),
                  ...progress,
                },
              })

              if (progress.status !== "processing") {
                // 완료/에러/취소 상태면 종료
                break
              }
            }
          } catch (error) {
            logger.error({ error, batchJobId }, "[WebExtraction v2] Progress stream error")
            session.push({
              event: "error",
              data: {
                type: "error",
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : "Progress stream failed",
              },
            })
          }
        },
        {
          keepAlive: true,
          keepAliveInterval: 15000,
          onClose: () => {
            logger.debug({ batchJobId }, "[WebExtraction v2] Progress stream closed")
          },
        },
      )
    },
    {
      params: t.Object({
        batchJobId: t.String(),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "[v2] 배치 진행상황 SSE 스트림",
        description: "Redis Pub/Sub를 통한 실시간 진행상황 업데이트를 SSE로 전달합니다.",
      },
    },
  )

  /**
   * GET /api/v1/admin/web-extraction/v2/status/:batchJobId
   * BullMQ 배치 상태 조회 (일회성)
   */
  .get(
    "/v2/status/:batchJobId",
    async ({ params, set }) => {
      const { batchJobId } = params

      const progress = await getExtractionProgress(batchJobId)

      if (!progress) {
        set.status = 404
        return {
          success: false,
          error: "배치 작업을 찾을 수 없습니다",
        }
      }

      return {
        success: true,
        data: progress,
      }
    },
    {
      params: t.Object({
        batchJobId: t.String(),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "[v2] 배치 상태 조회",
        description: "배치 작업의 현재 진행상황을 조회합니다.",
      },
    },
  )

  /**
   * GET /api/v1/admin/web-extraction/v2/results/:batchJobId
   * BullMQ 배치 결과 다운로드 (Excel)
   */
  .get(
    "/v2/results/:batchJobId",
    async ({ params, set }) => {
      const { batchJobId } = params

      const results = await getExtractionResults(batchJobId)

      if (!results || results.length === 0) {
        set.status = 404
        return {
          success: false,
          error: "결과를 찾을 수 없습니다",
        }
      }

      try {
        // Excel 생성
        const worksheet = XLSX.utils.json_to_sheet(
          results.map((r) => {
            const baseData: Record<string, unknown> = {
              website_url: r?.websiteUrl || "",
              http_status: r?.httpStatus || "",
              found_company_name: r?.foundCompanyName || "",
              description: r?.description || "",
              address: r?.address || "",
              phone_number: r?.phoneNumber || "",
              email: r?.email || "",
              facebook_url: r?.facebookUrl || "",
              instagram_url: r?.instagramUrl || "",
              twitter_url: r?.twitterUrl || "",
              linkedin_url: r?.linkedinUrl || "",
            }

            // Custom search results
            if (r?.customSearchResults) {
              for (const [key, value] of Object.entries(r.customSearchResults)) {
                if (value && typeof value === "object" && "result" in value) {
                  baseData[`${key} (결과)`] = value.result || ""
                  baseData[`${key} (근거)`] =
                    value.reasons && Array.isArray(value.reasons) ? value.reasons.join(" | ") : ""
                }
              }
            }

            baseData.crawl_time_seconds = r?.crawlTimeSeconds || ""
            baseData.gpt_time_seconds = r?.gptTimeSeconds || ""
            baseData.collected_at = r?.collectedAt || ""
            baseData.error_message = r?.errorMessage || ""

            return baseData
          }),
        )

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Results")

        const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

        set.headers["Content-Type"] =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        set.headers["Content-Disposition"] =
          `attachment; filename="web_extraction_v2_${batchJobId}.xlsx"`

        return new Response(excelBuffer)
      } catch (error) {
        logger.error({ error, batchJobId }, "[WebExtraction v2] Failed to generate Excel")
        set.status = 500
        return {
          success: false,
          error: "Excel 파일 생성 실패",
        }
      }
    },
    {
      params: t.Object({
        batchJobId: t.String(),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "[v2] 배치 결과 다운로드 (Excel)",
        description: "완료된 배치의 결과를 Excel 파일로 다운로드합니다.",
      },
    },
  )

  /**
   * GET /api/v1/admin/web-extraction/v2/results/:batchJobId/json
   * BullMQ 배치 결과 조회 (JSON)
   */
  .get(
    "/v2/results/:batchJobId/json",
    async ({ params, set }) => {
      const { batchJobId } = params

      const results = await getExtractionResults(batchJobId)

      if (!results) {
        set.status = 404
        return {
          success: false,
          error: "결과를 찾을 수 없습니다",
        }
      }

      return {
        success: true,
        data: results,
      }
    },
    {
      params: t.Object({
        batchJobId: t.String(),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "[v2] 배치 결과 조회 (JSON)",
        description: "완료된 배치의 결과를 JSON으로 조회합니다.",
      },
    },
  )

  /**
   * DELETE /api/v1/admin/web-extraction/v2/cancel/:batchJobId
   * BullMQ 배치 작업 취소
   */
  .delete(
    "/v2/cancel/:batchJobId",
    async ({ params }) => {
      const { batchJobId } = params

      await cancelExtraction(batchJobId)

      return {
        success: true,
        message: "배치 작업이 취소되었습니다",
      }
    },
    {
      params: t.Object({
        batchJobId: t.String(),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "[v2] 배치 작업 취소",
        description: "진행 중인 배치 작업을 취소합니다.",
      },
    },
  )

  /**
   * GET /api/v1/admin/web-extraction/v2/queue-stats
   * BullMQ 큐 통계
   */
  .get(
    "/v2/queue-stats",
    async () => {
      const stats = await getQueueStats()

      return {
        success: true,
        data: stats,
      }
    },
    {
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "[v2] 큐 통계",
        description: "BullMQ 웹 추출 큐의 현재 상태를 조회합니다.",
      },
    },
  )
