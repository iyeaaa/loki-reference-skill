import { Elysia, t } from "elysia"
import * as websetsService from "../services/websets.service"
import { ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

// Request schemas
const websetSchema = t.Object({
  workspaceId: t.String({ format: "uuid" }),
  title: t.Optional(t.String({ maxLength: 255 })),
  query: t.String({ minLength: 1 }),
  criterias: t.Optional(t.Array(t.String())),
  targetValidatedRows: t.Optional(t.Number({ minimum: 1, maximum: 10000 })),
})

const updateWebsetSchema = t.Object({
  title: t.Optional(t.String({ maxLength: 255 })),
  query: t.Optional(t.String({ minLength: 1 })),
  criterias: t.Optional(t.Array(t.String())),
  targetValidatedRows: t.Optional(t.Number({ minimum: 1, maximum: 10000 })),
})

const websetRowSchema = t.Object({
  data: t.Record(t.String(), t.Any()),
  criteriaAnswers: t.Optional(t.Array(t.Boolean())),
})

const updateWebsetRowSchema = t.Object({
  data: t.Optional(t.Record(t.String(), t.Any())),
  criteriaAnswers: t.Optional(t.Array(t.Boolean())),
})

// Response schemas
const websetResponseSchema = t.Object({
  id: t.String({ format: "uuid" }),
  workspaceId: t.String({ format: "uuid" }),
  title: t.Optional(t.Nullable(t.String())),
  query: t.String(),
  criterias: t.Optional(t.Nullable(t.Array(t.String()))),
  targetValidatedRows: t.Optional(t.Nullable(t.Number())),
  createdAt: t.String(),
  updatedAt: t.String(),
  workspaceName: t.Optional(t.Nullable(t.String())),
})

const websetRowResponseSchema = t.Object({
  id: t.String({ format: "uuid" }),
  websetId: t.String({ format: "uuid" }),
  data: t.Record(t.String(), t.Any()),
  criteriaAnswers: t.Optional(t.Nullable(t.Array(t.Boolean()))),
  createdAt: t.String(),
  updatedAt: t.String(),
})

const websetsListResponseSchema = t.Object({
  data: t.Array(websetResponseSchema),
  total: t.Number(),
  limit: t.Number(),
  offset: t.Number(),
})

const websetRowsListResponseSchema = t.Object({
  rows: t.Array(websetRowResponseSchema),
  total: t.Number(),
  limit: t.Number(),
  offset: t.Number(),
})

const criteriaResponseSchema = t.Object({
  rewrittenQuery: t.String(),
  validationCriteria: t.Array(t.String()),
})

// Error response schemas
const errorResponseSchema = t.Object({
  success: t.Literal(false),
  code: t.String(),
  message: t.String(),
  timestamp: t.String(),
})

export const websetRoutes = new Elysia({ prefix: "/api/v1/websets", tags: ["Websets"] })
  // Get all websets for a workspace
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const workspaceId = query.workspaceId
        const limit = Math.min(parseInt(query.limit || "10", 10), 100)
        const offset = parseInt(query.offset || "0", 10)

        const result = await websetsService.getAllWebsets(workspaceId, limit, offset)

        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Websets retrieved successfully",
          data: result,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, workspaceId: query.workspaceId }, "Error retrieving websets")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to retrieve websets",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      query: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: websetsListResponseSchema,
          timestamp: t.String(),
        }),
        500: errorResponseSchema,
      },
    },
  )

  // Get webset by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      try {
        const webset = await websetsService.getWebset(id)
        if (!webset) {
          set.status = 404
          return {
            success: false as const,
            code: ResponseCode.NOT_FOUND,
            message: "Webset not found",
            timestamp: new Date().toISOString(),
          }
        }
        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Webset retrieved successfully",
          data: webset,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, id }, "Error retrieving webset")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to retrieve webset",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: websetResponseSchema,
          timestamp: t.String(),
        }),
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  )

  // Create new webset
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const webset = await websetsService.createWebset(body)
        set.status = 201
        return {
          success: true as const,
          code: ResponseCode.CREATED,
          message: "Webset created successfully",
          data: webset,
          timestamp: new Date().toISOString(),
        }
      } catch (error: unknown) {
        logger.error({ error }, "Error creating webset")

        // Handle foreign key constraint violations (check both error and error.cause)
        const dbError =
          (error && typeof error === "object" && "cause" in error ? error.cause : error) || error
        if (
          dbError &&
          typeof dbError === "object" &&
          "code" in dbError &&
          dbError.code === "23503" &&
          "constraint" in dbError &&
          dbError.constraint === "websets_workspace_id_workspaces_id_fk"
        ) {
          set.status = 400
          return {
            success: false as const,
            code: ResponseCode.VALIDATION_ERROR,
            message: "Invalid workspace ID: workspace does not exist",
            timestamp: new Date().toISOString(),
          }
        }

        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to create webset",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      body: websetSchema,
      response: {
        201: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: websetResponseSchema,
          timestamp: t.String(),
        }),
        400: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  )

  // Update webset (primarily for targetValidatedRows)
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      try {
        const webset = await websetsService.getWebset(id)
        if (!webset) {
          set.status = 404
          return {
            success: false as const,
            code: ResponseCode.NOT_FOUND,
            message: "Webset not found",
            timestamp: new Date().toISOString(),
          }
        }

        const updatedWebset = await websetsService.updateWebset(id, body)
        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Webset updated successfully",
          data: updatedWebset,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, id }, "Error updating webset")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to update webset",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateWebsetSchema,
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: websetResponseSchema,
          timestamp: t.String(),
        }),
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  )

  // Delete webset
  .delete(
    "/:id",
    async ({ params: { id }, set }) => {
      try {
        const webset = await websetsService.getWebset(id)
        if (!webset) {
          set.status = 404
          return {
            success: false as const,
            code: ResponseCode.NOT_FOUND,
            message: "Webset not found",
            timestamp: new Date().toISOString(),
          }
        }

        await websetsService.deleteWebset(id)
        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Webset deleted successfully",
          data: null,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, id }, "Error deleting webset")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to delete webset",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: t.Null(),
          timestamp: t.String(),
        }),
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  )

  // Get all rows for a webset
  .get(
    "/:id/rows",
    async ({ params: { id }, query, set }) => {
      try {
        const webset = await websetsService.getWebset(id)
        if (!webset) {
          set.status = 404
          return {
            success: false as const,
            code: ResponseCode.NOT_FOUND,
            message: "Webset not found",
            timestamp: new Date().toISOString(),
          }
        }

        const limit = Math.min(parseInt(query.limit || "100", 10), 1000)
        const offset = parseInt(query.offset || "0", 10)

        const result = await websetsService.getAllWebsetRows(id, limit, offset)
        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Webset rows retrieved successfully",
          data: result,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, websetId: id }, "Error retrieving webset rows")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to retrieve webset rows",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: websetRowsListResponseSchema,
          timestamp: t.String(),
        }),
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  )

  // Create new row for a webset
  .post(
    "/:id/rows",
    async ({ params: { id }, body, set }) => {
      try {
        const webset = await websetsService.getWebset(id)
        if (!webset) {
          set.status = 404
          return {
            success: false as const,
            code: ResponseCode.NOT_FOUND,
            message: "Webset not found",
            timestamp: new Date().toISOString(),
          }
        }

        const row = await websetsService.createWebsetRow({
          websetId: id,
          ...body,
        })
        set.status = 201
        return {
          success: true as const,
          code: ResponseCode.CREATED,
          message: "Webset row created successfully",
          data: row,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, websetId: id }, "Error creating webset row")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to create webset row",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: websetRowSchema,
      response: {
        201: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: websetRowResponseSchema,
          timestamp: t.String(),
        }),
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  )

  // Update webset row
  .put(
    "/:id/rows/:rowId",
    async ({ params: { id, rowId }, body, set }) => {
      try {
        const webset = await websetsService.getWebset(id)
        if (!webset) {
          set.status = 404
          return {
            success: false as const,
            code: ResponseCode.NOT_FOUND,
            message: "Webset not found",
            timestamp: new Date().toISOString(),
          }
        }

        const updatedRow = await websetsService.updateWebsetRow(rowId, body)
        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Webset row updated successfully",
          data: updatedRow,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, websetId: id, rowId }, "Error updating webset row")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to update webset row",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        rowId: t.String({ format: "uuid" }),
      }),
      body: updateWebsetRowSchema,
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: websetRowResponseSchema,
          timestamp: t.String(),
        }),
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  )

  // Delete webset row
  .delete(
    "/:id/rows/:rowId",
    async ({ params: { id, rowId }, set }) => {
      try {
        const webset = await websetsService.getWebset(id)
        if (!webset) {
          set.status = 404
          return {
            success: false as const,
            code: ResponseCode.NOT_FOUND,
            message: "Webset not found",
            timestamp: new Date().toISOString(),
          }
        }

        await websetsService.deleteWebsetRow(rowId)
        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Webset row deleted successfully",
          data: null,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, websetId: id, rowId }, "Error deleting webset row")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to delete webset row",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        rowId: t.String({ format: "uuid" }),
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: t.Null(),
          timestamp: t.String(),
        }),
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  )

  // Run webset - execute query and process results
  .post(
    "/:id/run",
    async ({ params: { id }, set }) => {
      try {
        const webset = await websetsService.getWebset(id)
        if (!webset) {
          set.status = 404
          return {
            success: false as const,
            code: ResponseCode.NOT_FOUND,
            message: "Webset not found",
            timestamp: new Date().toISOString(),
          }
        }

        logger.info({ websetId: id }, "Starting webset run")

        const result = await websetsService.runWebset(id)

        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Webset run completed successfully",
          data: result,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, websetId: id }, "Error running webset")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to run webset",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: t.Object({
            websetId: t.String(),
            iterationCount: t.Number(),
            targetValidatedRows: t.Union([t.Number(), t.Null()]),
            currentValidatedRows: t.Number(),
            rowsWithoutValidation: t.Number(),
            targetSatisfied: t.Boolean(),
            totalCompaniesSearched: t.Number(),
            totalRowsAdded: t.Number(),
            totalRowsValidated: t.Number(),
            totalValidationErrors: t.Number(),
            status: t.String(),
            message: t.String(),
            success: t.Boolean(),
          }),
          timestamp: t.String(),
        }),
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  )

  // Generate criteria from query
  .post(
    "/criteria",
    async ({ body, set }) => {
      try {
        logger.info({ query: body.query }, "Generating webset criteria")

        const result = await websetsService.createWebsetCriteria(body.query)

        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          message: "Criteria generated successfully",
          data: result,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error, query: body.query }, "Error generating criteria")
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: "Failed to generate criteria",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      body: t.Object({
        query: t.String({ minLength: 1 }),
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: criteriaResponseSchema,
          timestamp: t.String(),
        }),
        500: errorResponseSchema,
      },
    },
  )
