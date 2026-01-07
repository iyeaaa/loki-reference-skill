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
import {
  type CompanyRecord,
  DEFAULT_EXTRACTION_CONFIG,
  type ExtractionProgress,
} from "../types/web-extraction.types"
import logger from "../utils/logger"
import { createSSEResponse } from "../utils/sse-helper"

// 웹데추 v1.1 Legacy 설정
const LEGACY_CONFIG = {
  MAX_BATCH_SIZE: 10000, // 배치 크기 제한 해제 (실질적으로 무제한)
  MAX_CONCURRENT: 20, // 동시 처리 수 (API 키 개수에 따라 자동 조정)
}

// 추출 결과를 저장하는 Map (다운로드용) - TTL 기반 자동 정리
const resultsMap = new Map<string, CompanyRecord[]>()
const resultsTimestamps = new Map<string, number>()
const RESULTS_TTL_MS = 30 * 60 * 1000 // 30분 후 자동 삭제

// 메모리 정리: 오래된 결과 자동 삭제
function cleanupOldResults() {
  const now = Date.now()
  for (const [jobId, timestamp] of resultsTimestamps.entries()) {
    if (now - timestamp > RESULTS_TTL_MS) {
      resultsMap.delete(jobId)
      resultsTimestamps.delete(jobId)
      logger.info({ jobId }, "[Memory Cleanup] Auto-deleted old extraction results")
    }
  }
}

// 5분마다 정리 실행
setInterval(cleanupOldResults, 5 * 60 * 1000)

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
        return {
          success: false,
          error: "Excel 파일(.xlsx, .xls) 또는 CSV 파일(.csv)만 업로드 가능합니다",
        }
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
          return {
            success: false,
            error: "시트를 찾을 수 없습니다",
          }
        }

        const worksheet = workbook.Sheets[sheetName]

        if (!worksheet) {
          set.status = 400
          return {
            success: false,
            error: "워크시트를 찾을 수 없습니다",
          }
        }

        // JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

        if (jsonData.length === 0) {
          set.status = 400
          return {
            success: false,
            error: "파일에 데이터가 없습니다",
          }
        }

        logger.info({ recordCount: jsonData.length }, "Parsed Excel file")

        // CompanyRecord 배열로 변환
        const records: CompanyRecord[] = jsonData.map((row) => ({
          websiteUrl: String(row.website_url || row.websiteUrl || row.website || ""),
        }))

        // 빈 URL 제거
        const validRecords = records.filter((r) => r.websiteUrl && r.websiteUrl.trim().length > 0)

        if (validRecords.length === 0) {
          set.status = 400
          return {
            success: false,
            error: "유효한 website_url이 없습니다. 컬럼명을 확인해주세요.",
          }
        }

        // 배치 크기 제한 (v1.1 Legacy: 100개로 제한)
        if (validRecords.length > LEGACY_CONFIG.MAX_BATCH_SIZE) {
          set.status = 400
          return {
            success: false,
            error: `한 번에 처리 가능한 최대 URL 수는 ${LEGACY_CONFIG.MAX_BATCH_SIZE}개입니다. 현재 ${validRecords.length}개가 포함되어 있습니다. 파일을 분할하여 업로드해주세요.`,
          }
        }

        // API 키 개수에 따른 동시성 설정 (v1.1 Legacy: 최대 2개로 제한)
        const activeApiKeyCount = await getActiveApiKeyCount(workspaceId)
        const defaultConcurrency = Math.min(
          activeApiKeyCount > 0 ? activeApiKeyCount : 2,
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

        logger.info(
          {
            finalRecords: finalRecords.length,
            maxConcurrent: extractionConfig.maxConcurrent,
          },
          "[Web Extraction] Starting SSE stream with better-sse pattern",
        )

        // SSE 스트림 생성 (better-sse 패턴 적용)
        return createSSEResponse(
          async (session) => {
            try {
              // 초기 연결 이벤트
              session.push({
                event: "connected",
                data: {
                  type: "init",
                  message: `${finalRecords.length}개의 웹사이트에서 데이터를 추출합니다`,
                  timestamp: new Date().toISOString(),
                  total: finalRecords.length,
                },
              })
              logger.info("[Web Extraction] Sent init event")

              // 추출 시작 (v1.1 Legacy 서비스 사용)
              const results = await processBatchLegacy(
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
              )

              if (session.closed) return

              // 결과 저장 (다운로드를 위해) - TTL 타임스탬프와 함께 저장
              const jobId = `${workspaceId}-${Date.now()}`
              resultsMap.set(jobId, results)
              resultsTimestamps.set(jobId, Date.now())

              // 완료 메시지 전송
              session.push({
                event: "complete",
                data: {
                  type: "complete",
                  timestamp: new Date().toISOString(),
                  jobId,
                  totalRecords: results.length,
                  message: "웹 데이터 추출이 완료되었습니다",
                },
              })

              logger.info(
                {
                  totalRecords: results.length,
                  jobId,
                },
                "[Web Extraction] Sent complete message",
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
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to parse file",
        }
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
   * 추출 결과 다운로드 (Excel)
   */
  .get(
    "/results/:jobId",
    async ({ params, set }) => {
      const { jobId } = params

      const results = resultsMap.get(jobId)

      if (!results) {
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
   * 추출 결과 조회 (JSON)
   */
  .get(
    "/results/:jobId/json",
    async ({ params, set }) => {
      const { jobId } = params

      const results = resultsMap.get(jobId)

      if (!results) {
        set.status = 404
        return {
          success: false,
          error: "결과를 찾을 수 없습니다",
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
   * 작업 데이터 정리 (메모리 절약)
   */
  .delete(
    "/cleanup/:jobId",
    async ({ params }) => {
      const { jobId } = params

      resultsMap.delete(jobId)
      resultsTimestamps.delete(jobId)

      logger.info({ jobId }, "Cleaned up web extraction job data")

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
