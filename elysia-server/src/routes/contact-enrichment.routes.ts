/**
 * Contact Enrichment Routes
 * 고객 연락처 정보 보강 API
 */

import { Elysia, t } from "elysia"
import {
  applyEnrichmentResults,
  checkLeadsEmailStatus,
  type EnrichmentProgress,
  enrichLeadsBatch,
  getLeadsWithoutEmail,
  type SingleEnrichmentResult,
} from "../services/contact-enrichment.service"
import logger from "../utils/logger"
import { createSSEResponse } from "../utils/sse-helper"

export const contactEnrichmentRoutes = new Elysia({ prefix: "/api/v1/contact-enrichment" })
  /**
   * GET /api/v1/contact-enrichment/check-email-status
   * 선택된 리드들의 이메일 유무 확인
   */
  .get(
    "/check-email-status",
    async ({ query }) => {
      const leadIds = query.leadIds?.split(",").filter(Boolean) || []

      if (leadIds.length === 0) {
        return {
          success: true,
          data: {
            total: 0,
            withEmail: 0,
            withoutEmail: 0,
            leads: [],
          },
        }
      }

      try {
        const result = await checkLeadsEmailStatus(leadIds)
        return {
          success: true,
          data: result,
        }
      } catch (error) {
        logger.error({ error, leadIds }, "[contact-enrichment] Failed to check email status")
        return {
          success: false,
          error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        }
      }
    },
    {
      query: t.Object({
        leadIds: t.Optional(t.String()),
      }),
    },
  )

  /**
   * GET /api/v1/contact-enrichment/leads-without-email
   * 이메일이 없는 리드 목록 조회
   */
  .get(
    "/leads-without-email",
    async ({ query }) => {
      const leadIds = query.leadIds?.split(",").filter(Boolean) || []

      if (leadIds.length === 0) {
        return {
          success: true,
          data: [],
        }
      }

      try {
        const result = await getLeadsWithoutEmail(leadIds)
        return {
          success: true,
          data: result,
        }
      } catch (error) {
        logger.error({ error, leadIds }, "[contact-enrichment] Failed to get leads without email")
        return {
          success: false,
          error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        }
      }
    },
    {
      query: t.Object({
        leadIds: t.Optional(t.String()),
      }),
    },
  )

  /**
   * GET /api/v1/contact-enrichment/enrich-leads (SSE)
   * 배치 Enrichment 실행 (Server-Sent Events로 진행률 스트리밍)
   */
  .get(
    "/enrich-leads",
    async ({ query }) => {
      const leadIds = query.leadIds?.split(",").filter(Boolean) || []

      if (leadIds.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "리드 ID가 필요합니다",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      logger.info(
        { leadIds: leadIds.length },
        "[contact-enrichment] Starting batch enrichment via SSE",
      )

      return createSSEResponse(async (session) => {
        try {
          await enrichLeadsBatch(leadIds, (progress: EnrichmentProgress) => {
            // Note: Don't set event name - use data.type instead
            // Named events require addEventListener on frontend, but we use onmessage
            session.push({
              data: progress,
            })
          })
        } catch (error) {
          logger.error({ error }, "[contact-enrichment] Batch enrichment failed")
          session.push({
            data: {
              type: "error",
              error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
            },
          })
        }
      })
    },
    {
      query: t.Object({
        leadIds: t.Optional(t.String()),
      }),
    },
  )

  /**
   * POST /api/v1/contact-enrichment/enrich-leads
   * 배치 Enrichment 실행 (일반 POST - 완료 대기)
   */
  .post(
    "/enrich-leads",
    async ({ body }) => {
      const { leadIds } = body

      if (!leadIds || leadIds.length === 0) {
        return {
          success: false,
          error: "리드 ID가 필요합니다",
        }
      }

      logger.info({ leadIds: leadIds.length }, "[contact-enrichment] Starting batch enrichment")

      try {
        const result = await enrichLeadsBatch(leadIds)
        return {
          success: true,
          data: result,
        }
      } catch (error) {
        logger.error({ error }, "[contact-enrichment] Batch enrichment failed")
        return {
          success: false,
          error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        }
      }
    },
    {
      body: t.Object({
        leadIds: t.Array(t.String()),
      }),
    },
  )

  /**
   * POST /api/v1/contact-enrichment/apply-results
   * Enrichment 결과를 DB에 저장 (수동 적용)
   */
  .post(
    "/apply-results",
    async ({ body }) => {
      const { results } = body

      if (!results || results.length === 0) {
        return {
          success: false,
          error: "적용할 결과가 없습니다",
        }
      }

      logger.info(
        { resultCount: results.length },
        "[contact-enrichment] Applying enrichment results",
      )

      try {
        const response = await applyEnrichmentResults(results as SingleEnrichmentResult[])
        return {
          success: true,
          data: response,
        }
      } catch (error) {
        logger.error({ error }, "[contact-enrichment] Failed to apply results")
        return {
          success: false,
          error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        }
      }
    },
    {
      body: t.Object({
        results: t.Array(
          t.Object({
            leadId: t.String(),
            companyName: t.Union([t.String(), t.Null()]),
            success: t.Boolean(),
            emails: t.Array(
              t.Object({
                value: t.String(),
                type: t.String(),
                confidence: t.Optional(t.Number()),
              }),
            ),
            socialLinks: t.Optional(
              t.Object({
                linkedin: t.Optional(t.String()),
                twitter: t.Optional(t.String()),
                facebook: t.Optional(t.String()),
              }),
            ),
            companyInfo: t.Optional(
              t.Object({
                description: t.Optional(t.String()),
                industry: t.Optional(t.String()),
              }),
            ),
            error: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )
