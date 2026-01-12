/**
 * Sequence Notification Service
 *
 * 시퀀스(캠페인) 관련 알림 생성 및 관리
 * - 스텝 완료 알림 (중복 방지 포함)
 * - 캠페인 시작/완료 알림
 * - 이메일 알림 발송 (Trial 전용: Unipile)
 */

import { and, count, eq, sql } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db/index"
import { subscriptions } from "../db/schema/billing"
import { userEmailAccounts } from "../db/schema/email-accounts"
import {
  sequenceEnrollments,
  sequenceStepExecutions,
  sequenceSteps,
  sequences,
} from "../db/schema/sequences"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"
import { redisConnection } from "../lib/redis/connection"
import logger from "../utils/logger"
import { createNotification } from "./notification.service"
import * as unipileService from "./unipile.service"

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
// Helper Functions
// ============================================================================

/**
 * 구독 티어에 따른 actionUrl 생성
 *
 * Trial 사용자는 sequences 리소스 접근 권한이 없으므로
 * /dashboard로 리다이렉트하고, 그 외 사용자는 시퀀스 목록으로 이동
 */
async function getSequenceActionUrl(
  workspaceId: string,
): Promise<{ actionUrl: string; actionLabel: string }> {
  try {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
      columns: { subscriptionTier: true },
    })

    if (workspace?.subscriptionTier === "trial") {
      return {
        actionUrl: "/dashboard",
        actionLabel: "대시보드 확인",
      }
    }

    return {
      actionUrl: "/sequences",
      actionLabel: "캠페인 확인",
    }
  } catch (error) {
    logger.warn(
      { error, workspaceId },
      "[SequenceNotification] Failed to get subscription tier, using default URL",
    )
    // 에러 시 기본값 반환
    return {
      actionUrl: "/sequences",
      actionLabel: "캠페인 확인",
    }
  }
}

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

    // 구독 티어에 따른 actionUrl 결정
    const { actionUrl, actionLabel } = await getSequenceActionUrl(stats.workspaceId)

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
        actionUrl,
        actionLabel: actionLabel === "캠페인 확인" ? "발송 결과 확인" : actionLabel,
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

    // 이메일 알림 발송 (Trial 사용자만, 비동기로 처리하여 벨 알림에 영향 없음)
    sendStepCompletionEmail({
      userId: stats.userId,
      workspaceId: stats.workspaceId,
      sequenceName: stats.sequenceName,
      stepOrder: stats.stepOrder,
      totalSteps: stats.totalSteps,
      successCount,
      failedCount: stats.failed,
      total,
      isLastStep,
      actionUrl,
    }).catch((err) => {
      logger.warn(
        { error: err, sequenceId: stats.sequenceId, stepOrder: stats.stepOrder },
        "[SequenceNotification] Email notification failed (non-blocking)",
      )
    })

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

    // 구독 티어에 따른 actionUrl 결정
    const { actionUrl, actionLabel } = await getSequenceActionUrl(workspaceId)

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
        actionUrl,
        actionLabel,
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

// ============================================================================
// Email Notification for Step Completion
// ============================================================================

/**
 * 스텝 완료 이메일 알림 HTML 템플릿
 */
