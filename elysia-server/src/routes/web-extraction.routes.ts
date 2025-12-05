/**
 * Web Data Extraction Routes
 * 웹사이트에서 회사 정보 및 연락처 추출 API
 */

import { Elysia, t } from "elysia"
import * as XLSX from "xlsx"
import { getActiveApiKeyCount } from "../services/openai-api-key.service"
import {
  analyzeWebsiteWithStreaming,
  fetchWithDepth,
  processBatch,
} from "../services/web-extraction.service"
import {
  type CompanyRecord,
  DEFAULT_EXTRACTION_CONFIG,
  type ExtractionProgress,
} from "../types/web-extraction.types"
import logger from "../utils/logger"
import { createSSEResponse } from "../utils/sse-helper"

// 추출 결과를 저장하는 Map (다운로드용)
const resultsMap = new Map<string, CompanyRecord[]>()

export const webExtractionRoutes = new Elysia({ prefix: "/api/v1/admin/web-extraction" })
  /**
   * POST /api/v1/admin/web-extraction/analyze
   * 단일 웹사이트 URL 분석 (SSE로 스트리밍 응답 전송)
   */
  .post(
    "/analyze",
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

        // API 키 개수에 따른 동시성 설정
        const activeApiKeyCount = await getActiveApiKeyCount(workspaceId)
        const defaultConcurrency = activeApiKeyCount > 0 ? activeApiKeyCount * 20 : 20

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

              // 추출 시작
              const results = await processBatch(
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

              // 결과 저장 (다운로드를 위해)
              const jobId = `${workspaceId}-${Date.now()}`
              resultsMap.set(jobId, results)

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
