import { Elysia, t } from "elysia"
import * as leadService from "../services/lead.service"
import { errorResponse, ResponseCode } from "../types/response.types"

const contactSchema = t.Object({
  contactType: t.Union([
    t.Literal("phone"),
    t.Literal("email"),
    t.Literal("fax"),
    t.Literal("other"),
  ]),
  contactValue: t.String({ maxLength: 255 }),
  label: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  isPrimary: t.Optional(t.Boolean()),
})

const socialMediaSchema = t.Object({
  platform: t.Union([
    t.Literal("facebook"),
    t.Literal("instagram"),
    t.Literal("twitter"),
    t.Literal("linkedin"),
  ]),
  url: t.String({ maxLength: 500 }),
  username: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
})

const leadSchema = t.Object({
  workspaceId: t.String({ format: "uuid" }),
  companyName: t.Optional(t.String({ maxLength: 255 })),
  foundCompanyName: t.Optional(t.String({ maxLength: 255 })),
  websiteUrl: t.Optional(t.String({ maxLength: 500 })),
  finalUrl: t.Optional(t.String({ maxLength: 500 })),
  httpStatus: t.Optional(t.Number()),
  nameUrlMatch: t.Optional(t.Boolean()),
  businessType: t.Optional(t.String({ maxLength: 100 })),
  isBusinessTypeMatched: t.Optional(t.Boolean()),
  description: t.Optional(t.String()),
  address: t.Optional(t.String()),
  country: t.Optional(t.String({ maxLength: 100 })),
  city: t.Optional(t.String({ maxLength: 100 })),
  state: t.Optional(t.String({ maxLength: 100 })),
  foundedYear: t.Optional(t.Number()),
  employeeCount: t.Optional(t.String({ maxLength: 50 })),
  leadSource: t.Optional(t.String({ maxLength: 100 })),
  leadStatus: t.Optional(
    t.Union([
      t.Literal("new"),
      t.Literal("contacted"),
      t.Literal("qualified"),
      t.Literal("unqualified"),
      t.Literal("converted"),
      t.Literal("lost"),
      t.Literal("unsubscribed"),
    ]),
  ),
  leadScore: t.Optional(t.Number()),
  notes: t.Optional(t.String()),
  crawlTimeSeconds: t.Optional(t.String()),
  gptTimeSeconds: t.Optional(t.String()),
  collectedAt: t.Optional(t.String()),
  errorMessage: t.Optional(t.String()),
  createdBy: t.Optional(t.String({ format: "uuid" })),
  customerGroupId: t.Optional(t.String({ format: "uuid" })), // 고객 그룹 ID 추가
  contacts: t.Optional(t.Array(contactSchema)),
  socialMedia: t.Optional(t.Array(socialMediaSchema)),
})

const updateLeadSchema = t.Object({
  companyName: t.Optional(t.String({ maxLength: 255 })),
  foundCompanyName: t.Optional(t.String({ maxLength: 255 })),
  websiteUrl: t.Optional(t.String({ maxLength: 500 })),
  finalUrl: t.Optional(t.String({ maxLength: 500 })),
  httpStatus: t.Optional(t.Number()),
  nameUrlMatch: t.Optional(t.Boolean()),
  businessType: t.Optional(t.String({ maxLength: 100 })),
  isBusinessTypeMatched: t.Optional(t.Boolean()),
  description: t.Optional(t.String()),
  address: t.Optional(t.String()),
  country: t.Optional(t.String({ maxLength: 100 })),
  city: t.Optional(t.String({ maxLength: 100 })),
  state: t.Optional(t.String({ maxLength: 100 })),
  foundedYear: t.Optional(t.Number()),
  employeeCount: t.Optional(t.String({ maxLength: 50 })),
  leadSource: t.Optional(t.String({ maxLength: 100 })),
  leadStatus: t.Optional(
    t.Union([
      t.Literal("new"),
      t.Literal("contacted"),
      t.Literal("qualified"),
      t.Literal("unqualified"),
      t.Literal("converted"),
      t.Literal("lost"),
      t.Literal("unsubscribed"),
    ]),
  ),
  leadScore: t.Optional(t.Number()),
  notes: t.Optional(t.String()),
  contacts: t.Optional(t.Array(contactSchema)),
  socialMedia: t.Optional(t.Array(socialMediaSchema)),
})