function generateStepCompletionEmailHtml(params: {
  userName: string
  sequenceName: string
  stepOrder: number
  totalSteps: number
  successCount: number
  failedCount: number
  total: number
  isLastStep: boolean
  completedAt: Date
  actionUrl: string
}): string {
  const {
    userName,
    sequenceName,
    stepOrder,
    totalSteps,
    successCount,
    failedCount,
    total,
    isLastStep,
    completedAt,
    actionUrl,
  } = params

  const completedTimeKST = completedAt.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const statusBadge = isLastStep
    ? `<span style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; color: #059669; font-size: 12px; font-weight: 600; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.5px;">전체 발송 완료</span>`
    : `<span style="display: inline-block; padding: 4px 12px; background-color: #eff6ff; color: #2563eb; font-size: 12px; font-weight: 600; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.5px;">${stepOrder}/${totalSteps} 단계 완료</span>`

  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0

  const failedRow =
    failedCount > 0
      ? `
                  <tr>
                    <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                      <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">실패</span>
                    </td>
                    <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                      <span style="font-size: 14px; color: #dc2626; font-weight: 600;">${failedCount}건</span>
                    </td>
                  </tr>`
      : ""

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RINDA 업무 리포트</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 48px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: 700; color: #111827;">RINDA</span>
                    <span style="font-size: 13px; color: #6b7280; margin-left: 8px;">AI SDR Agent</span>
                  </td>
                  <td style="text-align: right;">
                    <span style="font-size: 12px; color: #9ca3af;">${completedTimeKST}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">

                <!-- Status Header -->
                <tr>
                  <td style="padding: 24px 32px; border-bottom: 1px solid #f0f0f0;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td>
                          ${statusBadge}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 12px;">
                          <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #111827;">
                            ${isLastStep ? "캠페인 발송이 완료되었습니다" : `${stepOrder}단계 발송이 완료되었습니다`}
                          </h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Agent Message -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #fafafa; border-bottom: 1px solid #f0f0f0;">
                    <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.7;">
                      안녕하세요, ${userName}님.<br><br>
                      <strong>${sequenceName}</strong> 캠페인의 ${isLastStep ? "모든 발송이" : `${stepOrder}단계 발송이`} 완료되었습니다.
                      ${failedCount > 0 ? `일부 발송 실패가 발생했습니다. 대시보드에서 상세 내역을 확인해 주세요.` : "모든 이메일이 성공적으로 발송되었습니다."}
                    </p>
                  </td>
                </tr>

                <!-- Stats Details -->
                <tr>
                  <td style="padding: 24px 32px;">
                    <p style="margin: 0 0 16px; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">발송 결과</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px;">
                      <tr>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0; width: 120px;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">캠페인</span>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 14px; color: #111827; font-weight: 500;">${sequenceName}</span>
                        </td>
                      </tr>
                      ${
                        totalSteps > 1
                          ? `
                      <tr>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">단계</span>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 14px; color: #111827;">${stepOrder} / ${totalSteps}</span>
                        </td>
                      </tr>`
                          : ""
                      }
                      <tr>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">총 발송</span>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 14px; color: #111827; font-weight: 500;">${total}건</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">성공</span>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 14px; color: #059669; font-weight: 600;">${successCount}건 (${successRate}%)</span>
                        </td>
                      </tr>
                      ${failedRow}
                      <tr>
                        <td style="padding: 14px 16px;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">완료 시간</span>
                        </td>
                        <td style="padding: 14px 16px;">
                          <span style="font-size: 14px; color: #111827;">${completedTimeKST}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Next Steps -->
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px;">
                      <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">RINDA의 권장 사항</p>
                      <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; color: #1e3a8a; line-height: 1.8;">
                        <li style="margin-bottom: 6px;">대시보드에서 오픈율과 클릭율을 모니터링하세요</li>
                        <li style="margin-bottom: 6px;">답장이 온 바이어에게는 신속하게 후속 연락을 취하세요</li>
                        ${isLastStep ? `<li>캠페인 성과를 분석하여 다음 캠페인에 반영하세요</li>` : `<li>다음 단계 발송 전 현재 단계의 반응을 확인하세요</li>`}
                      </ul>
                    </div>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td style="padding: 0 32px 32px; text-align: center;">
                    <a href="${actionUrl}" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
                      대시보드에서 상세 확인
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 0; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
                이 리포트는 RINDA AI SDR이 자동으로 생성했습니다.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Grinda AI | AI-Powered Sales Development
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

/**
 * 워크스페이스가 체험판(trial) 상태인지 확인
 */
async function isTrialWorkspace(workspaceId: string): Promise<boolean> {
  const [subscription] = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.status, "trialing"),
        eq(subscriptions.isPrimary, true),
      ),
    )
    .limit(1)

  return !!subscription
}

/**
 * 유저의 Unipile 이메일 계정 조회
 */
async function getUserUnipileAccount(
  userId: string,
  workspaceId: string,
): Promise<{
  accountId: string
  emailAddress: string
} | null> {
  const [account] = await db
    .select({
      apiKey: userEmailAccounts.apiKey,
      emailAddress: userEmailAccounts.emailAddress,
    })
    .from(userEmailAccounts)
    .where(
      and(
        eq(userEmailAccounts.userId, userId),
        eq(userEmailAccounts.workspaceId, workspaceId),
        eq(userEmailAccounts.provider, "unipile"),
        eq(userEmailAccounts.status, "active"),
      ),
    )
    .limit(1)

  if (!account) return null

  return {
    accountId: account.apiKey,
    emailAddress: account.emailAddress,
  }
}

/**
 * 유저 정보 조회
 */
async function getUserInfo(userId: string): Promise<{ email: string; username: string } | null> {
  const [user] = await db
    .select({
      email: users.email,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user || null
}

/**
 * 스텝 완료 이메일 알림 발송 (Trial/Unipile 사용자 전용)
 *
 * - Trial 사용자만 Unipile을 통해 본인에게 이메일 알림 발송
 * - SendGrid 사용자는 벨 알림만 (이메일 알림 없음)
 */
async function sendStepCompletionEmail(params: {
  userId: string
  workspaceId: string
  sequenceName: string
  stepOrder: number
  totalSteps: number
  successCount: number
  failedCount: number
  total: number
  isLastStep: boolean
  actionUrl: string
}): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const {
    userId,
    workspaceId,
    sequenceName,
    stepOrder,
    totalSteps,
    successCount,
    failedCount,
    total,
    isLastStep,
    actionUrl,
  } = params

  try {
    // 1. Trial 워크스페이스인지 확인 (Trial만 이메일 알림 발송)
    const isTrial = await isTrialWorkspace(workspaceId)
    if (!isTrial) {
      logger.debug(
        { workspaceId, sequenceName },
        "[SequenceNotification] Skipping email notification - not a trial workspace",
      )
      return { success: true, skipped: true }
    }

    // 2. 유저 정보 조회
    const userInfo = await getUserInfo(userId)
    if (!userInfo) {
      logger.warn({ userId }, "[SequenceNotification] User not found for email notification")
      return { success: false, error: "User not found" }
    }

    // 3. Unipile 계정 조회
    const unipileAccount = await getUserUnipileAccount(userId, workspaceId)
    if (!unipileAccount) {
      logger.warn(
        { userId, workspaceId },
        "[SequenceNotification] No Unipile account for trial user",
      )
      return { success: false, error: "No Unipile account" }
    }

    // 4. 이메일 본문 생성
    const emailHtml = generateStepCompletionEmailHtml({
      userName: userInfo.username,
      sequenceName,
      stepOrder,
      totalSteps,
      successCount,
      failedCount,
      total,
      isLastStep,
      completedAt: new Date(),
      actionUrl: `${config.frontendUrl}${actionUrl}`,
    })

    const emailSubject = isLastStep
      ? `[RINDA] ${sequenceName} 캠페인 발송이 완료되었습니다`
      : `[RINDA] ${sequenceName} ${stepOrder}단계 발송이 완료되었습니다`

    // 5. Unipile로 발송
    const result = await unipileService.sendEmail({
      accountId: unipileAccount.accountId,
      to: unipileAccount.emailAddress, // 본인에게 발송
      subject: emailSubject,
      body: emailHtml,
    })

    if (!result.success) {
      logger.error(
        { error: result.error, userId },
        "[SequenceNotification] Failed to send step completion email via Unipile",
      )
      return { success: false, error: result.error }
    }

    logger.info(
      { userId, sequenceName, stepOrder, method: "unipile" },
      "[SequenceNotification] Step completion email sent via Unipile",
    )
    return { success: true }
  } catch (error) {
    logger.error(
      { error, userId, sequenceName, stepOrder },
      "[SequenceNotification] Failed to send step completion email",
    )
    return { success: false, error: String(error) }
  }
}
