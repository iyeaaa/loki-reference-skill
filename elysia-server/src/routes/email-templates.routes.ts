import { Elysia, t } from "elysia"
import * as emailTemplateService from "../services/email-template.service"
import { errorResponse, ResponseCode } from "../types/response.types"

const emailTemplateSchema = t.Object({
  workspaceId: t.String({ format: "uuid" }),
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  subject: t.String({ minLength: 1, maxLength: 500 }),
  bodyText: t.Optional(t.Union([t.String(), t.Null()])),
  bodyHtml: t.Optional(t.Union([t.String(), t.Null()])),
  variables: t.Optional(t.Any()),
  category: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  isShared: t.Optional(t.Boolean()),
  createdBy: t.Optional(t.String({ format: "uuid" })),
})

const updateEmailTemplateSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  subject: t.String({ minLength: 1, maxLength: 500 }),
  bodyText: t.Optional(t.Union([t.String(), t.Null()])),
  bodyHtml: t.Optional(t.Union([t.String(), t.Null()])),
  variables: t.Optional(t.Any()),
  category: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  isShared: t.Boolean(),
})

export const emailTemplateRoutes = new Elysia({ prefix: "/api/v1/email-templates" })
  // Search email templates with filters (must be before /:id route)
  .get(
    "/search",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      // Parse workspaceIds and createdByIds from comma-separated string
      const workspaceIds = query.workspaceIds
        ? query.workspaceIds.split(",").filter(Boolean)
        : undefined
      const createdByIds = query.createdByIds
        ? query.createdByIds.split(",").filter(Boolean)
        : undefined

      const filters = {
        isShared: query.isShared ? query.isShared === "true" : undefined,
        search: query.search,
        category: query.category,
        workspaceIds,
        createdByIds,
      }

      const templates = await emailTemplateService.listEmailTemplatesWithFilters(
        limit,
        offset,
        filters,
      )
      const total = await emailTemplateService.countEmailTemplatesWithFilters(filters)

      return {
        data: templates,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        isShared: t.Optional(t.String()),
        search: t.Optional(t.String()),
        category: t.Optional(t.String()),
        workspaceIds: t.Optional(t.String()),
        createdByIds: t.Optional(t.String()),
      }),
    },
  )

  // Get template categories for workspace
  .get(
    "/workspace/:workspaceId/categories",
    async ({ params: { workspaceId } }) => {
      const categories = await emailTemplateService.getTemplateCategories(workspaceId)
      return categories
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get shared templates for workspace
  .get(
    "/workspace/:workspaceId/shared",
    async ({ params: { workspaceId } }) => {
      const templates = await emailTemplateService.getSharedEmailTemplates(workspaceId)
      return templates
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get email template by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const template = await emailTemplateService.getEmailTemplate(id)
      if (!template) {
        set.status = 404
        return errorResponse("이메일 템플릿을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return template
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create new email template
  .post(
    "/",
    async ({ body }) => {
      const template = await emailTemplateService.createEmailTemplate(body)
      return template
    },
    {
      body: emailTemplateSchema,
    },
  )

  // Update email template
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      try {
        // Convert undefined to null for optional fields
        const updateData = {
          ...body,
          description: body.description ?? null,
          bodyText: body.bodyText ?? null,
          bodyHtml: body.bodyHtml ?? null,
          category: body.category ?? null,
        }
        const template = await emailTemplateService.updateEmailTemplate(id, updateData)
        if (!template) {
          set.status = 404
          return errorResponse("이메일 템플릿을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
        }
        return template
      } catch (error) {
        console.error("Error updating email template:", error)
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "템플릿 업데이트에 실패했습니다.",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateEmailTemplateSchema,
    },
  )

  // Delete email template
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      await emailTemplateService.deleteEmailTemplate(id)
      return { success: true, message: "이메일 템플릿이 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // List email templates with pagination
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const templates = await emailTemplateService.listEmailTemplates(limit, offset)
      const total = await emailTemplateService.countEmailTemplates()

      return {
        data: templates,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Get email templates by workspace
  .get(
    "/workspace/:workspaceId",
    async ({ params: { workspaceId } }) => {
      const templates = await emailTemplateService.getEmailTemplatesByWorkspace(workspaceId)
      return templates
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get email templates by category
  .get(
    "/workspace/:workspaceId/category/:category",
    async ({ params: { workspaceId, category } }) => {
      const templates = await emailTemplateService.getEmailTemplatesByCategory(
        workspaceId,
        category,
      )
      return templates
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        category: t.String(),
      }),
    },
  )

// Admin bulk update routes
export const adminEmailTemplateRoutes = new Elysia({ prefix: "/api/v1/admin/email-templates" })
  // Bulk delete
  .delete(
    "/bulk",
    async ({ body }) => {
      const deletedCount = await emailTemplateService.bulkDeleteEmailTemplates(body.templateIds)
      return { deletedCount }
    },
    {
      body: t.Object({
        templateIds: t.Array(t.String({ format: "uuid" })),
      }),
    },
  )

  // Bulk update category
  .put(
    "/bulk/category",
    async ({ body }) => {
      const updatedCount = await emailTemplateService.bulkUpdateCategory(
        body.templateIds,
        body.category,
      )
      return { updatedCount }
    },
    {
      body: t.Object({
        templateIds: t.Array(t.String({ format: "uuid" })),
        category: t.String({ maxLength: 100 }),
      }),
    },
  )

  // Bulk update shared
  .put(
    "/bulk/shared",
    async ({ body }) => {
      const updatedCount = await emailTemplateService.bulkUpdateShared(
        body.templateIds,
        body.isShared,
      )
      return { updatedCount }
    },
    {
      body: t.Object({
        templateIds: t.Array(t.String({ format: "uuid" })),
        isShared: t.Boolean(),
      }),
    },
  )
