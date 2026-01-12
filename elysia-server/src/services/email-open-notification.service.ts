/**
 * Email Open Notification Service (Unipile)
 *
 * 체험판(trial) 사용자를 위한 이메일 오픈 알림 서비스
 * - 바이어가 이메일을 열면 유저에게 알림 메일 발송
 * - Unipile을 통해 유저의 연동된 이메일로 발송
 * - 중복 알림 방지 (동일 이메일에 대해 최초 1회만)
 * - RINDA AI SDR Agent가 업무를 대행했다는 관점으로 알림
 */

import { and, eq } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db/index"
import { subscriptions } from "../db/schema/billing"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails as emailsTable } from "../db/schema/emails"
import { leads } from "../db/schema/leads"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"
import logger from "../utils/logger"
import { createNotification } from "./notification.service"
import * as unipileService from "./unipile.service"

// ============================================================================
// Types
// ============================================================================

interface EmailOpenNotificationData {
  userId: string
  userEmail: string
  userName: string
  buyerEmail: string
  buyerName: string | null
  buyerCompany: string | null
  buyerTitle: string | null
  emailSubject: string | null
  openedAt: Date
  sentAt: Date | null
  openCount: number
}

interface NotificationResult {
  success: boolean
  skipped: boolean
  reason?: string
}

// ============================================================================
// HTML Email Template - RINDA AI SDR Agent 업무 리포트
// ============================================================================

function generateEmailOpenNotificationHtml(data: EmailOpenNotificationData): string {
  const buyerDisplay = data.buyerName || data.buyerEmail.split("@")[0]
  const subjectDisplay = data.emailSubject || "(제목 없음)"
  const openedTimeKST = new Date(data.openedAt).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  // 발송 후 오픈까지 걸린 시간 계산
  let responseTimeText = ""
  if (data.sentAt) {
    const diffMs = data.openedAt.getTime() - data.sentAt.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24)
      responseTimeText = `발송 후 ${diffDays}일 만에 열람`
    } else if (diffHours > 0) {
      responseTimeText = `발송 후 ${diffHours}시간 ${diffMinutes}분 만에 열람`
    } else {
      responseTimeText = `발송 후 ${diffMinutes}분 만에 열람`
    }
  }

  // 바이어 정보 행
  const buyerInfoRow =
    data.buyerCompany || data.buyerTitle
      ? `
                  <tr>
                    <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                      <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">소속</span>
                    </td>
                    <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                      <span style="font-size: 14px; color: #111827; font-weight: 500;">${data.buyerCompany || "-"}</span>
                      ${data.buyerTitle ? `<span style="font-size: 13px; color: #6b7280; display: block; margin-top: 2px;">${data.buyerTitle}</span>` : ""}
                    </td>
                  </tr>`
      : ""

  // 응답 시간 행
  const responseTimeRow = responseTimeText
    ? `
                  <tr>
                    <td style="padding: 14px 16px;">
                      <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">응답 속도</span>
                    </td>
                    <td style="padding: 14px 16px;">
                      <span style="font-size: 14px; color: #059669; font-weight: 600;">${responseTimeText}</span>
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
                    <span style="font-size: 12px; color: #9ca3af;">${openedTimeKST}</span>
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
                          <span style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; color: #059669; font-size: 12px; font-weight: 600; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.5px;">이메일 열람 감지</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 12px;">
                          <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #111827;">
                            ${buyerDisplay}님이 발송하신 이메일을 확인했습니다
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
                      안녕하세요, ${data.userName}님.<br><br>
                      제가 대신 발송해드린 이메일을 <strong>${buyerDisplay}</strong>님이 열어보셨습니다.
                      잠재 고객이 귀사의 제안에 관심을 보이고 있다는 긍정적인 신호입니다.
                    </p>
                  </td>
                </tr>

                <!-- Email Details -->
                <tr>
                  <td style="padding: 24px 32px;">
                    <p style="margin: 0 0 16px; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">발송 이메일 정보</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px;">
                      <tr>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0; width: 120px;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">받는 사람</span>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 14px; color: #111827; font-weight: 500;">${data.buyerEmail}</span>
                        </td>
                      </tr>
                      ${buyerInfoRow}
                      <tr>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">제목</span>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 14px; color: #111827;">${subjectDisplay}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">열람 시간</span>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 14px; color: #111827;">${openedTimeKST}</span>
                        </td>
                      </tr>
                      ${responseTimeRow}
                    </table>
                  </td>
                </tr>

                <!-- Recommendation Section -->
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px;">
                      <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">RINDA의 권장 사항</p>
                      <p style="margin: 0 0 16px; font-size: 14px; color: #1e3a8a; line-height: 1.6;">
                        이메일 열람은 관심의 첫 번째 신호입니다. 다음 단계로의 전환을 위해 아래 액션을 고려해 주세요.
                      </p>
                      <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; color: #1e3a8a; line-height: 1.8;">
                        <li style="margin-bottom: 6px;">열람 후 24시간 내 후속 이메일 발송 시 응답률이 평균 2배 상승합니다</li>
                        <li style="margin-bottom: 6px;">바이어의 비즈니스에 맞춤화된 추가 자료를 첨부해 보세요</li>
                        <li>구체적인 미팅 일정을 제안하면 전환 가능성이 높아집니다</li>
                      </ul>
                    </div>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td style="padding: 0 32px 32px; text-align: center;">
                    <a href="${config.frontendUrl}/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
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

// ============================================================================
// Service Functions
// ============================================================================

/**
 * 워크스페이스가 체험판(trial) 상태인지 확인
 */
export async function isTrialWorkspace(workspaceId: string): Promise<boolean> {
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
 * 이메일 정보와 유저 정보, Unipile 계정 정보 조회
 */
async function getEmailWithUserAndAccountInfo(emailId: string): Promise<{
  email: typeof emailsTable.$inferSelect
  user: typeof users.$inferSelect
  workspace: typeof workspaces.$inferSelect
  emailAccount: typeof userEmailAccounts.$inferSelect
  lead: typeof leads.$inferSelect | null
} | null> {
  const result = await db
    .select({
      email: emailsTable,
      user: users,
      workspace: workspaces,
      emailAccount: userEmailAccounts,
      lead: leads,
    })
    .from(emailsTable)
    .innerJoin(userEmailAccounts, eq(emailsTable.userEmailAccountId, userEmailAccounts.id))
    .innerJoin(users, eq(userEmailAccounts.userId, users.id))
    .innerJoin(workspaces, eq(emailsTable.workspaceId, workspaces.id))
    .leftJoin(leads, eq(emailsTable.leadId, leads.id))
    .where(eq(emailsTable.id, emailId))
    .limit(1)

  return result[0] || null
}

/**
 * 유저의 Unipile 이메일 계정 조회 (알림 발송용)
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
    accountId: account.apiKey, // Unipile accountId는 apiKey 필드에 저장됨
    emailAddress: account.emailAddress,
  }
}

/**
 * 이메일 오픈 벨 알림 생성 (모든 사용자)
 * - notifications 테이블에 저장
 * - 우측 상단 알림 벨에 표시
 */
async function createEmailOpenBellNotification(params: {
  emailId: string
  userId: string
  workspaceId: string
  leadName: string | null
  leadId: string | null
  companyName: string | null
  toEmail: string
  subject: string | null
  sequenceId: string | null
  sequenceName: string | null
  openedAt: Date
}): Promise<void> {
  const {
    emailId,
    userId,
    workspaceId,
    leadName,
    leadId,
    companyName,
    toEmail,
    subject,
    sequenceId,
    sequenceName,
    openedAt,
  } = params

  // 표시할 이름 결정
  const displayName = leadName || toEmail.split("@")[0] || "바이어"

  // 메시지 구성
  const title = "이메일이 열람되었습니다"
  let message = `${displayName}님이 이메일을 확인했습니다`
  if (sequenceName) {
    message += `\n${sequenceName}`
  }

  await createNotification({
    userId,
    workspaceId,
    type: "info",
    priority: "normal",
    title,
    message,
    metadata: {
      emailId,
      leadId,
      leadName,
      companyName,
      toEmail,
      subject,
      sequenceId,
      sequenceName,
      openedAt: openedAt.toISOString(),
      actionUrl: "/dashboard",
      actionLabel: "대시보드 확인",
    },
    entityType: "email_open",
    entityId: emailId,
  })

  logger.info(
    { emailId, userId, leadName: displayName },
    "[EmailOpenNotification] Bell notification created",
  )
}

/**
 * 이메일 오픈 알림 발송
 * - 벨 알림: 모든 사용자 (notifications 테이블)
 * - 이메일 알림: 체험판 사용자만 (Unipile 발송)
 * - 최초 오픈 시에만 발송 (openCount === 1)
 */
export async function sendEmailOpenNotification(
  emailId: string,
  openedAt: Date,
): Promise<NotificationResult> {
  try {
    // 1. 이메일 및 유저 정보 조회
    const data = await getEmailWithUserAndAccountInfo(emailId)
    if (!data) {
      return { success: false, skipped: true, reason: "Email or user not found" }
    }

    const { email, user, workspace, lead } = data

    // 2. 최초 오픈인지 확인 (openCount가 1인 경우만)
    const [currentEmail] = await db
      .select({ openCount: emailsTable.openCount })
      .from(emailsTable)
      .where(eq(emailsTable.id, emailId))
      .limit(1)

    if (!currentEmail || currentEmail.openCount > 1) {
      logger.debug(
        { emailId, openCount: currentEmail?.openCount },
        "Skipping notification: not first open",
      )
      return { success: false, skipped: true, reason: "Not the first open" }
    }

    // 3. 벨 알림 생성 (모든 사용자)
    await createEmailOpenBellNotification({
      emailId,
      userId: user.id,
      workspaceId: workspace.id,
      leadName: email.leadName || lead?.contactName || null,
      leadId: email.leadId,
      companyName: lead?.companyName || null,
      toEmail: email.toEmail,
      subject: email.subject,
      sequenceId: email.sequenceId,
      sequenceName: email.sequenceName,
      openedAt,
    })

    // 4. 체험판 사용자인지 확인 (이메일 알림은 체험판만)
    const isTrial = await isTrialWorkspace(workspace.id)
    if (!isTrial) {
      logger.debug(
        { emailId, workspaceId: workspace.id },
        "Skipping Unipile email: not a trial workspace (bell notification created)",
      )
      return { success: true, skipped: false }
    }

    // 5. 유저의 Unipile 계정 조회
    const unipileAccount = await getUserUnipileAccount(user.id, workspace.id)
    if (!unipileAccount) {
      logger.warn(
        { userId: user.id, workspaceId: workspace.id },
        "No Unipile account found for user (bell notification created)",
      )
      return { success: true, skipped: false }
    }

    // 6. 알림 이메일 데이터 준비
    const buyerDisplay = email.leadName || lead?.contactName || email.toEmail.split("@")[0]
    const notificationData: EmailOpenNotificationData = {
      userId: user.id,
      userEmail: unipileAccount.emailAddress,
      userName: user.username,
      buyerEmail: email.toEmail,
      buyerName: email.leadName || lead?.contactName || null,
      buyerCompany: lead?.companyName || null,
      buyerTitle: null, // leads 스키마에 title 필드 없음
      emailSubject: email.subject,
      openedAt,
      sentAt: email.sentAt,
      openCount: currentEmail.openCount,
    }

    // 7. Unipile을 통해 알림 이메일 발송 (체험판 전용)
    const result = await unipileService.sendEmail({
      accountId: unipileAccount.accountId,
      to: unipileAccount.emailAddress, // 자신에게 발송
      subject: `[RINDA] ${buyerDisplay}님이 이메일을 열람했습니다`,
      body: generateEmailOpenNotificationHtml(notificationData),
    })

    if (!result.success) {
      logger.error(
        { error: result.error, emailId, userId: user.id },
        "Failed to send email open notification via Unipile (bell notification created)",
      )
      return { success: true, skipped: false, reason: result.error }
    }

    logger.info(
      {
        emailId,
        userId: user.id,
        userEmail: unipileAccount.emailAddress,
        buyerEmail: email.toEmail,
        unipileMessageId: result.messageId,
      },
      "Email open notification sent successfully via Unipile",
    )

    return { success: true, skipped: false }
  } catch (error) {
    logger.error({ error, emailId }, "Failed to send email open notification")
    return { success: false, skipped: false, reason: String(error) }
  }
}
