import { Elysia, t } from "elysia"
import * as websetsService from "../services/websets.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import logger from "../utils/logger"

const websetSchema = t.Object({
  workspaceId: t.String({ format: "uuid" }),
  title: t.Optional(t.String({ maxLength: 255 })),
  query: t.String({ minLength: 1 }),
  criterias: t.Optional(t.Array(t.String())),
  targetValidatedRows: t.Optional(t.Number()),
})

const updateWebsetSchema = t.Object({
  title: t.Optional(t.String({ maxLength: 255 })),
  query: t.Optional(t.String({ minLength: 1 })),
  criterias: t.Optional(t.Array(t.String())),
  targetValidatedRows: t.Optional(t.Number()),
})

const websetRowSchema = t.Object({
  data: t.Record(t.String(), t.Any()),
  criteriaAnswers: t.Optional(t.Array(t.Boolean())),
})

export const websetRoutes = new Elysia({ prefix: "/api/v1/websets" })
  // Get all websets for a workspace
  .get(
    "/",
    async ({ query }) => {
      const workspaceId = query.workspaceId
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const result = await websetsService.getAllWebsets(workspaceId, limit, offset)

      return result
    },
    {
      query: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Get webset by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const webset = await websetsService.getWebset(id)
      if (!webset) {
        set.status = 404
        return errorResponse("Webset not found", ResponseCode.NOT_FOUND)
      }
      return webset
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create new webset
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const webset = await websetsService.createWebset(body)
        set.status = 201
        return successResponse(webset, "Webset created successfully")
      } catch (error) {
        logger.error({ error }, "Error creating webset")
        set.status = 500
        return errorResponse("Failed to create webset", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: websetSchema,
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
          return errorResponse("Webset not found", ResponseCode.NOT_FOUND)
        }

        const updatedWebset = await websetsService.updateWebset(id, body)
        return successResponse(updatedWebset, "Webset updated successfully")
      } catch (error) {
        logger.error({ error, id }, "Error updating webset")
        set.status = 500
        return errorResponse("Failed to update webset", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateWebsetSchema,
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
          return errorResponse("Webset not found", ResponseCode.NOT_FOUND)
        }

        await websetsService.deleteWebset(id)
        return successResponse(null, "Webset deleted successfully")
      } catch (error) {
        logger.error({ error, id }, "Error deleting webset")
        set.status = 500
        return errorResponse("Failed to delete webset", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get all rows for a webset
  .get(
    "/:id/rows",
    async ({ params: { id }, query, set }) => {
      const webset = await websetsService.getWebset(id)
      if (!webset) {
        set.status = 404
        return errorResponse("Webset not found", ResponseCode.NOT_FOUND)
      }

      const limit = parseInt(query.limit || "100", 10)
      const offset = parseInt(query.offset || "0", 10)

      const result = await websetsService.getAllWebsetRows(id, limit, offset)
      return result
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
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
          return errorResponse("Webset not found", ResponseCode.NOT_FOUND)
        }

        const row = await websetsService.createWebsetRow({
          websetId: id,
          ...body,
        })
        set.status = 201
        return successResponse(row, "Webset row created successfully")
      } catch (error) {
        logger.error({ error, websetId: id }, "Error creating webset row")
        set.status = 500
        return errorResponse("Failed to create webset row", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: websetRowSchema,
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
          return errorResponse("Webset not found", ResponseCode.NOT_FOUND)
        }

        const updatedRow = await websetsService.updateWebsetRow(rowId, body)
        return successResponse(updatedRow, "Webset row updated successfully")
      } catch (error) {
        logger.error({ error, websetId: id, rowId }, "Error updating webset row")
        set.status = 500
        return errorResponse("Failed to update webset row", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        rowId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        data: t.Optional(t.Record(t.String(), t.Any())),
        criteriaAnswers: t.Optional(t.Array(t.Boolean())),
      }),
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
          return errorResponse("Webset not found", ResponseCode.NOT_FOUND)
        }

        await websetsService.deleteWebsetRow(rowId)
        return successResponse(null, "Webset row deleted successfully")
      } catch (error) {
        logger.error({ error, websetId: id, rowId }, "Error deleting webset row")
        set.status = 500
        return errorResponse("Failed to delete webset row", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        rowId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Run webset - execute query and process results
  .post(
    "/:id/run",
    async ({ params: { id }, set }) => {
      try {
        logger.info({ websetId: id }, "Starting webset run")

        const result = await websetsService.runWebset(id)

        return successResponse(result, "Webset run completed successfully")
      } catch (error) {
        logger.error({ error, websetId: id }, "Error running webset")
        set.status = 500
        return errorResponse("Failed to run webset", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )
