import { and, eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db/index"
import { emailSignatures } from "../db/schema/email-signatures"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"
import { errorResponse, ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

// Email Signature Schema
const emailSignatureSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  signatureHtml: t.String(),
  signatureText: t.String(),
  isDefault: t.Optional(t.Boolean()),
  isActive: t.Optional(t.Boolean()),
})

const updateEmailSignatureSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  signatureHtml: t.Optional(t.String()),
  signatureText: t.Optional(t.String()),
  isDefault: t.Optional(t.Boolean()),
  isActive: t.Optional(t.Boolean()),
})

export const emailSignatureRoutes = new Elysia({
  prefix: "/api/v1/email-signatures",
})
  // Get all signatures for a workspace
  .get(
    "/",
    async ({ query }) => {
      try {
        const { workspaceId, userId, includeInactive } = query

        if (!workspaceId) {
          return errorResponse("workspaceId is required", ResponseCode.BAD_REQUEST)
        }

        const conditions = []

        // workspaceId 필터 (필수, "all"이 아닌 경우에만)
        if (workspaceId && workspaceId !== "all") {
          conditions.push(eq(emailSignatures.workspaceId, workspaceId))
        }

        // userId 필터 (선택적 - 제공된 경우에만 필터링)
        if (userId) {
          conditions.push(eq(emailSignatures.userId, userId))
        }

        // 활성 상태 필터
        if (!includeInactive) {
          conditions.push(eq(emailSignatures.isActive, true))
        }

        // workspaceId가 "all"이고 userId도 없으면 활성 상태 필터만 적용
        // (모든 워크스페이스의 활성 서명 조회)
        // includeInactive가 false면 항상 활성 상태 필터가 있으므로 조건이 비어있을 수 없음
        const signatures = await db
          .select({
            id: emailSignatures.id,
            userId: emailSignatures.userId,
            workspaceId: emailSignatures.workspaceId,
            name: emailSignatures.name,
            signatureHtml: emailSignatures.signatureHtml,
            signatureText: emailSignatures.signatureText,
            isDefault: emailSignatures.isDefault,
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
          .orderBy(emailSignatures.isDefault, emailSignatures.createdAt)

        return {
          code: ResponseCode.SUCCESS,
          data: signatures,
        }
      } catch (error) {
        logger.error({ err: error }, "Failed to fetch email signatures")
        return errorResponse("Failed to fetch email signatures")
      }
    },
    {
      query: t.Object({
        workspaceId: t.Union([t.String({ format: "uuid" }), t.Literal("all")]),
        userId: t.Optional(t.String({ format: "uuid" })),
        includeInactive: t.Optional(t.Boolean()),
      }),
    },
  )

  // Get signature by ID
  .get(
    "/:id",
    async ({ params, query }) => {
      try {
        const { id } = params
        const { workspaceId, userId } = query

        if (!workspaceId) {
          return errorResponse("workspaceId is required", ResponseCode.BAD_REQUEST)
        }

        const conditions = [
          eq(emailSignatures.id, id),
          eq(emailSignatures.workspaceId, workspaceId),
        ]

        // userId 필터 (선택적)
        if (userId) {
          conditions.push(eq(emailSignatures.userId, userId))
        }

        const [signature] = await db
          .select()
          .from(emailSignatures)
          .where(and(...conditions))
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
      query: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        userId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Get default signature for a user
  .get(
    "/default",
    async ({ query }) => {
      try {
        const { workspaceId, userId } = query

        if (!workspaceId || !userId) {
          return errorResponse("workspaceId and userId are required", ResponseCode.BAD_REQUEST)
        }

        const [signature] = await db
          .select()
          .from(emailSignatures)
          .where(
            and(
              eq(emailSignatures.workspaceId, workspaceId),
              eq(emailSignatures.userId, userId),
              eq(emailSignatures.isDefault, true),
              eq(emailSignatures.isActive, true),
            ),
          )
          .limit(1)

        if (!signature) {
          return errorResponse("No default signature found", ResponseCode.NOT_FOUND)
        }

        return {
          code: ResponseCode.SUCCESS,
          data: signature,
        }
      } catch (error) {
        logger.error({ err: error }, "Failed to fetch default email signature")
        return errorResponse("Failed to fetch default signature")
      }
    },
    {
      query: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        userId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create a new signature
  .post(
    "/",
    async ({ body, query }) => {
      try {
        const { workspaceId, userId } = query
        const { name, signatureHtml, signatureText, isDefault, isActive } = body

        if (!workspaceId) {
          return errorResponse("workspaceId is required", ResponseCode.BAD_REQUEST)
        }

        // userId는 선택적이지만, 기본값 설정을 위해서는 필요
        // userId가 없으면 기본값 설정 불가
        if (isDefault && !userId) {
          return errorResponse(
            "userId is required when setting signature as default",
            ResponseCode.BAD_REQUEST,
          )
        }

        // If this signature is set as default, unset all other defaults for the user
        if (isDefault && userId) {
          await db
            .update(emailSignatures)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              and(
                eq(emailSignatures.workspaceId, workspaceId),
                eq(emailSignatures.userId, userId),
                eq(emailSignatures.isDefault, true),
              ),
            )
        }

        // userId가 없으면 현재 사용자 정보를 사용해야 하지만,
        // 여기서는 쿼리에서 가져온 userId를 사용 (없으면 에러)
        // 실제로는 인증된 사용자 정보를 사용해야 함
        if (!userId) {
          return errorResponse("userId is required", ResponseCode.BAD_REQUEST)
        }

        const [newSignature] = await db
          .insert(emailSignatures)
          .values({
            userId,
            workspaceId,
            name,
            signatureHtml,
            signatureText,
            isDefault: isDefault ?? false,
            isActive: isActive ?? true,
          })
          .returning()

        if (!newSignature) {
          return errorResponse("Failed to create email signature")
        }

        logger.info(
          { signatureId: newSignature.id, userId, workspaceId },
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
        workspaceId: t.String({ format: "uuid" }),
        userId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Update a signature
  .put(
    "/:id",
    async ({ params, body, query }) => {
      try {
        const { id } = params
        const { workspaceId, userId } = query

        if (!workspaceId) {
          return errorResponse("workspaceId is required", ResponseCode.BAD_REQUEST)
        }

        // Check if signature exists and belongs to workspace
        const conditions = [
          eq(emailSignatures.id, id),
          eq(emailSignatures.workspaceId, workspaceId),
        ]

        const [existing] = await db
          .select()
          .from(emailSignatures)
          .where(and(...conditions))
          .limit(1)

        if (!existing) {
          return errorResponse("Email signature not found", ResponseCode.NOT_FOUND)
        }

        // If setting as default, unset all other defaults for the user
        // userId가 있으면 해당 사용자의 기본값만 해제, 없으면 전체 워크스페이스의 기본값 해제
        if (body.isDefault) {
          const defaultConditions = [
            eq(emailSignatures.workspaceId, workspaceId),
            eq(emailSignatures.isDefault, true),
          ]

          if (userId) {
            defaultConditions.push(eq(emailSignatures.userId, userId))
          }

          await db
            .update(emailSignatures)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(and(...defaultConditions))
        }

        const [updatedSignature] = await db
          .update(emailSignatures)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(emailSignatures.id, id))
          .returning()

        logger.info({ signatureId: id, userId, workspaceId }, "Email signature updated")

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
      query: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        userId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Delete a signature (soft delete by setting isActive to false)
  .delete(
    "/:id",
    async ({ params, query }) => {
      try {
        const { id } = params
        const { workspaceId, userId, hardDelete } = query

        if (!workspaceId) {
          return errorResponse("workspaceId is required", ResponseCode.BAD_REQUEST)
        }

        // Check if signature exists and belongs to workspace
        const conditions = [
          eq(emailSignatures.id, id),
          eq(emailSignatures.workspaceId, workspaceId),
        ]

        const [existing] = await db
          .select()
          .from(emailSignatures)
          .where(and(...conditions))
          .limit(1)

        if (!existing) {
          return errorResponse("Email signature not found", ResponseCode.NOT_FOUND)
        }

        if (hardDelete) {
          // Hard delete
          await db.delete(emailSignatures).where(eq(emailSignatures.id, id))
          logger.info({ signatureId: id, userId, workspaceId }, "Email signature deleted")
        } else {
          // Soft delete
          await db
            .update(emailSignatures)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(emailSignatures.id, id))
          logger.info({ signatureId: id, userId, workspaceId }, "Email signature deactivated")
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
        workspaceId: t.String({ format: "uuid" }),
        userId: t.Optional(t.String({ format: "uuid" })),
        hardDelete: t.Optional(t.Boolean()),
      }),
    },
  )

  // Set signature as default
  .patch(
    "/:id/set-default",
    async ({ params, query }) => {
      try {
        const { id } = params
        const { workspaceId, userId } = query

        if (!workspaceId || !userId) {
          return errorResponse("workspaceId and userId are required", ResponseCode.BAD_REQUEST)
        }

        // Check if signature exists and belongs to workspace
        const [existing] = await db
          .select()
          .from(emailSignatures)
          .where(and(eq(emailSignatures.id, id), eq(emailSignatures.workspaceId, workspaceId)))
          .limit(1)

        if (!existing) {
          return errorResponse("Email signature not found", ResponseCode.NOT_FOUND)
        }

        // Unset all other defaults for this user
        await db
          .update(emailSignatures)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(emailSignatures.workspaceId, workspaceId),
              eq(emailSignatures.userId, userId),
              eq(emailSignatures.isDefault, true),
            ),
          )

        // Set this signature as default
        const [updatedSignature] = await db
          .update(emailSignatures)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(emailSignatures.id, id))
          .returning()

        logger.info({ signatureId: id, userId, workspaceId }, "Email signature set as default")

        return {
          code: ResponseCode.SUCCESS,
          data: updatedSignature,
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
      query: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        userId: t.String({ format: "uuid" }),
      }),
    },
  )