export const leadRoutes = new Elysia({ prefix: "/api/v1/leads" })
  // Search leads with filters (must be before /:id route)
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
        leadStatus: query.leadStatus as
          | "new"
          | "contacted"
          | "qualified"
          | "unqualified"
          | "converted"
          | "lost"
          | "unsubscribed"
          | undefined,
        businessType: query.businessType,
        country: query.country,
        city: query.city,
        search: query.search,
        workspaceIds,
        createdByIds,
        customerGroupId: query.customerGroupId,
      }

      const leads = await leadService.listLeadsWithFilters(limit, offset, filters)
      const total = await leadService.countLeadsWithFilters(filters)

      return {
        data: leads,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        leadStatus: t.Optional(t.String()),
        businessType: t.Optional(t.String()),
        country: t.Optional(t.String()),
        city: t.Optional(t.String()),
        search: t.Optional(t.String()),
        workspaceIds: t.Optional(t.String()),
        createdByIds: t.Optional(t.String()),
        customerGroupId: t.Optional(t.String()),
      }),
    },
  )

  // Get leads by status
  .get(
    "/status/:status",
    async ({ params: { status }, query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const leads = await leadService.getLeadsByStatus(
        status as
          | "new"
          | "contacted"
          | "qualified"
          | "unqualified"
          | "converted"
          | "lost"
          | "unsubscribed",
        limit,
        offset,
      )
      return leads
    },
    {
      params: t.Object({
        status: t.Union([
          t.Literal("new"),
          t.Literal("contacted"),
          t.Literal("qualified"),
          t.Literal("unqualified"),
          t.Literal("converted"),
          t.Literal("lost"),
          t.Literal("unsubscribed"),
        ]),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Get lead by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const lead = await leadService.getLead(id)
      if (!lead) {
        set.status = 404
        return errorResponse("리드를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return lead
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create new lead
  .post(
    "/",
    async ({ body }) => {
      const leadData = {
        ...body,
        collectedAt: body.collectedAt ? new Date(body.collectedAt) : undefined,
      }
      const lead = await leadService.createLead(
        leadData as Parameters<typeof leadService.createLead>[0],
      )

      // 고객 그룹이 선택된 경우 해당 그룹에 추가
      if (body.customerGroupId && lead.id) {
        try {
          await leadService.addLeadToCustomerGroup(lead.id, body.customerGroupId, body.createdBy)
        } catch (error) {
          console.error("Failed to add lead to customer group:", error)
          // 고객 그룹 추가 실패해도 리드 생성은 성공으로 처리
        }
      }

      return lead
    },
    {
      body: leadSchema,
    },
  )

  // Bulk create leads
  .post(
    "/bulk",
    async ({ body }) => {
      const leads = await leadService.bulkCreateLeads(body)
      return { leads }
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        leads: t.Array(
          t.Object({
            companyName: t.String(),
            foundCompanyName: t.Optional(t.String()),
            businessType: t.Optional(t.String()),
            websiteUrl: t.Optional(t.String()),
            description: t.Optional(t.String()),
            employeeCount: t.Optional(t.String()),
            foundedYear: t.Optional(t.Number()),
            country: t.Optional(t.String()),
            city: t.Optional(t.String()),
            state: t.Optional(t.String()),
            address: t.Optional(t.String()),
            leadSource: t.Optional(t.String()),
            leadStatus: t.Optional(t.String()),
            leadScore: t.Optional(t.Number()),
            notes: t.Optional(t.String()),
            primaryEmail: t.Optional(t.String()),
            primaryPhone: t.Optional(t.String()),
            secondaryEmail: t.Optional(t.String()),
            secondaryPhone: t.Optional(t.String()),
          }),
        ),
        createdBy: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Update lead
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const lead = await leadService.updateLead(id, body)
      if (!lead) {
        set.status = 404
        return errorResponse("리드를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return lead
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateLeadSchema,
    },
  )

  // Delete lead
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      await leadService.deleteLead(id)
      return { success: true, message: "리드가 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // List leads with pagination
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const leads = await leadService.listLeads(limit, offset)
      const total = await leadService.countLeads()

      return {
        data: leads,
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

  // Get leads by workspace
  .get(
    "/workspace/:workspaceId",
    async ({ params: { workspaceId }, query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const leads = await leadService.getLeadsByWorkspace(workspaceId, limit, offset)
      const total = await leadService.countLeadsByWorkspace(workspaceId)

      return {
        data: leads,
        total,
        limit,
        offset,
      }
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

// Admin bulk update routes
export const adminLeadRoutes = new Elysia({ prefix: "/api/v1/admin/leads" })
  // Bulk update status
  .put(
    "/bulk/status",
    async ({ body }) => {
      const updatedCount = await leadService.bulkUpdateStatus(body.leadIds, body.leadStatus)
      return { updatedCount }
    },
    {
      body: t.Object({
        leadIds: t.Array(t.String({ format: "uuid" })),
        leadStatus: t.Union([
          t.Literal("new"),
          t.Literal("contacted"),
          t.Literal("qualified"),
          t.Literal("unqualified"),
          t.Literal("converted"),
          t.Literal("lost"),
          t.Literal("unsubscribed"),
        ]),
      }),
    },
  )

  // Bulk delete
  .delete(
    "/bulk",
    async ({ body }) => {
      const deletedCount = await leadService.bulkDelete(body.leadIds)
      return { deletedCount }
    },
    {
      body: t.Object({
        leadIds: t.Array(t.String({ format: "uuid" })),
      }),
    },
  )

  // Bulk update business type
  .put(
    "/bulk/business-type",
    async ({ body }) => {
      const updatedCount = await leadService.bulkUpdateBusinessType(body.leadIds, body.businessType)
      return { updatedCount }
    },
    {
      body: t.Object({
        leadIds: t.Array(t.String({ format: "uuid" })),
        businessType: t.String({ maxLength: 100 }),
      }),
    },
  )

  // Get lead contacts
  .get(
    "/:id/contacts",
    async ({ params }) => {
      const contacts = await leadService.getLeadContacts(params.id)
      return { contacts }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get lead social media
  .get(
    "/:id/social-media",
    async ({ params }) => {
      const socialMedia = await leadService.getLeadSocialMedia(params.id)
      return { socialMedia }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get lead products
  .get(
    "/:id/products",
    async ({ params }) => {
      const products = await leadService.getLeadProducts(params.id)
      return { products }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get lead business sectors
  .get(
    "/:id/business-sectors",
    async ({ params }) => {
      const businessSectors = await leadService.getLeadBusinessSectors(params.id)
      return { businessSectors }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get lead product categories
  .get(
    "/:id/product-categories",
    async ({ params }) => {
      const productCategories = await leadService.getLeadProductCategories(params.id)
      return { productCategories }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get lead industry types
  .get(
    "/:id/industry-types",
    async ({ params }) => {
      const industryTypes = await leadService.getLeadIndustryTypes(params.id)
      return { industryTypes }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Download leads as CSV
  .get(
    "/download/csv",
    async ({ query, set }) => {
      try {
        // Parse workspaceIds from comma-separated string
        const workspaceIds = query.workspaceIds
          ? query.workspaceIds.split(",").filter(Boolean)
          : undefined

        const filters = {
          leadStatus: query.leadStatus as
            | "new"
            | "contacted"
            | "qualified"
            | "unqualified"
            | "converted"
            | "lost"
            | "unsubscribed"
            | undefined,
          businessType: query.businessType,
          country: query.country,
          city: query.city,
          search: query.search,
          workspaceIds,
          customerGroupId: query.customerGroupId,
        }

        const csvData = await leadService.exportLeadsToCSV(filters)

        // Set headers for CSV download
        set.headers = {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="leads_${
            new Date().toISOString().split("T")[0]
          }.csv"`,
        }

        return csvData
      } catch (error) {
        console.error("CSV export error:", error)
        set.status = 500
        return errorResponse("CSV 다운로드에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        leadStatus: t.Optional(t.String()),
        businessType: t.Optional(t.String()),
        country: t.Optional(t.String()),
        city: t.Optional(t.String()),
        search: t.Optional(t.String()),
        workspaceIds: t.Optional(t.String()),
        customerGroupId: t.Optional(t.String()),
      }),
    },
  )

  // Download selected leads as CSV
  .post(
    "/download/csv/selected",
    async ({ body, set }) => {
      try {
        const { leadIds } = body

        if (!leadIds || leadIds.length === 0) {
          set.status = 400
          return errorResponse("다운로드할 리드가 선택되지 않았습니다.", ResponseCode.BAD_REQUEST)
        }

        const csvData = await leadService.exportSelectedLeadsToCSV(leadIds)

        // Set headers for CSV download
        set.headers = {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="selected_leads_${
            new Date().toISOString().split("T")[0]
          }.csv"`,
        }

        return csvData
      } catch (error) {
        console.error("Selected leads CSV export error:", error)
        set.status = 500
        return errorResponse(
          "선택된 리드 CSV 다운로드에 실패했습니다.",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: t.Object({
        leadIds: t.Array(t.String({ format: "uuid" })),
      }),
    },
  )
