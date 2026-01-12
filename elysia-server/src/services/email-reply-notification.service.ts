/**
 * Email Reply Notification Service
 *
 * 답장 수신 시 알림 생성
 * - 벨 알림 (notifications 테이블)
 * - 중복 알림 방지 (email_replies 당 1회)
 */

import { eq } from "drizzle-orm"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails } from "../db/schema/emails"
import { leads } from "../db/schema/leads"
import { sequences } from "../db/schema/sequences"
import logger from "../utils/logger"
import { createNotification } from "./notification.service"

// ============================================================================
// Types
// ============================================================================

export interface ReplyNotificationParams {
  emailReplyId: string
  originalEmailId: string
  replyEmailId: string
  workspaceId: string
  isNewReply: boolean // insert인 경우 true, update인 경우 false
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * 답장 수신 알림 생성
 *
 * - 새로운 email_replies 레코드 생성 시에만 알림 (isNewReply === true)
 * - 기존 레코드 업데이트 시에는 알림 안 함 (동일 스레드 후속 답장)
 */
export async function notifyEmailReply(params: ReplyNotificationParams): Promise<boolean> {
  const { emailReplyId, originalEmailId, replyEmailId, workspaceId, isNewReply } = params

  // 기존 레코드 업데이트인 경우 알림 스킵 (동일 스레드 후속 답장)
  if (!isNewReply) {
    logger.debug(
      { emailReplyId, originalEmailId },
      "[ReplyNotification] Skipping notification for reply update (same thread)",
    )
    return false
  }

  try {
    // 1. 원본 이메일 정보 조회 (리드명, 캠페인명, userId)
    const [originalEmail] = await db
      .select({
        id: emails.id,
        leadId: emails.leadId,
        leadName: emails.leadName,
        sequenceId: emails.sequenceId,
        sequenceName: emails.sequenceName,
        toEmail: emails.toEmail,
        userEmailAccountId: emails.userEmailAccountId,
      })
      .from(emails)
      .where(eq(emails.id, originalEmailId))
      .limit(1)

    if (!originalEmail) {
      logger.warn({ originalEmailId }, "[ReplyNotification] Original email not found")
      return false
    }

    // 2. userId 조회 (userEmailAccounts에서)
    const [emailAccount] = await db
      .select({ userId: userEmailAccounts.userId })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.id, originalEmail.userEmailAccountId))
      .limit(1)

    if (!emailAccount?.userId) {
      logger.warn(
        { originalEmailId, userEmailAccountId: originalEmail.userEmailAccountId },
        "[ReplyNotification] User not found for email account",
      )
      return false
    }

    // 3. 리드명 결정 (denormalized 필드 우선, 없으면 leads 테이블 조회)
    let leadName = originalEmail.leadName
    if (!leadName && originalEmail.leadId) {
      const [lead] = await db
        .select({ contactName: leads.contactName, companyName: leads.companyName })
        .from(leads)
        .where(eq(leads.id, originalEmail.leadId))
        .limit(1)

      leadName = lead?.contactName || lead?.companyName || null
    }

    // 4. 캠페인명 결정 (denormalized 필드 우선, 없으면 sequences 테이블 조회)
    let sequenceName = originalEmail.sequenceName
    if (!sequenceName && originalEmail.sequenceId) {
      const [sequence] = await db
        .select({ name: sequences.name })
        .from(sequences)
        .where(eq(sequences.id, originalEmail.sequenceId))
        .limit(1)

      sequenceName = sequence?.name || null
    }

    // 5. 표시할 이름 결정
    const displayName = leadName || originalEmail.toEmail.split("@")[0] || "바이어"

    // 6. 메시지 구성
    const title = "답장이 도착했습니다"
    let message = `${displayName}님이 회신했습니다`
    if (sequenceName) {
      message += `\n${sequenceName}`
    }

    // 7. 알림 생성
    await createNotification({
      userId: emailAccount.userId,
      workspaceId,
      type: "success",
      priority: "high",
      title,
      message,
      metadata: {
        emailReplyId,
        originalEmailId,
        replyEmailId,
        leadId: originalEmail.leadId,
        leadName,
        sequenceId: originalEmail.sequenceId,
        sequenceName,
        actionUrl: "/replied-emails",
        actionLabel: "답장 확인",
      },
      entityType: "email_reply",
      entityId: emailReplyId,
    })

    logger.info(
      {
        emailReplyId,
        originalEmailId,
        userId: emailAccount.userId,
        leadName: displayName,
        sequenceName,
      },
      "[ReplyNotification] Reply notification created",
    )

    return true
  } catch (error) {
    logger.error(
      { error, emailReplyId, originalEmailId },
      "[ReplyNotification] Failed to create reply notification",
    )
    // 알림 실패는 메일 처리에 영향 주지 않음
    return false
  }
}
