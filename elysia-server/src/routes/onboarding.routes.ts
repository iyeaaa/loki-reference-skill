/**
 * Onboarding Routes
 *
 * 워크스페이스 기반 온보딩 진행 API
 * SSE 엔드포인트를 통한 실시간 진행 상황 스트리밍 지원
 */

import { Elysia, t } from "elysia"
import {
  createOnboardingSubscriber,
  type OnboardingProgressEvent,
} from "../lib/redis/onboarding-events"
import * as onboardingService from "../services/onboarding.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

export const onboardingRoutes = new Elysia({ prefix: "/api/v1/onboarding" })
  // 전역 에러 핸들러
  .onError(({ error, set }) => {
    if (error instanceof onboardingService.OnboardingValidationError) {
      set.status = 400
      return errorResponse(`[${error.code}] ${error.message}`, ResponseCode.BAD_REQUEST)
    }
    throw error
  })
  // ====================================
  // 온보딩 진행 상태 조회
  // ====================================

  // 워크스페이스의 온보딩 진행 상태 조회
  .get(
    "/workspace/:workspaceId",
    async ({ params: { workspaceId } }) => {
      // console.log("[Onboarding API] ========================================")
      // console.log("[Onboarding API] GET /workspace/:workspaceId")
      // console.log("[Onboarding API] workspaceId:", workspaceId)
      const progress = await onboardingService.getOrCreateOnboardingProgress(workspaceId)
      // console.log("[Onboarding API] Response:")
      // console.log("[Onboarding API]   - id:", progress.id)
      // console.log("[Onboarding API]   - status:", progress.status)
      // console.log("[Onboarding API]   - currentStep:", progress.currentStep)
      // console.log("[Onboarding API]   - surveyData:", JSON.stringify(progress.surveyData, null, 2))
      // console.log("[Onboarding API]   - completedAt:", progress.completedAt)
      // console.log("[Onboarding API] ========================================")
      return { data: progress }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )

  // ====================================
  // SSE 실시간 진행 상황 스트리밍
  // ====================================

  // 워크스페이스의 온보딩 진행 상황 실시간 스트리밍
  .get(
    "/workspace/:workspaceId/stream",
    async ({ params: { workspaceId } }) => {
      logger.info({ workspaceId }, "[Onboarding SSE] Starting stream")

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          let isDisconnected = false

          // Safe enqueue function with disconnect detection
          const safeEnqueue = (data: string): boolean => {
            if (isDisconnected) return false
            try {
              controller.enqueue(encoder.encode(data))
              return true
            } catch (_error) {
              isDisconnected = true
              return false
            }
          }

          // Send initial connection event
          safeEnqueue(
            `event: connected\ndata: ${JSON.stringify({
              type: "connected",
              message: "SSE connection established",
              workspaceId,
              timestamp: new Date().toISOString(),
            })}\n\n`,
          )

          // Create Redis subscriber for this workspace
          const subscriber = createOnboardingSubscriber(workspaceId)

          // Subscribe to progress events
          subscriber.subscribe((event: OnboardingProgressEvent) => {
            if (isDisconnected) return

            const success = safeEnqueue(`event: progress\ndata: ${JSON.stringify(event)}\n\n`)

            if (success) {
              logger.debug(
                { workspaceId, phase: event.phase, percent: event.progressPercent },
                "[Onboarding SSE] Sent progress event",
              )
            }

            // Close stream when complete or error
            if (event.phase === "complete" || event.phase === "error") {
              // Send final event and close
              safeEnqueue(
                `event: ${event.phase}\ndata: ${JSON.stringify({
                  ...event,
                  final: true,
                })}\n\n`,
              )

              // Give client time to process final event
              setTimeout(() => {
                isDisconnected = true
                subscriber.unsubscribe().catch(() => {})
                try {
                  controller.close()
                } catch (_e) {
                  // Already closed
                }
              }, 500)
            }
          })

          // Heartbeat to keep connection alive
          const heartbeatInterval = setInterval(() => {
            if (isDisconnected) {
              clearInterval(heartbeatInterval)
              return
            }
            const success = safeEnqueue(`: heartbeat\n\n`)
            if (!success) {
              clearInterval(heartbeatInterval)
              subscriber.unsubscribe().catch(() => {})
            }
          }, 15000) // Every 15 seconds

          // Cleanup function - will be called when stream is cancelled
          return () => {
            isDisconnected = true
            clearInterval(heartbeatInterval)
            subscriber.unsubscribe().catch(() => {})
            logger.info({ workspaceId }, "[Onboarding SSE] Stream closed")
          }
        },

        cancel() {
          logger.info({ workspaceId }, "[Onboarding SSE] Client cancelled stream")
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )

  // ====================================
  // 설문 데이터 저장
  // ====================================

  // 설문 데이터 저장 (온보딩 시작)
  .post(
    "/workspace/:workspaceId/survey",
    async ({ params: { workspaceId }, body }) => {
      // console.log("[Onboarding API] ========================================")
      // console.log("[Onboarding API] POST /workspace/:workspaceId/survey")
      // console.log("[Onboarding API] workspaceId:", workspaceId)
      // console.log("[Onboarding API] body:", JSON.stringify(body, null, 2))

      const { userId, ...surveyData } = body
      // console.log("[Onboarding API] surveyData:", JSON.stringify(surveyData, null, 2))
      // console.log("[Onboarding API] userId:", userId)

      const progress = await onboardingService.saveSurveyData(workspaceId, surveyData, userId)

      // console.log("[Onboarding API] Survey saved successfully")
      // console.log("[Onboarding API] Progress after save:")
      // console.log("[Onboarding API]   - id:", progress.id)
      // console.log("[Onboarding API]   - status:", progress.status)
      // console.log("[Onboarding API]   - currentStep:", progress.currentStep)
      // console.log("[Onboarding API]   - surveyData:", JSON.stringify(progress.surveyData, null, 2))
      // console.log("[Onboarding API] ========================================")
      return { data: progress }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        industry: t.Optional(t.String()),
        target: t.Optional(t.String()),
        country: t.Optional(t.String()),
        experience: t.Optional(t.String()),
        lang: t.Optional(t.String()),
        userId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // ====================================
  // 스텝별 완료 처리
  // ====================================

  // Step 1 완료: 회사 정보 확인
  .post(
    "/workspace/:workspaceId/step1/complete",
    async ({ params: { workspaceId }, body }) => {
      const progress = await onboardingService.completeStep1CompanyInfo(workspaceId, body?.userId)
      return { data: progress }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      body: t.Optional(
        t.Object({
          userId: t.Optional(t.String({ format: "uuid" })),
        }),
      ),
    },
  )

  // Step 2 완료: 리드 검색 및 저장
  .post(
    "/workspace/:workspaceId/step2/complete",
    async ({ params: { workspaceId }, body }) => {
      const progress = await onboardingService.completeStep2LeadSearch(
        workspaceId,
        body.selectedLeadIds,
        body.customerGroupId,
        body.userId,
      )
      return { data: progress }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        selectedLeadIds: t.Array(t.String()),
        customerGroupId: t.Optional(t.String({ format: "uuid" })),
        userId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Step 3 완료: 이메일 시퀀스 생성
  .post(
    "/workspace/:workspaceId/step3/complete",
    async ({ params: { workspaceId }, body }) => {
      const progress = await onboardingService.completeStep3EmailGeneration(
        workspaceId,
        body.sequenceId,
        body.userId,
      )
      return { data: progress }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        sequenceId: t.String({ format: "uuid" }),
        userId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Step 4 완료: 이메일 연동
  .post(
    "/workspace/:workspaceId/step4/complete",
    async ({ params: { workspaceId }, body }) => {
      const progress = await onboardingService.completeStep4EmailLink(workspaceId, body?.userId)
      return { data: progress }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      body: t.Optional(
        t.Object({
          userId: t.Optional(t.String({ format: "uuid" })),
        }),
      ),
    },
  )

  // ====================================
  // 온보딩 완료
  // ====================================

  // 온보딩 완료 처리
  .post(
    "/workspace/:workspaceId/complete",
    async ({ params: { workspaceId }, body }) => {
      const progress = await onboardingService.completeOnboarding(workspaceId, body?.userId)
      return { data: progress }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      body: t.Optional(
        t.Object({
          userId: t.Optional(t.String({ format: "uuid" })),
        }),
      ),
    },
  )

  // ====================================
  // 스텝 업데이트
  // ====================================

  // 현재 스텝 업데이트 (자유 이동)
  .patch(
    "/workspace/:workspaceId/step",
    async ({ params: { workspaceId }, body }) => {
      const progress = await onboardingService.updateCurrentStep(workspaceId, body.step)
      return { data: progress }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        step: t.Number({ minimum: 0, maximum: 5 }),
      }),
    },
  )

  // ====================================
  // 관리/분석용 API
  // ====================================

  // 미완료 온보딩 목록 (관리자용)
  .get(
    "/incomplete",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 100
      const result = await onboardingService.getIncompleteOnboardings(limit)
      return { data: result }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // 온보딩 통계 (관리자용)
  .get("/stats", async () => {
    const stats = await onboardingService.getOnboardingStats()
    return { data: stats }
  })

  // 온보딩 리셋 (개발/테스트용)
  .post(
    "/workspace/:workspaceId/reset",
    async ({ params: { workspaceId } }) => {
      const progress = await onboardingService.resetOnboarding(workspaceId)
      return { data: progress, message: "온보딩 상태가 리셋되었습니다." }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )
