import { and, eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails } from "../db/schema/emails"
import { emailService } from "../services/email.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

// CSV 데이터 스키마
const bulkEmailSchema = t.Object({
  workspaceId: t.String({ format: "uuid" }),
  userId: t.String({ format: "uuid" }),
  emails: t.Array(
    t.Object({
      fromEmail: t.String({ format: "email", maxLength: 255 }),
      toEmail: t.String({ format: "email", maxLength: 255 }),
      subject: t.String({ minLength: 1, maxLength: 500 }),
      bodyText: t.Optional(t.String()),
      bodyHtml: t.Optional(t.String()),
      fromName: t.Optional(t.String({ maxLength: 255 })),
    }),
  ),
})

export const bulkEmailRoutes = new Elysia({ prefix: "/api/v1/bulk-emails" })
  // 대량 이메일 발송
  .post(
    "/send",
    async ({ body, set }) => {
      try {
        logger.info(
          {
            workspaceId: body.workspaceId,
            userId: body.userId,
            emailCount: body.emails.length,
          },
          "대량 이메일 발송 요청 시작",
        )

        // 사용자의 이메일 계정 찾기
        const [emailAccount] = await db
          .select({
            id: userEmailAccounts.id,
            emailAddress: userEmailAccounts.emailAddress,
            displayName: userEmailAccounts.displayName,
            apiKey: userEmailAccounts.apiKey,
            status: userEmailAccounts.status,
            isVerified: userEmailAccounts.isVerified,
          })
          .from(userEmailAccounts)
          .where(
            and(
              eq(userEmailAccounts.workspaceId, body.workspaceId),
              eq(userEmailAccounts.userId, body.userId),
              eq(userEmailAccounts.status, "active"),
            ),
          )
          .limit(1)

        if (!emailAccount) {
          logger.error(
            {
              workspaceId: body.workspaceId,
              userId: body.userId,
            },
            "활성화된 이메일 계정을 찾을 수 없음",
          )
          set.status = 404
          return errorResponse(
            "해당 워크스페이스와 사용자에 대한 활성화된 이메일 계정을 찾을 수 없습니다.",
            ResponseCode.NOT_FOUND,
          )
        }

        if (!emailAccount.isVerified) {
          set.status = 400
          return errorResponse(
            "이메일 계정이 인증되지 않았습니다. 먼저 이메일 계정을 인증해주세요.",
            ResponseCode.VALIDATION_ERROR,
          )
        }

        const apiKey = emailAccount.apiKey
        const results: Array<{
          toEmail: string
          subject: string
          success: boolean
          error?: string
          emailId?: string
        }> = []

        // 각 이메일을 순차적으로 발송
        for (const emailData of body.emails) {
          try {
            const fromEmail = emailData.fromEmail
            const fromName =
              emailData.fromName || emailAccount.displayName || emailAccount.emailAddress

            logger.info(
              {
                from: `${fromName} <${fromEmail}>`,
                to: emailData.toEmail,
                subject: emailData.subject,
              },
              "이메일 발송 중",
            )

            // SendGrid로 이메일 발송
            const sendResult = await emailService.sendEmail({
              fromEmail: fromEmail,
              fromName: fromName,
              toEmail: emailData.toEmail,
              subject: emailData.subject,
              bodyText: emailData.bodyText,
              bodyHtml: emailData.bodyHtml,
              apiKey: apiKey,
            })

            if (!sendResult.success) {
              logger.error(
                {
                  error: sendResult.error,
                  fromEmail,
                  toEmail: emailData.toEmail,
                },
                "이메일 발송 실패",
              )
              results.push({
                toEmail: emailData.toEmail,
                subject: emailData.subject,
                success: false,
                error: sendResult.error || "이메일 발송에 실패했습니다.",
              })
              continue
            }

            logger.info(
              {
                messageId: sendResult.messageId,
                sendgridMessageId: sendResult.sendgridMessageId,
              },
              "이메일 발송 성공",
            )

            // 데이터베이스에 저장
            try {
              const [savedEmail] = await db
                .insert(emails)
                .values({
                  workspaceId: body.workspaceId,
                  userEmailAccountId: emailAccount.id,
                  direction: "outbound",
                  fromEmail: fromEmail,
                  toEmail: emailData.toEmail,
                  subject: emailData.subject,
                  bodyText: emailData.bodyText || null,
                  bodyHtml: emailData.bodyHtml || null,
                  status: "sent",
                  sentAt: new Date(),
                  messageId: sendResult.messageId,
                  sendgridMessageId: sendResult.sendgridMessageId,
                  threadId: sendResult.messageId,
                })
                .returning()

              if (savedEmail) {
                results.push({
                  toEmail: emailData.toEmail,
                  subject: emailData.subject,
                  success: true,
                  emailId: savedEmail.id,
                })

                logger.info(
                  {
                    emailId: savedEmail.id,
                    messageId: sendResult.messageId,
                  },
                  "이메일 저장 완료",
                )
              } else {
                throw new Error("이메일 저장 실패: savedEmail is undefined")
              }
            } catch (dbError: unknown) {
              logger.error(
                {
                  err: dbError,
                  messageId: sendResult.messageId,
                },
                "이메일 저장 실패 (발송은 성공)",
              )
              results.push({
                toEmail: emailData.toEmail,
                subject: emailData.subject,
                success: true,
                error: "이메일은 발송되었으나 저장에 실패했습니다.",
              })
            }
          } catch (emailError: unknown) {
            logger.error(
              {
                err: emailError,
                toEmail: emailData.toEmail,
              },
              "이메일 처리 중 오류 발생",
            )
            results.push({
              toEmail: emailData.toEmail,
              subject: emailData.subject,
              success: false,
              error:
                emailError instanceof Error
                  ? emailError.message
                  : "이메일 처리 중 오류가 발생했습니다.",
            })
          }
        }

        const successCount = results.filter((r) => r.success).length
        const failCount = results.filter((r) => !r.success).length

        logger.info(
          {
            total: results.length,
            success: successCount,
            fail: failCount,
          },
          "대량 이메일 발송 완료",
        )

        return {
          success: true,
          code: "S200",
          message: `${successCount}개의 이메일이 발송되었습니다. (실패: ${failCount}개)`,
          data: {
            total: results.length,
            successCount,
            failCount,
            results,
          },
          timestamp: new Date().toISOString(),
        }
      } catch (error: unknown) {
        logger.error({ err: error }, "대량 이메일 발송 중 오류 발생")
        set.status = 500
        return errorResponse(
          "대량 이메일 발송 중 오류가 발생했습니다.",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: bulkEmailSchema,
    },
  )
