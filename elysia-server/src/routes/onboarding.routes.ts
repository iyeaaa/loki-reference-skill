/**
 * Onboarding Routes
 *
 * 워크스페이스 기반 온보딩 진행 API
 */

import { Elysia, t } from "elysia"
import * as onboardingService from "../services/onboarding.service"

export const onboardingRoutes = new Elysia({ prefix: "/api/v1/onboarding" })
  // ====================================
  // 온보딩 진행 상태 조회
  // ====================================

  // 워크스페이스의 온보딩 진행 상태 조회
  .get(
    "/workspace/:workspaceId",
    async ({ params: { workspaceId } }) => {
      console.log("[Onboarding API] GET /workspace/:workspaceId called:", { workspaceId })
      const progress = await onboardingService.getOrCreateOnboardingProgress(workspaceId)
      console.log("[Onboarding API] Progress:", {
        status: progress.status,
        currentStep: progress.currentStep,
        generatedSequenceId: progress.generatedSequenceId,
        completedAt: progress.completedAt,
      })
      return { data: progress }
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
      const { userId, ...surveyData } = body
      const progress = await onboardingService.saveSurveyData(workspaceId, surveyData, userId)
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
