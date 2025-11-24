/**
 * Gemini File Search Routes
 * Google Gemini File Search API를 사용한 리드 검색 엔드포인트
 */

import { Elysia, t } from "elysia"
import * as geminiService from "../services/gemini-file-search.service"
import * as driveService from "../services/google-drive.service"
import type { LeadSearchRequest, UploadCSVRequest } from "../types/gemini-file-search.types"
import { ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

// Request validation schemas
const uploadCSVSchema = t.Object({
  file: t.File({
    type: [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
  }),
  workspaceId: t.String({ format: "uuid" }),
  storeName: t.Optional(t.String()),
  metadata: t.Optional(
    t.Object({
      country: t.Optional(t.String()),
      region: t.Optional(t.String()),
      vertical: t.Optional(t.String()),
      source: t.Optional(t.String()),
      dbVersion: t.Optional(t.String()),
    }),
  ),
})

const searchLeadsSchema = t.Object({
  workspaceId: t.String({ format: "uuid" }),
  query: t.String({ minLength: 1 }),
  filters: t.Optional(
    t.Object({
      country: t.Optional(t.String()),
      region: t.Optional(t.String()),
      vertical: t.Optional(t.String()),
      dbVersion: t.Optional(t.String()),
    }),
  ),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 200 })),
  storeNames: t.Optional(t.Array(t.String())),
})

const estimateCostSchema = t.Object({
  csvSizeBytes: t.Number({ minimum: 1 }),
  expectedSearchesPerMonth: t.Number({ minimum: 1 }),
})

// Response schemas
const uploadResponseSchema = t.Object({
  success: t.Boolean(),
  storeName: t.String(),
  fileName: t.String(),
  fileId: t.String(),
  totalRows: t.Number(),
  message: t.String(),
  metadata: t.Optional(t.Record(t.String(), t.String())),
})

// CSV 컬럼명을 동적으로 수용하기 위해 Record 타입 사용
const leadResultSchema = t.Record(
  t.String(),
  t.Union([t.String(), t.Number(), t.Boolean(), t.Null(), t.Undefined()]),
)

const searchResponseSchema = t.Object({
  success: t.Boolean(),
  query: t.String(),
  results: t.Array(leadResultSchema),
  totalResults: t.Number(),
  explanation: t.Optional(t.String()),
  processingTime: t.Number(),
})

const listStoresResponseSchema = t.Object({
  success: t.Boolean(),
  stores: t.Array(
    t.Object({
      name: t.String(),
      displayName: t.String(),
      fileCount: t.Number(),
      createTime: t.String(),
      updateTime: t.String(),
    }),
  ),
  total: t.Number(),
})

const costEstimateResponseSchema = t.Object({
  indexingCost: t.Number(),
  monthlyCost: t.Number(),
  costPerSearch: t.Number(),
})

// Error response schema
const errorResponseSchema = t.Object({
  success: t.Literal(false),
  code: t.String(),
  message: t.String(),
  timestamp: t.String(),
})

export const geminiFileSearchRoutes = new Elysia({
  prefix: "/api/v1/admin/gemini-search",
  tags: ["Gemini File Search"],
})
  /**
   * POST /api/v1/admin/gemini-search/upload
   * CSV 파일을 Gemini File Search에 업로드
   */
  .post(
    "/upload",
    async ({ body, set }) => {
      try {
        const request: UploadCSVRequest = {
          workspaceId: body.workspaceId,
          file: body.file,
          storeName: body.storeName,
          metadata: body.metadata,
        }

        logger.info(
          {
            workspaceId: body.workspaceId,
            fileName: body.file.name,
            fileSize: body.file.size,
          },
          "Uploading CSV to Gemini File Search",
        )

        const result = await geminiService.uploadCSVToGemini(request)

        set.status = 201
        return {
          success: true as const,
          code: ResponseCode.CREATED,
          message: "CSV uploaded successfully",
          data: result,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error }, "Failed to upload CSV to Gemini")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Failed to upload CSV",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      body: uploadCSVSchema,
      response: {
        201: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: uploadResponseSchema,
          timestamp: t.String(),
        }),
        500: errorResponseSchema,
      },
    },
  )

  /**
   * POST /api/v1/admin/gemini-search/search
   * Gemini를 사용하여 리드 검색
   */
  .post(
    "/search",
    async ({ body, set }) => {
      try {
        const request: LeadSearchRequest = {
          workspaceId: body.workspaceId,
          query: body.query,
          filters: body.filters,
          limit: body.limit,
          storeNames: body.storeNames,
        }

        logger.info(
          {
            workspaceId: body.workspaceId,
            query: body.query,
            filters: body.filters,
          },
          "Searching leads with Gemini",
        )

        const result = await geminiService.searchLeads(request)

        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Search completed successfully",
          data: result,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, query: body.query }, "Failed to search leads")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Failed to search leads",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      body: searchLeadsSchema,
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: searchResponseSchema,
          timestamp: t.String(),
        }),
        500: errorResponseSchema,
      },
    },
  )

  /**
   * GET /api/v1/admin/gemini-search/stores
   * 업로드된 파일/스토어 목록 조회
   */
  .get(
    "/stores",
    async ({ set }) => {
      try {
        logger.info("Listing Gemini File Search stores")

        const result = await geminiService.listFileSearchStores()

        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Stores retrieved successfully",
          data: result,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error }, "Failed to list stores")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Failed to list stores",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: listStoresResponseSchema,
          timestamp: t.String(),
        }),
        500: errorResponseSchema,
      },
    },
  )

  /**
   * DELETE /api/v1/admin/gemini-search/files/:fileId
   * 업로드된 파일 삭제
   */
  .delete(
    "/files/:fileId",
    async ({ params: { fileId }, set }) => {
      try {
        logger.info({ fileId }, "Deleting file from Gemini")

        const result = await geminiService.deleteFile(fileId)

        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: result.message,
          data: null,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, fileId }, "Failed to delete file")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Failed to delete file",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      params: t.Object({
        fileId: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: t.Null(),
          timestamp: t.String(),
        }),
        500: errorResponseSchema,
      },
    },
  )

  /**
   * POST /api/v1/admin/gemini-search/estimate-cost
   * 비용 추정
   */
  .post(
    "/estimate-cost",
    async ({ body, set }) => {
      try {
        logger.info(body, "Estimating Gemini costs")

        const result = geminiService.estimateCost({
          csvSizeBytes: body.csvSizeBytes,
          expectedSearchesPerMonth: body.expectedSearchesPerMonth,
        })

        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Cost estimate calculated",
          data: result,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error }, "Failed to estimate cost")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Failed to estimate cost",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      body: estimateCostSchema,
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: costEstimateResponseSchema,
          timestamp: t.String(),
        }),
        500: errorResponseSchema,
      },
    },
  )

  /**
   * POST /api/v1/admin/gemini-search/drive/import-url
   * Google Drive 공유 URL로 Gemini File Search Store에 가져오기 (API 인증 불필요)
   */
  .post(
    "/drive/import-url",
    async ({ body, set }) => {
      try {
        const { workspaceId, driveUrl, metadata } = body

        logger.info({ workspaceId, driveUrl }, "Importing from Drive URL to Gemini")

        // 1. URL 유효성 검증
        const validation = driveService.validateDriveUrl(driveUrl)
        if (!validation.isValid) {
          set.status = 400
          return {
            success: false as const,
            code: ResponseCode.VALIDATION_ERROR,
            message: validation.message || "Invalid Drive URL",
            timestamp: new Date().toISOString(),
          }
        }

        // 2. Drive에서 파일 다운로드 (공개 링크)
        const { fileName, fileBuffer, mimeType } =
          await driveService.downloadDriveFileFromUrl(driveUrl)

        logger.info({ fileName, size: fileBuffer.length }, "Drive file downloaded from URL")

        // 3. Gemini File Search Store에 업로드
        const result = await geminiService.uploadDriveFileToGemini({
          workspaceId,
          fileBuffer,
          fileName,
          mimeType,
          metadata,
        })

        set.status = 201
        return {
          success: true as const,
          code: ResponseCode.CREATED,
          message: "Drive file imported to Gemini successfully",
          data: result,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            driveUrl: body.driveUrl,
          },
          "Failed to import from Drive URL",
        )
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Failed to import Drive file",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        driveUrl: t.String({ minLength: 10 }),
        metadata: t.Optional(
          t.Object({
            country: t.Optional(t.String()),
            region: t.Optional(t.String()),
            vertical: t.Optional(t.String()),
            source: t.Optional(t.String()),
            dbVersion: t.Optional(t.String()),
          }),
        ),
      }),
      response: {
        201: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: uploadResponseSchema,
          timestamp: t.String(),
        }),
        400: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  )

  /**
   * 모든 Store 삭제 (초기화)
   */
  .delete(
    "/stores/all",
    async ({ set }) => {
      try {
        const result = await geminiService.deleteAllStores()

        set.status = 200
        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: `Successfully deleted ${result.deletedCount} store(s)`,
          data: result,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          "Failed to delete all stores",
        )
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Failed to delete stores",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: t.Object({
            success: t.Boolean(),
            deletedCount: t.Number(),
          }),
          timestamp: t.String(),
        }),
        500: errorResponseSchema,
      },
    },
  )
