import { Elysia, t } from "elysia"
import * as salesStrategyService from "../services/sales-strategy.service"
import { errorResponse, ResponseCode } from "../types/response.types"

// Enum values for validation
const industryValues = [
  "manufacturing",
  "it_saas",
  "beauty",
  "food",
  "fashion",
  "electronics",
  "healthcare",
  "guitar",
] as const

const targetValues = ["b2b", "b2c", "both"] as const
const countryValues = ["jp", "us", "sea", "eu", "cn", "ae"] as const
const experienceValues = ["none", "some", "experienced"] as const

const salesStrategySchema = t.Object({
  industry: t.Union(industryValues.map((v) => t.Literal(v))),
  target: t.Union(targetValues.map((v) => t.Literal(v))),
  country: t.Union(countryValues.map((v) => t.Literal(v))),
  experience: t.Union(experienceValues.map((v) => t.Literal(v))),
  rindaSolution: t.Optional(t.Any()),
  strategies: t.Optional(t.Any()),
  proofPoints: t.Optional(t.Any()),
  emailBenchmarks: t.Optional(t.Any()),
})

const updateSalesStrategySchema = t.Object({
  industry: t.Optional(t.Union(industryValues.map((v) => t.Literal(v)))),
  target: t.Optional(t.Union(targetValues.map((v) => t.Literal(v)))),
  country: t.Optional(t.Union(countryValues.map((v) => t.Literal(v)))),
  experience: t.Optional(t.Union(experienceValues.map((v) => t.Literal(v)))),
  rindaSolution: t.Optional(t.Any()),
  strategies: t.Optional(t.Any()),
  proofPoints: t.Optional(t.Any()),
  emailBenchmarks: t.Optional(t.Any()),
})

export const salesStrategyRoutes = new Elysia({
  prefix: "/api/v1/sales-strategies",
})
  // Get sales strategy by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const strategy = await salesStrategyService.getSalesStrategy(id)
      if (!strategy) {
        set.status = 404
        return errorResponse("Sales strategy not found", ResponseCode.NOT_FOUND)
      }
      return strategy
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create new sales strategy
  .post(
    "/",
    async ({ body }) => {
      const strategy = await salesStrategyService.createSalesStrategy(body)
      return strategy
    },
    {
      body: salesStrategySchema,
    },
  )

  // Update sales strategy
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const strategy = await salesStrategyService.updateSalesStrategy(id, body)
      if (!strategy) {
        set.status = 404
        return errorResponse("Sales strategy not found", ResponseCode.NOT_FOUND)
      }
      return strategy
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateSalesStrategySchema,
    },
  )

  // Delete sales strategy
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      await salesStrategyService.deleteSalesStrategy(id)
      return { success: true, message: "Sales strategy deleted" }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // List sales strategies with pagination
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const strategies = await salesStrategyService.listSalesStrategies(limit, offset)
      const total = await salesStrategyService.countSalesStrategies()

      return {
        data: strategies,
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

// Workspace-scoped sales strategy routes
export const workspaceSalesStrategyRoutes = new Elysia({
  prefix: "/api/v1/workspace-sales-strategies",
})
  // Get all sales strategies for workspace (returns first/latest one)
  .get(
    "/:workspaceId",
    async ({ params: { workspaceId }, set }) => {
      const strategies = await salesStrategyService.getWorkspaceSalesStrategies(workspaceId)

      // Return the first strategy (most recent) or 404 if none exist
      const firstStrategy = strategies[0]
      if (!firstStrategy) {
        set.status = 404
        return errorResponse("No sales strategy found for this workspace", ResponseCode.NOT_FOUND)
      }

      return {
        data: {
          industry: firstStrategy.salesStrategy.industry,
          target: firstStrategy.salesStrategy.target,
          country: firstStrategy.salesStrategy.country,
          experience: firstStrategy.salesStrategy.experience,
        },
      }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Link existing sales strategy to workspace
  .post(
    "/:workspaceId/link/:salesStrategyId",
    async ({ params: { workspaceId, salesStrategyId } }) => {
      const link = await salesStrategyService.linkWorkspaceToSalesStrategy(
        workspaceId,
        salesStrategyId,
      )
      return link
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        salesStrategyId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Find existing sales strategy by input fields and link to workspace
  .post(
    "/:workspaceId/find-and-link",
    async ({ params: { workspaceId }, body, set }) => {
      const result = await salesStrategyService.findAndLinkSalesStrategy(workspaceId, {
        industry: body.industry,
        target: body.target,
        country: body.country,
        experience: body.experience,
      })
      if (!result) {
        set.status = 404
        return errorResponse(
          "No sales strategy found matching the specified criteria",
          ResponseCode.NOT_FOUND,
        )
      }
      return result
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        industry: t.Union(industryValues.map((v) => t.Literal(v))),
        target: t.Union(targetValues.map((v) => t.Literal(v))),
        country: t.Union(countryValues.map((v) => t.Literal(v))),
        experience: t.Union(experienceValues.map((v) => t.Literal(v))),
      }),
    },
  )

  // Create new sales strategy and link to workspace
  .post(
    "/:workspaceId",
    async ({ params: { workspaceId }, body }) => {
      const result = await salesStrategyService.createAndLinkSalesStrategy(workspaceId, body)
      return result
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        industry: t.Union(industryValues.map((v) => t.Literal(v))),
        target: t.Union(targetValues.map((v) => t.Literal(v))),
        country: t.Union(countryValues.map((v) => t.Literal(v))),
        experience: t.Union(experienceValues.map((v) => t.Literal(v))),
        rindaSolution: t.Optional(t.Any()),
        strategies: t.Optional(t.Any()),
        proofPoints: t.Optional(t.Any()),
        emailBenchmarks: t.Optional(t.Any()),
      }),
    },
  )

  // Update sales strategy for workspace (find or create new one)
  .put(
    "/:workspaceId",
    async ({ params: { workspaceId }, body }) => {
      // Find or create a new sales strategy with the updated values
      const result = await salesStrategyService.findOrCreateAndLinkSalesStrategy(workspaceId, {
        industry: body.industry,
        target: body.target,
        country: body.country,
        experience: body.experience,
      })

      return {
        success: true,
        data: {
          industry: result.salesStrategy.industry,
          target: result.salesStrategy.target,
          country: result.salesStrategy.country,
          experience: result.salesStrategy.experience,
        },
      }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        industry: t.Union(industryValues.map((v) => t.Literal(v))),
        target: t.Union(targetValues.map((v) => t.Literal(v))),
        country: t.Union(countryValues.map((v) => t.Literal(v))),
        experience: t.Union(experienceValues.map((v) => t.Literal(v))),
        websiteUrl: t.Optional(t.String()),
      }),
    },
  )

  // Unlink sales strategy from workspace
  .delete(
    "/:workspaceId/link/:linkId",
    async ({ params: { linkId } }) => {
      await salesStrategyService.unlinkWorkspaceFromSalesStrategy(linkId)
      return {
        success: true,
        message: "Sales strategy unlinked from workspace",
      }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        linkId: t.String({ format: "uuid" }),
      }),
    },
  )
