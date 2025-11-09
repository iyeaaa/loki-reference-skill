import { and, eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db/index"
import { emailSignatures } from "../db/schema/email-signatures"
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

        if (!workspaceId || !userId) {
          return errorResponse("workspaceId and userId are required", ResponseCode.BAD_REQUEST)
        }

        const conditions = [eq(emailSignatures.userId, userId)]

        if (workspaceId && workspaceId !== "all") {
          conditions.push(eq(emailSignatures.workspaceId, workspaceId))
        }

        if (!includeInactive) {
          conditions.push(eq(emailSignatures.isActive, true))
        }

        const signatures = await db
          .select()
          .from(emailSignatures)
          .where(and(...conditions))
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
        workspaceId: t.String({ format: "uuid" }),
        userId: t.String({ format: "uuid" }),
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

        if (!workspaceId || !userId) {
          return errorResponse("workspaceId and userId are required", ResponseCode.BAD_REQUEST)
        }

        const [signature] = await db
          .select()
          .from(emailSignatures)
          .where(
            and(
              eq(emailSignatures.id, id),
              eq(emailSignatures.workspaceId, workspaceId),
              eq(emailSignatures.userId, userId),
            ),
          )
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
        userId: t.String({ format: "uuid" }),
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

        if (!workspaceId || !userId) {
          return errorResponse("workspaceId and userId are required", ResponseCode.BAD_REQUEST)
        }

        // If this signature is set as default, unset all other defaults
        if (isDefault) {
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
        userId: t.String({ format: "uuid" }),
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

        if (!workspaceId || !userId) {
          return errorResponse("workspaceId and userId are required", ResponseCode.BAD_REQUEST)
        }

        // Check if signature exists and belongs to user
        const [existing] = await db
          .select()
          .from(emailSignatures)
          .where(
            and(
              eq(emailSignatures.id, id),
              eq(emailSignatures.workspaceId, workspaceId),
              eq(emailSignatures.userId, userId),
            ),
          )
          .limit(1)

        if (!existing) {
          return errorResponse("Email signature not found", ResponseCode.NOT_FOUND)
        }

        // If setting as default, unset all other defaults
        if (body.isDefault) {
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
        userId: t.String({ format: "uuid" }),
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

        if (!workspaceId || !userId) {
          return errorResponse("workspaceId and userId are required", ResponseCode.BAD_REQUEST)
        }

        // Check if signature exists and belongs to user
        const [existing] = await db
          .select()
          .from(emailSignatures)
          .where(
            and(
              eq(emailSignatures.id, id),
              eq(emailSignatures.workspaceId, workspaceId),
              eq(emailSignatures.userId, userId),
            ),
          )
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
        userId: t.String({ format: "uuid" }),
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

        // Check if signature exists and belongs to user
        const [existing] = await db
          .select()
          .from(emailSignatures)
          .where(
            and(
              eq(emailSignatures.id, id),
              eq(emailSignatures.workspaceId, workspaceId),
              eq(emailSignatures.userId, userId),
            ),
          )
          .limit(1)

        if (!existing) {
          return errorResponse("Email signature not found", ResponseCode.NOT_FOUND)
        }

        // Unset all other defaults
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
