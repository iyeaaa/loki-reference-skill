import { Elysia, t } from "elysia"
import * as dashboardService from "../services/dashboard.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

export const dashboardRoutes = new Elysia({ prefix: "/api/v1/dashboard" })
  // Get dashboard stats (all 3 columns)
  .get(
    "/stats",
    async ({ query }) => {
      try {
        const stats = await dashboardService.getDashboardStats({
          startDate: query.startDate,
          endDate: query.endDate,
          workspaceId: query.workspaceId,
        })

        return {
          success: true,
          code: ResponseCode.SUCCESS,
          message: "정상 처리되었습니다.",
          data: stats,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, query }, "Failed to get dashboard stats")
        return errorResponse("대시보드 통계 조회에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        workspaceId: t.Optional(t.String({ format: "uuid" })),
      }),
      detail: {
        tags: ["dashboard"],
        summary: "Get dashboard statistics",
        description: "Returns statistics for all 3 dashboard columns: leads, emails, and open rate",
      },
    },
  )

  // Get lead trends
  .get(
    "/trends/leads",
    async ({ query }) => {
      try {
        const trends = await dashboardService.getLeadTrends({
          startDate: query.startDate,
          endDate: query.endDate,
          workspaceId: query.workspaceId,
        })

        return {
          success: true,
          code: ResponseCode.SUCCESS,
          message: "정상 처리되었습니다.",
          data: trends,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, query }, "Failed to get lead trends")
        return errorResponse("리드 트렌드 조회에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        workspaceId: t.Optional(t.String({ format: "uuid" })),
      }),
      detail: {
        tags: ["dashboard"],
        summary: "Get lead trends",
        description: "Returns daily lead counts for the specified date range",
      },
    },
  )

  // Get email trends
  .get(
    "/trends/emails",
    async ({ query }) => {
      try {
        const trends = await dashboardService.getEmailTrends({
          startDate: query.startDate,
          endDate: query.endDate,
          workspaceId: query.workspaceId,
        })

        return {
          success: true,
          code: ResponseCode.SUCCESS,
          message: "정상 처리되었습니다.",
          data: trends,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, query }, "Failed to get email trends")
        return errorResponse("이메일 트렌드 조회에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        workspaceId: t.Optional(t.String({ format: "uuid" })),
      }),
      detail: {
        tags: ["dashboard"],
        summary: "Get email trends",
        description: "Returns daily email counts for the specified date range",
      },
    },
  )

  // Get open rate trends
  .get(
    "/trends/opens",
    async ({ query }) => {
      try {
        const trends = await dashboardService.getOpenRateTrends({
          startDate: query.startDate,
          endDate: query.endDate,
          workspaceId: query.workspaceId,
        })

        return {
          success: true,
          code: ResponseCode.SUCCESS,
          message: "정상 처리되었습니다.",
          data: trends,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, query }, "Failed to get open rate trends")
        return errorResponse("오픈률 트렌드 조회에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        workspaceId: t.Optional(t.String({ format: "uuid" })),
      }),
      detail: {
        tags: ["dashboard"],
        summary: "Get open rate trends",
        description: "Returns daily open rates for the specified date range",
      },
    },
  )

  // Get lead discovery notifications
  .get(
    "/notifications/lead-discovery",
    async ({ query }) => {
      try {
        const notifications = await dashboardService.getLeadDiscoveryNotifications({
          startDate: query.startDate,
          endDate: query.endDate,
          workspaceId: query.workspaceId,
          limit: query.limit ? parseInt(query.limit, 10) : 10,
        })

        return {
          success: true,
          code: ResponseCode.SUCCESS,
          message: "정상 처리되었습니다.",
          data: notifications,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, query }, "Failed to get lead discovery notifications")
        return errorResponse("리드 탐색 알림 조회에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        workspaceId: t.Optional(t.String({ format: "uuid" })),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ["dashboard"],
        summary: "Get lead discovery notifications",
        description: "Returns recent lead discovery (webset) activities",
      },
    },
  )

  // Get campaign notifications
  .get(
    "/notifications/campaigns",
    async ({ query }) => {
      try {
        const notifications = await dashboardService.getCampaignNotifications({
          startDate: query.startDate,
          endDate: query.endDate,
          workspaceId: query.workspaceId,
          limit: query.limit ? parseInt(query.limit, 10) : 10,
        })

        return {
          success: true,
          code: ResponseCode.SUCCESS,
          message: "정상 처리되었습니다.",
          data: notifications,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, query }, "Failed to get campaign notifications")
        return errorResponse("캠페인 알림 조회에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        workspaceId: t.Optional(t.String({ format: "uuid" })),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ["dashboard"],
        summary: "Get campaign notifications",
        description: "Returns recent campaign (sequence) activities",
      },
    },
  )

  // Get reply notifications
  .get(
    "/notifications/replies",
    async ({ query }) => {
      try {
        const notifications = await dashboardService.getReplyNotifications({
          startDate: query.startDate,
          endDate: query.endDate,
          workspaceId: query.workspaceId,
          limit: query.limit ? parseInt(query.limit, 10) : 10,
        })

        return {
          success: true,
          code: ResponseCode.SUCCESS,
          message: "정상 처리되었습니다.",
          data: notifications,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, query }, "Failed to get reply notifications")
        return errorResponse("답장 알림 조회에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        workspaceId: t.Optional(t.String({ format: "uuid" })),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ["dashboard"],
        summary: "Get reply notifications",
        description: "Returns recent email replies with sentiment analysis",
      },
    },
  )
