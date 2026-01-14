/**
 * Trial Analytics Routes
 *
 * 체험판 워크스페이스 관리 및 분석 API
 * Admin 전용 엔드포인트
 */

import { Elysia, t } from "elysia"
import * as trialAnalyticsService from "../services/trial-analytics.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import logger from "../utils/logger"

export const trialAnalyticsRoutes = new Elysia({ prefix: "/api/v1/admin/trial-analytics" })
  /**
   * Get trial analytics dashboard data
   * 체험판 대시보드 차트 데이터 조회
   * 제외 목록은 DB에서 자동으로 가져옴
   */
  .get(
    "/",
    async ({ query }) => {
      try {
        const days = query.days ? parseInt(query.days, 10) : 30
        const cohortMode = (query.cohortMode as "daily" | "weekly") || "weekly"

        const analytics = await trialAnalyticsService.getTrialAnalytics(days, cohortMode)

        return successResponse(analytics, "체험판 분석 데이터 조회 성공")
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to get analytics")
        return errorResponse("체험판 분석 데이터 조회 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        days: t.Optional(t.String({ description: "조회 기간 (일)" })),
        cohortMode: t.Optional(t.String({ description: "코호트 모드: daily | weekly" })),
      }),
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "체험판 분석 대시보드 데이터",
        description:
          "KPI 요약, 가입 추이, 온보딩 퍼널, 성과 분포 등 차트 데이터 조회. 제외 목록은 DB에서 자동 적용",
      },
    },
  )

  /**
   * Get trial users list
   * 체험판 유저 목록 조회 (페이지네이션, 필터, 정렬)
   */
  .get(
    "/users",
    async ({ query }) => {
      try {
        const page = query.page ? parseInt(query.page, 10) : 1
        const limit = query.limit ? parseInt(query.limit, 10) : 20
        const sortBy = query.sortBy || "signupDate"
        const sortOrder = (query.sortOrder as "asc" | "desc") || "desc"

        const filter = {
          status: query.status as "active" | "at_risk" | "churned" | undefined,
          onboardingStatus: query.onboardingStatus,
          authProvider: query.authProvider,
        }

        const result = await trialAnalyticsService.getTrialUsers(
          page,
          limit,
          sortBy,
          sortOrder,
          filter,
        )

        return successResponse(result, "체험판 유저 목록 조회 성공")
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to get users")
        return errorResponse("체험판 유저 목록 조회 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        sortBy: t.Optional(
          t.String({ description: "정렬 기준: signupDate, lastLogin, emailsSent, openRate" }),
        ),
        sortOrder: t.Optional(t.String({ description: "정렬 순서: asc, desc" })),
        status: t.Optional(t.String({ description: "상태 필터: active, at_risk, churned" })),
        onboardingStatus: t.Optional(t.String({ description: "온보딩 상태 필터" })),
        authProvider: t.Optional(t.String({ description: "가입 경로: google, local" })),
      }),
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "체험판 유저 목록",
        description: "페이지네이션, 필터, 정렬 지원",
      },
    },
  )

  /**
   * Get workspaces by onboarding step
   * 온보딩 단계별 워크스페이스 상세 조회
   */
  .get(
    "/onboarding/:step",
    async ({ params }) => {
      try {
        const validSteps = [
          "signup",
          "onboarding",
          "company_info",
          "lead_created",
          "email_connected",
          "email_sent",
        ]
        if (!validSteps.includes(params.step)) {
          return errorResponse("유효하지 않은 단계입니다", ResponseCode.BAD_REQUEST)
        }

        const workspaces = await trialAnalyticsService.getWorkspacesByOnboardingStep(
          params.step as trialAnalyticsService.OnboardingStepType,
        )

        return successResponse(workspaces, "온보딩 단계별 워크스페이스 조회 성공")
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to get workspaces by step")
        return errorResponse("워크스페이스 조회 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      params: t.Object({
        step: t.String({
          description:
            "퍼널 단계: signup, onboarding, company_info, lead_created, email_connected, email_sent",
        }),
      }),
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "온보딩 단계별 워크스페이스",
        description: "특정 퍼널 단계에 해당하는 워크스페이스 목록 조회",
      },
    },
  )

  /**
   * Extend trial period
   * 체험판 기간 연장
   */
  .post(
    "/extend",
    async ({ body }) => {
      try {
        const { workspaceId, days } = body

        const result = await trialAnalyticsService.extendTrialPeriod(workspaceId, days)

        if (!result.success) {
          return errorResponse("워크스페이스를 찾을 수 없습니다", ResponseCode.NOT_FOUND)
        }

        return successResponse(
          { newExpiryDate: result.newExpiryDate },
          `체험판 ${days}일 연장 완료`,
        )
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to extend trial")
        return errorResponse("체험판 연장 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        days: t.Number({ minimum: 1, maximum: 90 }),
      }),
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "체험판 기간 연장",
        description: "특정 워크스페이스의 체험판 기간을 연장합니다",
      },
    },
  )

  /**
   * Bulk extend trial period
   * 여러 워크스페이스 체험판 일괄 연장
   */
  .post(
    "/bulk-extend",
    async ({ body }) => {
      try {
        const { workspaceIds, days } = body

        const results = await Promise.all(
          workspaceIds.map((id) => trialAnalyticsService.extendTrialPeriod(id, days)),
        )

        const successCount = results.filter((r) => r.success).length
        const failCount = results.filter((r) => !r.success).length

        return successResponse(
          { successCount, failCount },
          `${successCount}개 워크스페이스 체험판 ${days}일 연장 완료 (실패: ${failCount}개)`,
        )
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to bulk extend trial")
        return errorResponse("체험판 일괄 연장 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: t.Object({
        workspaceIds: t.Array(t.String({ format: "uuid" })),
        days: t.Number({ minimum: 1, maximum: 90 }),
      }),
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "체험판 일괄 연장",
        description: "여러 워크스페이스의 체험판 기간을 일괄 연장합니다",
      },
    },
  )

  // =========================================================================
  // Exclusion Management (통계 제외 관리)
  // =========================================================================

  /**
   * Get workspaces for exclusion modal
   * 제외 설정 모달용 워크스페이스 목록 조회
   * - 비제외 워크스페이스: 최신 가입일 순 (상단)
   * - 제외된 워크스페이스: 맨 아래 (isExcluded: true)
   */
  .get(
    "/workspaces-for-exclusion",
    async () => {
      try {
        const workspaces = await trialAnalyticsService.getWorkspacesForExclusion()
        return successResponse(workspaces, "워크스페이스 목록 조회 성공")
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to get workspaces for exclusion")
        return errorResponse("워크스페이스 목록 조회 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "제외 설정용 워크스페이스 목록",
        description:
          "제외 설정 모달에서 사용할 워크스페이스 목록. 비제외 항목은 최신 가입순, 제외 항목은 맨 아래 표시",
      },
    },
  )

  /**
   * Get all exclusions
   * 제외 목록 조회
   */
  .get(
    "/exclusions",
    async () => {
      try {
        const exclusions = await trialAnalyticsService.getExclusions()
        return successResponse(exclusions, "제외 목록 조회 성공")
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to get exclusions")
        return errorResponse("제외 목록 조회 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "제외 목록 조회",
        description: "통계에서 제외된 워크스페이스 목록 조회",
      },
    },
  )

  /**
   * Add exclusion
   * 통계 제외 추가
   */
  .post(
    "/exclusions",
    async ({ body }) => {
      try {
        const result = await trialAnalyticsService.addExclusion(
          body.workspaceId,
          body.excludedBy,
          body.reason,
        )

        if (!result.success) {
          return errorResponse(result.error || "제외 추가 실패", ResponseCode.BAD_REQUEST)
        }

        return successResponse(null, "워크스페이스가 통계에서 제외되었습니다")
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to add exclusion")
        return errorResponse("제외 추가 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        excludedBy: t.String({ format: "uuid", description: "제외 처리한 관리자 ID" }),
        reason: t.Optional(t.String({ description: "제외 사유" })),
      }),
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "제외 추가",
        description: "워크스페이스를 통계에서 제외",
      },
    },
  )

  /**
   * Bulk add exclusions
   * 여러 워크스페이스 일괄 제외
   */
  .post(
    "/exclusions/bulk",
    async ({ body }) => {
      try {
        const result = await trialAnalyticsService.bulkAddExclusions(
          body.workspaceIds,
          body.excludedBy,
          body.reason,
        )

        return successResponse(
          result,
          `${result.successCount}개 워크스페이스 제외 완료 (실패: ${result.failCount}개)`,
        )
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to bulk add exclusions")
        return errorResponse("일괄 제외 추가 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: t.Object({
        workspaceIds: t.Array(t.String({ format: "uuid" })),
        excludedBy: t.String({ format: "uuid" }),
        reason: t.Optional(t.String()),
      }),
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "일괄 제외",
        description: "여러 워크스페이스를 통계에서 일괄 제외",
      },
    },
  )

  /**
   * Remove exclusion
   * 제외 해제
   */
  .delete(
    "/exclusions/:workspaceId",
    async ({ params }) => {
      try {
        const result = await trialAnalyticsService.removeExclusion(params.workspaceId)

        if (!result.success) {
          return errorResponse(result.error || "제외 해제 실패", ResponseCode.NOT_FOUND)
        }

        return successResponse(null, "워크스페이스가 통계에 다시 포함됩니다")
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to remove exclusion")
        return errorResponse("제외 해제 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "제외 해제",
        description: "워크스페이스를 통계에 다시 포함",
      },
    },
  )

  /**
   * Clear all exclusions
   * 모든 제외 초기화
   */
  .delete(
    "/exclusions",
    async () => {
      try {
        const result = await trialAnalyticsService.clearAllExclusions()
        return successResponse(
          { count: result.count },
          `${result.count}개 제외 설정이 초기화되었습니다`,
        )
      } catch (error) {
        logger.error({ error }, "[TrialAnalytics] Failed to clear exclusions")
        return errorResponse("제외 초기화 실패", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      detail: {
        tags: ["admin", "trial-analytics"],
        summary: "모든 제외 초기화",
        description: "모든 워크스페이스 제외 설정을 초기화",
      },
    },
  )
