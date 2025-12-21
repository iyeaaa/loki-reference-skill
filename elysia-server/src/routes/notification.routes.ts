/**
 * Notification Routes
 *
 * 알림 관련 API 엔드포인트
 * - REST API for CRUD operations
 * - SSE for real-time updates
 */

import { Elysia, t } from "elysia"
import { createNotificationSubscriber } from "../lib/redis/notification-events"
import * as notificationService from "../services/notification.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import { getUserIdFromToken } from "../utils/auth.util"
import logger from "../utils/logger"

export const notificationRoutes = new Elysia({ prefix: "/api/v1/notifications" })
  // ====================================
  // 에러 핸들링
  // ====================================
  .onError(({ error, set }) => {
    logger.error({ error }, "[Notification Routes] Error")
    set.status = 500
    return errorResponse("Internal server error", ResponseCode.INTERNAL_ERROR)
  })

  // ====================================
  // 실시간 알림 SSE 스트림 (token via query param for EventSource compatibility)
  // ====================================
  .get(
    "/stream",
    async ({ headers, query }) => {
      // Try auth header first (for clients that can send auth headers)
      // Then fall back to token query param (for EventSource which doesn't support headers)
      let userId = await getUserIdFromToken(headers.authorization)
      if (!userId && query.token) {
        userId = await getUserIdFromToken(`Bearer ${query.token}`)
      }

      if (!userId) {
        return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }

      logger.info({ userId }, "[Notification SSE] Client connected")

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          let isActive = true

          // Send initial connection event
          const sendEvent = (data: string) => {
            if (isActive) {
              try {
                controller.enqueue(encoder.encode(data))
              } catch {
                isActive = false
              }
            }
          }

          // Send heartbeat every 30 seconds to keep connection alive
          const heartbeatInterval = setInterval(() => {
            sendEvent(": heartbeat\n\n")
          }, 30000)

          // Subscribe to notification events
          const subscriber = createNotificationSubscriber(userId)

          subscriber.subscribe((event) => {
            const data = `event: notification\ndata: ${JSON.stringify(event)}\n\n`
            sendEvent(data)
            logger.debug(
              { userId, eventType: event.type },
              "[Notification SSE] Event sent to client",
            )
          })

          // Send initial connection success
          sendEvent(
            `event: connected\ndata: ${JSON.stringify({ userId, timestamp: new Date().toISOString() })}\n\n`,
          )

          // Cleanup on close
          return () => {
            isActive = false
            clearInterval(heartbeatInterval)
            subscriber.unsubscribe().catch((err) => {
              logger.warn({ err, userId }, "[Notification SSE] Failed to unsubscribe")
            })
            logger.info({ userId }, "[Notification SSE] Client disconnected")
          }
        },
        cancel() {
          logger.info({ userId }, "[Notification SSE] Stream cancelled")
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    },
    {
      query: t.Object({
        token: t.Optional(t.String()),
      }),
    },
  )

  // ====================================
  // 알림 목록 조회
  // ====================================
  .get(
    "/",
    async ({ headers, query, set }) => {
      const userId = await getUserIdFromToken(headers.authorization)
      const { workspaceId, type, read, limit, offset } = query

      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const result = await notificationService.getNotifications({
        userId,
        workspaceId,
        type: type as Parameters<typeof notificationService.getNotifications>[0]["type"],
        read: read === "true" ? true : read === "false" ? false : undefined,
        limit: limit ? Number.parseInt(limit, 10) : 50,
        offset: offset ? Number.parseInt(offset, 10) : 0,
      })

      return successResponse(result)
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String()),
        type: t.Optional(t.String()),
        read: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // ====================================
  // 읽지 않은 알림 개수 조회
  // ====================================
  .get(
    "/unread-count",
    async ({ headers, query, set }) => {
      const userId = await getUserIdFromToken(headers.authorization)
      const { workspaceId } = query

      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const unreadCount = await notificationService.getUnreadCount(userId, workspaceId)

      return successResponse({ unreadCount })
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String()),
      }),
    },
  )

  // ====================================
  // 알림 상세 조회
  // ====================================
  .get(
    "/:notificationId",
    async ({ params, headers, set }) => {
      const { notificationId } = params
      const userId = await getUserIdFromToken(headers.authorization)

      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const notification = await notificationService.getNotificationById(notificationId, userId)

      if (!notification) {
        return errorResponse("Notification not found", ResponseCode.NOT_FOUND)
      }

      return successResponse(notification)
    },
    {
      params: t.Object({
        notificationId: t.String({ format: "uuid" }),
      }),
    },
  )

  // ====================================
  // 알림 읽음 처리
  // ====================================
  .patch(
    "/:notificationId/read",
    async ({ params, headers, set }) => {
      const { notificationId } = params
      const userId = await getUserIdFromToken(headers.authorization)

      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const success = await notificationService.markAsRead(notificationId, userId)

      if (!success) {
        return errorResponse("Notification not found", ResponseCode.NOT_FOUND)
      }

      return successResponse({ success: true })
    },
    {
      params: t.Object({
        notificationId: t.String({ format: "uuid" }),
      }),
    },
  )

  // ====================================
  // 모든 알림 읽음 처리
  // ====================================
  .patch(
    "/read-all",
    async ({ headers, body, set }) => {
      const userId = await getUserIdFromToken(headers.authorization)
      const { workspaceId } = body

      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const count = await notificationService.markAllAsRead(userId, workspaceId)

      return successResponse({ success: true, count })
    },
    {
      body: t.Object({
        workspaceId: t.Optional(t.String()),
      }),
    },
  )

  // ====================================
  // 알림 삭제
  // ====================================
  .delete(
    "/:notificationId",
    async ({ params, headers, set }) => {
      const { notificationId } = params
      const userId = await getUserIdFromToken(headers.authorization)

      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const success = await notificationService.deleteNotification(notificationId, userId)

      if (!success) {
        return errorResponse("Notification not found", ResponseCode.NOT_FOUND)
      }

      return successResponse({ success: true })
    },
    {
      params: t.Object({
        notificationId: t.String({ format: "uuid" }),
      }),
    },
  )

  // ====================================
  // 모든 알림 삭제
  // ====================================
  .delete(
    "/",
    async ({ headers, query, set }) => {
      const userId = await getUserIdFromToken(headers.authorization)
      const { workspaceId } = query

      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const count = await notificationService.deleteAllNotifications(userId, workspaceId)

      return successResponse({ success: true, count })
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String()),
      }),
    },
  )

  // ====================================
  // 만료된 알림 정리 (관리자용)
  // ====================================
  .post("/cleanup-expired", async () => {
    const count = await notificationService.cleanupExpiredNotifications()
    return successResponse({ success: true, deletedCount: count })
  })

  // ====================================
  // 알림 생성 (테스트/시스템 용)
  // ====================================
  .post(
    "/",
    async ({ body }) => {
      const notification = await notificationService.createNotification(body)
      return successResponse(notification)
    },
    {
      body: t.Object({
        userId: t.String(),
        workspaceId: t.Optional(t.String()),
        type: t.Union([
          t.Literal("onboarding"),
          t.Literal("system"),
          t.Literal("success"),
          t.Literal("error"),
          t.Literal("info"),
          t.Literal("warning"),
        ]),
        priority: t.Optional(
          t.Union([t.Literal("low"), t.Literal("normal"), t.Literal("high"), t.Literal("urgent")]),
        ),
        title: t.String(),
        message: t.String(),
        metadata: t.Optional(t.Any()),
        entityType: t.Optional(t.String()),
        entityId: t.Optional(t.String()),
      }),
    },
  )
