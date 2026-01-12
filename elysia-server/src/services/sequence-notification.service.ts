/**
 * Sequence Notification Service
 *
 * 시퀀스(캠페인) 관련 알림 생성 및 관리
 * - 스텝 완료 알림 (중복 방지 포함)
 * - 캠페인 시작/완료 알림
 */

import { and, count, eq, sql } from "drizzle-orm"
import { db } from "../db/index"
import {
  sequenceEnrollments,
  sequenceStepExecutions,
  sequenceSteps,
  sequences,
} from "../db/schema/sequences"
import { redisConnection } from "../lib/redis/connection"
import logger from "../utils/logger"
import { createNotification } from "./notification.service"

// ============================================================================
// Types
// ============================================================================

export interface StepCompletionStats {
  sequenceId: string
  sequenceName: string
  stepOrder: number
  totalSteps: number
  workspaceId: string
  userId: string
  sent: number
  delivered: number
  failed: number
  skipped: number
}

export interface CampaignStartParams {
  sequenceId: string
  sequenceName: string
  workspaceId: string
  userId: string
  enrolledCount: number
  scheduledExecutions: number
  totalSteps: number
}

// ============================================================================
// Constants
// ============================================================================

const STEP_COMPLETION_LOCK_TTL = 60 // 60초 락
const LOCK_PREFIX = "notification:step-complete"

// ============================================================================
// Step Completion Notification
// ============================================================================

/**
 * 스텝 완료 알림 생성 (중복 방지 포함)
 *
 * Redis 분산 락으로 동시성 제어
 */
export async function notifyStepCompletion(stats: StepCompletionStats): Promise<boolean> {
  const lockKey = `${LOCK_PREFIX}:${stats.sequenceId}:${stats.stepOrder}`

  try {
    // Redis 분산 락 시도 (SET NX EX)
    const acquired = await redisConnection.set(
      lockKey,
      Date.now().toString(),
      "EX",
      STEP_COMPLETION_LOCK_TTL,
      "NX",
    )

    if (!acquired) {
      logger.debug(
        { sequenceId: stats.sequenceId, stepOrder: stats.stepOrder },
        "[SequenceNotification] Lock not acquired, skipping duplicate notification",
      )
      return false
    }

    // 알림 생성
    const total = stats.sent + stats.delivered + stats.failed + stats.skipped
    const successCount = stats.sent + stats.delivered
    const isLastStep = stats.stepOrder === stats.totalSteps
    const hasFailed = stats.failed > 0

    // 알림 타입 결정
    const notificationType = hasFailed ? "warning" : "success"

    // 메시지 생성
    const { title, message } = formatStepCompletionMessage({
      ...stats,
      total,
      successCount,
      isLastStep,
    })

    await createNotification({
      userId: stats.userId,
      workspaceId: stats.workspaceId,
      type: notificationType,
      priority: "normal",
      title,
      message,
      metadata: {
        sequenceId: stats.sequenceId,
        sequenceName: stats.sequenceName,
        stepOrder: stats.stepOrder,
        totalSteps: stats.totalSteps,
        sent: stats.sent,
        delivered: stats.delivered,
        failed: stats.failed,
        skipped: stats.skipped,
        total,
        successCount,
        actionUrl: `/sequences/${stats.sequenceId}`,
        actionLabel: "발송 결과 확인",
      },
      entityType: "sequence_step_completion",
      entityId: `${stats.sequenceId}:step${stats.stepOrder}`,
    })

    logger.info(
      {
        sequenceId: stats.sequenceId,
        sequenceName: stats.sequenceName,
        stepOrder: stats.stepOrder,
        totalSteps: stats.totalSteps,
        successCount,
        failed: stats.failed,
      },
      "[SequenceNotification] Step completion notification created",
    )

    return true
  } catch (error) {
    // 락 해제 (에러 시 다른 워커가 재시도 가능하도록)
    try {
      await redisConnection.del(lockKey)
    } catch {
      // 락 해제 실패는 무시 (TTL로 자동 만료됨)
    }

    logger.error(
      { error, sequenceId: stats.sequenceId, stepOrder: stats.stepOrder },
      "[SequenceNotification] Failed to create step completion notification",
    )
    throw error
  }
}

/**
 * 스텝 완료 메시지 포맷
 */
function formatStepCompletionMessage(params: {
  sequenceName: string
  stepOrder: number
  totalSteps: number
  total: number
  successCount: number
  failed: number
  isLastStep: boolean
}): { title: string; message: string } {
  const { sequenceName, stepOrder, totalSteps, total, successCount, failed, isLastStep } = params

  // 제목
  const title = isLastStep ? "전체 발송 완료" : "발송 완료"

  // 스텝 정보 (멀티 스텝일 경우만 표시)
  const stepInfo = totalSteps > 1 ? ` · ${stepOrder}단계` : ""

  // 메시지 구성
  let message = `${sequenceName}${stepInfo}\n`

  if (failed > 0) {
    message += `${successCount}건 성공 · ${failed}건 실패`
  } else {
    message += `${total}건 발송 완료`
  }

  return { title, message }
}

// ============================================================================
// Check and Notify Step Completion
// ============================================================================

/**
 * 스텝 완료 여부 확인 및 알림 생성
 *
 * 워커에서 메일 발송 완료 후 호출
 */
export async function checkAndNotifyStepCompletion(params: {
  sequenceId: string
  stepOrder: number
  workspaceId: string
  userId?: string
}): Promise<void> {
  const { sequenceId, stepOrder, workspaceId } = params

  try {
    // 1. 남은 pending 개수 확인
    const [remaining] = await db
      .select({ count: count() })
      .from(sequenceStepExecutions)
      .innerJoin(
        sequenceEnrollments,
        eq(sequenceStepExecutions.enrollmentId, sequenceEnrollments.id),
      )
      .where(
        and(
          eq(sequenceEnrollments.sequenceId, sequenceId),
          eq(sequenceStepExecutions.stepOrder, stepOrder),
          eq(sequenceStepExecutions.status, "pending"),
        ),
      )

    if ((remaining?.count ?? 0) > 0) {
      return // 아직 pending 있음
    }

    // 2. processing 상태도 확인 (아직 처리 중인 것이 있으면 스킵)
    const [processing] = await db
      .select({ count: count() })
      .from(sequenceStepExecutions)
      .innerJoin(
        sequenceEnrollments,
        eq(sequenceStepExecutions.enrollmentId, sequenceEnrollments.id),
      )
      .where(
        and(
          eq(sequenceEnrollments.sequenceId, sequenceId),
          eq(sequenceStepExecutions.stepOrder, stepOrder),
          eq(sequenceStepExecutions.status, "processing"),
        ),
      )

    if ((processing?.count ?? 0) > 0) {
      return // 아직 processing 있음
    }

    // 3. 발송 통계 조회
    const [stats] = await db
      .select({
        sent: sql<number>`COUNT(*) FILTER (WHERE ${sequenceStepExecutions.status} = 'sent')`.mapWith(
          Number,
        ),
        delivered:
          sql<number>`COUNT(*) FILTER (WHERE ${sequenceStepExecutions.status} = 'delivered')`.mapWith(
            Number,
          ),
        failed:
          sql<number>`COUNT(*) FILTER (WHERE ${sequenceStepExecutions.status} = 'failed')`.mapWith(
            Number,
          ),
        skipped:
          sql<number>`COUNT(*) FILTER (WHERE ${sequenceStepExecutions.status} = 'skipped')`.mapWith(
            Number,
          ),
      })
      .from(sequenceStepExecutions)
      .innerJoin(
        sequenceEnrollments,
        eq(sequenceStepExecutions.enrollmentId, sequenceEnrollments.id),
      )
      .where(
        and(
          eq(sequenceEnrollments.sequenceId, sequenceId),
          eq(sequenceStepExecutions.stepOrder, stepOrder),
        ),
      )

    // 4. 시퀀스 정보 조회
    const [sequence] = await db
      .select({
        name: sequences.name,
        createdBy: sequences.createdBy,
      })
      .from(sequences)
      .where(eq(sequences.id, sequenceId))

    if (!sequence) {
      logger.warn({ sequenceId }, "[SequenceNotification] Sequence not found")
      return
    }

    // 5. 총 스텝 수 조회
    const [stepCount] = await db
      .select({ count: count() })
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, sequenceId))

    // 6. 알림 생성 (중복 방지 포함)
    const userId = params.userId || sequence.createdBy
    if (!userId) {
      logger.warn({ sequenceId }, "[SequenceNotification] No userId found, skipping notification")
      return
    }

    await notifyStepCompletion({
      sequenceId,
      sequenceName: sequence.name,
      stepOrder,
      totalSteps: stepCount?.count ?? 1,
      workspaceId,
      userId,
      sent: stats?.sent ?? 0,
      delivered: stats?.delivered ?? 0,
      failed: stats?.failed ?? 0,
      skipped: stats?.skipped ?? 0,
    })
  } catch (error) {
    // 알림 실패는 로깅만 하고 무시 (메일 발송에 영향 주지 않음)
    logger.error(
      { error, sequenceId, stepOrder },
      "[SequenceNotification] Failed to check/notify step completion",
    )
  }
}

// ============================================================================
// Campaign Start Notification
// ============================================================================

/**
 * 캠페인 시작 알림 생성
 */
export async function notifyCampaignStart(params: CampaignStartParams): Promise<void> {
  const {
    sequenceId,
    sequenceName,
    workspaceId,
    userId,
    enrolledCount,
    scheduledExecutions,
    totalSteps,
  } = params

  try {
    // 스텝 정보 (멀티 스텝일 경우만 표시)
    const stepInfo = totalSteps > 1 ? ` · ${totalSteps}단계` : ""

    await createNotification({
      userId,
      workspaceId,
      type: "success",
      priority: "high",
      title: "발송이 시작되었습니다",
      message: `${sequenceName}${stepInfo}\n대상 ${enrolledCount}명, 총 ${scheduledExecutions}건 예약`,
      metadata: {
        sequenceId,
        sequenceName,
        enrolledCount,
        scheduledExecutions,
        totalSteps,
        actionUrl: `/sequences/${sequenceId}`,
        actionLabel: "캠페인 확인",
      },
      entityType: "sequence",
      entityId: sequenceId,
    })

    logger.info(
      { sequenceId, sequenceName, enrolledCount, scheduledExecutions },
      "[SequenceNotification] Campaign start notification created",
    )
  } catch (error) {
    logger.error(
      { error, sequenceId },
      "[SequenceNotification] Failed to create campaign start notification",
    )
    // 알림 실패는 무시 (캠페인 시작에 영향 주지 않음)
  }
}
