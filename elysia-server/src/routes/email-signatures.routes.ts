import { and, eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db/index"
import { emailSignatures } from "../db/schema/email-signatures"
import { userSignaturePreferences } from "../db/schema/user-signature-preferences"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"
import * as authService from "../services/auth.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

// Email Signature Schema
const emailSignatureSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  signatureHtml: t.String(),
  signatureText: t.String(),
  isActive: t.Optional(t.Boolean()),
})

const updateEmailSignatureSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  signatureHtml: t.Optional(t.String()),
  signatureText: t.Optional(t.String()),
  isActive: t.Optional(t.Boolean()),
})

// Helper function to get userId from JWT token
async function getUserIdFromToken(authorization?: string): Promise<string | null> {
  if (!authorization) {
    logger.debug("No authorization header provided")
    return null
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim()
  if (!token) {
    logger.debug("No token found in authorization header")
    return null
  }

  try {
    const payload = await authService.verifyToken(token)
    logger.debug({ userId: payload.userId }, "Successfully extracted userId from token")
    return payload.userId
  } catch (error) {
    // Log detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.warn(
      {
        err: error,
        errorMessage,
        tokenLength: token.length,
        tokenPrefix: `${token.substring(0, 20)}...`,
      },
      "Failed to verify token",
    )
    return null
  }
}

export const emailSignatureRoutes = new Elysia({
  prefix: "/api/v1/email-signatures",
})
  // Get all signatures (모든 서명 조회, workspaceId/userId 무관)
  .get(
    "/",
    async ({ query, headers }) => {
      try {
        const { includeInactive } = query

        // JWT에서 userId 추출 (기본 서명 표시용)
        const currentUserId = await getUserIdFromToken(headers.authorization)

        const conditions = []

        // 활성 상태 필터
        if (includeInactive === false) {
          conditions.push(eq(emailSignatures.isActive, true))
        }

        // 모든 서명 조회 (workspaceId, userId 필터 없음)
        const signatures = await db
          .select({
            id: emailSignatures.id,
            userId: emailSignatures.userId,
            workspaceId: emailSignatures.workspaceId,
            name: emailSignatures.name,
            signatureHtml: emailSignatures.signatureHtml,
            signatureText: emailSignatures.signatureText,
            isActive: emailSignatures.isActive,
            createdAt: emailSignatures.createdAt,
            updatedAt: emailSignatures.updatedAt,
            workspaceName: workspaces.name,
            userName: users.username,
            userEmail: users.email,
          })
          .from(emailSignatures)
          .leftJoin(workspaces, eq(emailSignatures.workspaceId, workspaces.id))
          .leftJoin(users, eq(emailSignatures.userId, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(emailSignatures.createdAt)

        // 현재 유저의 기본 서명 ID 가져오기
        let defaultSignatureId: string | null = null
        if (currentUserId) {
          const [preference] = await db
            .select({ signatureId: userSignaturePreferences.signatureId })
            .from(userSignaturePreferences)
            .where(eq(userSignaturePreferences.userId, currentUserId))
            .limit(1)

          if (preference) {
            defaultSignatureId = preference.signatureId
          }
        }

        // 기본 서명 여부 추가
        const signaturesWithDefault = signatures.map((sig) => ({
          ...sig,
          isDefault: sig.id === defaultSignatureId,
        }))

        logger.info(
          {
            includeInactive,
            signaturesCount: signatures.length,
            defaultSignatureId,
          },
          "Fetched email signatures",
        )

        return {
          code: ResponseCode.SUCCESS,
          data: signaturesWithDefault,
        }
      } catch (error) {
        logger.error({ err: error }, "Failed to fetch email signatures")
        return errorResponse("Failed to fetch email signatures")
      }
    },
    {
      query: t.Object({
        includeInactive: t.Optional(t.Boolean()),
      }),
    },
  )

  // Get signature by ID
  .get(
    "/:id",
    async ({ params }) => {
      try {
        const { id } = params

        const [signature] = await db
          .select()
          .from(emailSignatures)
          .where(eq(emailSignatures.id, id))
          .limit(1)

        if (!signature) {
          return errorResponse("Email signature not found", ResponseCode.NOT_FOUND)
        }

        return {
          code: ResponseCode.SUCCESS,
          data: signature,
        }
      } catch (error) {
        logger.error({ err: error, id: params.id }, "Failed to fetch email signature")
        return errorResponse("Failed to fetch email signature")
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get default signature for current user (JWT에서 userId 추출)
  .get("/default", async ({ headers }) => {
    try {
      // POST / 엔드포인트와 동일한 방식으로 토큰 처리
      const userId = await getUserIdFromToken(headers.authorization)

      if (!userId) {
        return errorResponse("인증 토큰이 없거나 유효하지 않습니다.", ResponseCode.UNAUTHORIZED)
      }

      const [preference] = await db
        .select({
          signature: emailSignatures,
        })
        .from(userSignaturePreferences)
        .innerJoin(emailSignatures, eq(userSignaturePreferences.signatureId, emailSignatures.id))
        .where(and(eq(userSignaturePreferences.userId, userId), eq(emailSignatures.isActive, true)))
        .limit(1)

      if (!preference) {
        return errorResponse("No default signature found", ResponseCode.NOT_FOUND)
      }

      return {
        code: ResponseCode.SUCCESS,
        data: preference.signature,
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to fetch default email signature")
      return errorResponse("Failed to fetch default signature")
    }
  })

  // Create a new signature
  .post(
    "/",
    async ({ body, query, headers }) => {
      try {
        const { workspaceId } = query
        const { name, signatureHtml, signatureText, isActive } = body

        // JWT에서 userId 추출 (생성자 추적용)
        const actualUserId = await getUserIdFromToken(headers.authorization)

        const [newSignature] = await db
          .insert(emailSignatures)
          .values({
            userId: actualUserId,
            workspaceId: workspaceId || null, // 선택적
            name,
            signatureHtml,
            signatureText,
            isActive: isActive ?? true,
          })
          .returning()

        if (!newSignature) {
          return errorResponse("Failed to create email signature")
        }

        logger.info(
          { signatureId: newSignature.id, userId: actualUserId, workspaceId },
          "Email signature created",
        )

        return {
          code: ResponseCode.SUCCESS,
          data: newSignature,
        }
      } catch (error) {
        logger.error({ err: error }, "Failed to create email signature")
        return errorResponse("Failed to create email signature")
      }
    },
    {
      body: emailSignatureSchema,
      query: t.Object({
        workspaceId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Update a signature (모든 사용자가 수정 가능)
  .put(
    "/:id",
    async ({ params, body }) => {
      try {
        const { id } = params

        // Check if signature exists
        const [existing] = await db
          .select()
          .from(emailSignatures)
          .where(eq(emailSignatures.id, id))
          .limit(1)

        if (!existing) {
          return errorResponse("Email signature not found", ResponseCode.NOT_FOUND)
        }

        const [updatedSignature] = await db
          .update(emailSignatures)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(emailSignatures.id, id))
          .returning()

        logger.info({ signatureId: id }, "Email signature updated")

        return {
          code: ResponseCode.SUCCESS,
          data: updatedSignature,
        }
      } catch (error) {
        logger.error({ err: error, id: params.id }, "Failed to update email signature")
        return errorResponse("Failed to update email signature")
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateEmailSignatureSchema,
    },
  )

  // Delete a signature (모든 사용자가 삭제 가능)
  .delete(
    "/:id",
    async ({ params, query }) => {
      try {
        const { id } = params
        const { hardDelete } = query

        // Check if signature exists
        const [existing] = await db
          .select()
          .from(emailSignatures)
          .where(eq(emailSignatures.id, id))
          .limit(1)

        if (!existing) {
          return errorResponse("Email signature not found", ResponseCode.NOT_FOUND)
        }

        if (hardDelete) {
          // Hard delete
          await db.delete(emailSignatures).where(eq(emailSignatures.id, id))
          logger.info({ signatureId: id }, "Email signature deleted")
        } else {
          // Soft delete
          await db
            .update(emailSignatures)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(emailSignatures.id, id))
          logger.info({ signatureId: id }, "Email signature deactivated")
        }

        return {
          code: ResponseCode.SUCCESS,
          data: { id },
        }
      } catch (error) {
        logger.error({ err: error, id: params.id }, "Failed to delete email signature")
        return errorResponse("Failed to delete email signature")
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        hardDelete: t.Optional(t.Boolean()),
      }),
    },
  )

  // Set signature as default (userId extracted from auth token)
  .patch(
    "/:id/set-default",
    async ({ params, headers, set }) => {
      try {
        const { id } = params
        const userId = await getUserIdFromToken(headers.authorization)

        if (!userId) {
          set.status = 401
          return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
        }

        // Check if signature exists
        const [existing] = await db
          .select()
          .from(emailSignatures)
          .where(eq(emailSignatures.id, id))
          .limit(1)

        if (!existing) {
          return errorResponse("Email signature not found", ResponseCode.NOT_FOUND)
        }

        // Check if signature is active
        if (!existing.isActive) {
          return errorResponse("Cannot set inactive signature as default", ResponseCode.BAD_REQUEST)
        }

        // UPSERT: 기존 기본값이 있으면 업데이트, 없으면 삽입
        const [preference] = await db
          .insert(userSignaturePreferences)
          .values({
            userId,
            signatureId: id,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: userSignaturePreferences.userId,
            set: {
              signatureId: id,
              updatedAt: new Date(),
            },
          })
          .returning()

        logger.info({ signatureId: id, userId }, "Email signature set as default")

        return {
          code: ResponseCode.SUCCESS,
          data: preference,
        }
      } catch (error) {
        logger.error({ err: error, id: params.id }, "Failed to set default signature")
        return errorResponse("Failed to set default signature")
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )
