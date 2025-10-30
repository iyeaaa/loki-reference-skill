import { Value } from "@sinclair/typebox/value"
import { Elysia, t } from "elysia"
import * as leadService from "../services/lead.service"
import type { ColumnFilter } from "../types/lead-filters.types"
import { errorResponse, ResponseCode } from "../types/response.types"
import { parseFiltersFromQuery } from "../utils/filter-builder.util"

// Response schemas for nested objects
// NOTE: Date fields use t.String() without format because Elysia serializes Date → string AFTER validation
const contactResponseSchema = t.Object({
  id: t.String({ format: "uuid" }),
  leadId: t.String({ format: "uuid" }),
  contactType: t.Union([
    t.Literal("phone"),
    t.Literal("email"),
    t.Literal("fax"),
    t.Literal("other"),
  ]),
  contactValue: t.String(),
  contactName: t.Optional(t.Nullable(t.String())),
  label: t.Optional(t.Nullable(t.String())),
  isPrimary: t.Boolean(),
  isVerified: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
})

const socialMediaResponseSchema = t.Object({
  id: t.String({ format: "uuid" }),
  leadId: t.String({ format: "uuid" }),
  platform: t.Union([
    t.Literal("facebook"),
    t.Literal("instagram"),
    t.Literal("twitter"),
    t.Literal("linkedin"),
  ]),
  url: t.String(),
  username: t.Optional(t.Nullable(t.String())),
  createdAt: t.String(),
  updatedAt: t.String(),
})

const productResponseSchema = t.Object({
  id: t.String({ format: "uuid" }),
  leadId: t.String({ format: "uuid" }),
  productName: t.String(),
  description: t.Optional(t.Nullable(t.String())),
  createdAt: t.String(),
})

const businessSectorResponseSchema = t.Object({
  id: t.String({ format: "uuid" }),
  leadId: t.String({ format: "uuid" }),
  sectorName: t.String(),
  createdAt: t.String(),
})

const productCategoryResponseSchema = t.Object({
  id: t.String({ format: "uuid" }),
  leadId: t.String({ format: "uuid" }),
  categoryName: t.String(),
  createdAt: t.String(),
})

const industryTypeResponseSchema = t.Object({
  id: t.String({ format: "uuid" }),
  leadId: t.String({ format: "uuid" }),
  industryName: t.String(),
  createdAt: t.String(),
})

// Lead search response schema
// NOTE: Nullable fields use t.Optional() to avoid requiring them in response validation
const leadSearchResultSchema = t.Object({
  id: t.String({ format: "uuid" }),
  workspaceId: t.String({ format: "uuid" }),
  workspaceName: t.String(),
  companyName: t.Optional(t.Nullable(t.String())),
  foundCompanyName: t.Optional(t.Nullable(t.String())),
  contactName: t.Optional(t.Nullable(t.String())),
  websiteUrl: t.Optional(t.Nullable(t.String())),
  finalUrl: t.Optional(t.Nullable(t.String())),
  httpStatus: t.Optional(t.Nullable(t.Number())),
  nameUrlMatch: t.Optional(t.Nullable(t.Boolean())),
  businessType: t.Optional(t.Nullable(t.String())),
  isBusinessTypeMatched: t.Optional(t.Nullable(t.Boolean())),
  description: t.Optional(t.Nullable(t.String())),
  address: t.Optional(t.Nullable(t.String())),
  country: t.Optional(t.Nullable(t.String())),
  city: t.Optional(t.Nullable(t.String())),
  state: t.Optional(t.Nullable(t.String())),
  foundedYear: t.Optional(t.Nullable(t.Number())),
  employeeCount: t.Optional(t.Nullable(t.String())),
  leadSource: t.Optional(t.Nullable(t.String())),
  leadStatus: t.Optional(
    t.Union([
      t.Literal("new"),
      t.Literal("contacted"),
      t.Literal("qualified"),
      t.Literal("unqualified"),
      t.Literal("converted"),
      t.Literal("lost"),
      t.Literal("unsubscribed"),
      t.Null(),
    ]),
  ),
  leadScore: t.Optional(t.Nullable(t.Number())),
  notes: t.Optional(t.Nullable(t.String())),
  crawlTimeSeconds: t.Optional(t.Nullable(t.String())),
  gptTimeSeconds: t.Optional(t.Nullable(t.String())),
  collectedAt: t.Optional(t.Nullable(t.String())),
  errorMessage: t.Optional(t.Nullable(t.String())),
  createdBy: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
  createdByUsername: t.Optional(t.Nullable(t.String())),
  createdByEmail: t.Optional(t.Nullable(t.String())),
  createdAt: t.String(),
  updatedAt: t.String(),
  lastContactedAt: t.Optional(t.Nullable(t.String())),
  contacts: t.Array(contactResponseSchema),
  socialMedia: t.Array(socialMediaResponseSchema),
  products: t.Array(productResponseSchema),
  businessSectors: t.Array(businessSectorResponseSchema),
  productCategories: t.Array(productCategoryResponseSchema),
  industryTypes: t.Array(industryTypeResponseSchema),
})

// Input schemas (for creating/updating leads)
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
  contactName: t.Optional(t.String({ maxLength: 255 })),
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
  contactName: t.Optional(t.String({ maxLength: 255 })),
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

// Filter options schema
const filterOptionSchema = t.Object({
  value: t.String(),
  label: t.String(),
  count: t.Number(),
})

const filterOptionsResponseSchema = t.Object({
  field: t.String(),
  options: t.Array(filterOptionSchema),
  total: t.Number(),
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

      // NEW: Parse column filters from JSON string
      let columnFilters: ColumnFilter[] | undefined
      try {
        columnFilters = query.filters ? parseFiltersFromQuery(query.filters) : undefined
      } catch (error) {
        return {
          success: false as const,
          code: ResponseCode.BAD_REQUEST,
          message: error instanceof Error ? error.message : "Invalid filters parameter",
          timestamp: new Date().toISOString(),
        }
      }

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
        searchType: query.searchType,
        workspaceIds,
        createdByIds,
        customerGroupId: query.customerGroupId,
        // NEW: Add column filters and sorting
        columnFilters,
        sortField: query.sortField,
        sortOrder: query.sortOrder as "asc" | "desc" | undefined,
        // NEW: Date range filters
        createdAfter: query.createdAfter,
        createdBefore: query.createdBefore,
        updatedAfter: query.updatedAfter,
        updatedBefore: query.updatedBefore,
      }

      const leads = await leadService.listLeadsWithFilters(limit, offset, filters)
      const total = await leadService.countLeadsWithFilters(filters)

      // Manually serialize Date objects to ISO strings for response validation
      // Note: Types say string but runtime values are Date objects from Drizzle
      const serializedLeads = leads.map((lead) => ({
        ...lead,
        createdAt:
          (lead.createdAt as unknown) instanceof Date
            ? (lead.createdAt as unknown as Date).toISOString()
            : lead.createdAt,
        updatedAt:
          (lead.updatedAt as unknown) instanceof Date
            ? (lead.updatedAt as unknown as Date).toISOString()
            : lead.updatedAt,
        lastContactedAt:
          (lead.lastContactedAt as unknown) instanceof Date
            ? (lead.lastContactedAt as unknown as Date).toISOString()
            : lead.lastContactedAt,
        collectedAt:
          (lead.collectedAt as unknown) instanceof Date
            ? (lead.collectedAt as unknown as Date).toISOString()
            : lead.collectedAt,
        contacts: lead.contacts.map((c) => ({
          ...c,
          createdAt:
            (c.createdAt as unknown) instanceof Date
              ? (c.createdAt as unknown as Date).toISOString()
              : c.createdAt,
          updatedAt:
            (c.updatedAt as unknown) instanceof Date
              ? (c.updatedAt as unknown as Date).toISOString()
              : c.updatedAt,
        })),
        socialMedia: lead.socialMedia.map((sm) => ({
          ...sm,
          createdAt:
            (sm.createdAt as unknown) instanceof Date
              ? (sm.createdAt as unknown as Date).toISOString()
              : sm.createdAt,
          updatedAt:
            (sm.updatedAt as unknown) instanceof Date
              ? (sm.updatedAt as unknown as Date).toISOString()
              : sm.updatedAt,
        })),
        products: lead.products.map((p) => ({
          ...p,
          createdAt:
            (p.createdAt as unknown) instanceof Date
              ? (p.createdAt as unknown as Date).toISOString()
              : p.createdAt,
        })),
        businessSectors: lead.businessSectors.map((bs) => ({
          ...bs,
          createdAt:
            (bs.createdAt as unknown) instanceof Date
              ? (bs.createdAt as unknown as Date).toISOString()
              : bs.createdAt,
        })),
        productCategories: lead.productCategories.map((pc) => ({
          ...pc,
          createdAt:
            (pc.createdAt as unknown) instanceof Date
              ? (pc.createdAt as unknown as Date).toISOString()
              : pc.createdAt,
        })),
        industryTypes: lead.industryTypes.map((it) => ({
          ...it,
          createdAt:
            (it.createdAt as unknown) instanceof Date
              ? (it.createdAt as unknown as Date).toISOString()
              : it.createdAt,
        })),
      }))

      // Return response with explicit structure instead of using successResponse wrapper
      // Use TypeBox Value.Encode to properly serialize and type-check the data
      const responseData = Value.Encode(t.Array(leadSearchResultSchema), serializedLeads)

      return {
        success: true as const,
        code: ResponseCode.SUCCESS,
        message: "정상 처리되었습니다.",
        data: {
          data: responseData,
          total,
          limit,
          offset,
        },
        timestamp: new Date().toISOString(),
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
        searchType: t.Optional(
          t.Union([
            t.Literal("all"),
            t.Literal("company"),
            t.Literal("country"),
            t.Literal("email"),
            t.Literal("website"),
            t.Literal("industry"),
            t.Literal("category"),
          ]),
        ),
        workspaceIds: t.Optional(t.String()),
        createdByIds: t.Optional(t.String()),
        customerGroupId: t.Optional(t.String()),
        // NEW: Column-specific filters (JSON string)
        filters: t.Optional(t.String()),
        // NEW: Sorting
        sortField: t.Optional(t.String()),
        sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
        // NEW: Date range filters
        createdAfter: t.Optional(t.String()),
        createdBefore: t.Optional(t.String()),
        updatedAfter: t.Optional(t.String()),
        updatedBefore: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          message: t.String(),
          data: t.Object({
            data: t.Array(leadSearchResultSchema),
            total: t.Number(),
            limit: t.Number(),
            offset: t.Number(),
          }),
          timestamp: t.String(),
        }),
        400: t.Object({
          success: t.Literal(false),
          code: t.String(),
          message: t.String(),
          timestamp: t.String(),
        }),
      },
      detail: {
        tags: ["leads"],
        summary: "Search leads with advanced filtering",
        description:
          'Search and filter leads with support for column-specific filters, sorting, pagination, and date ranges. Filters parameter accepts JSON array of filter objects with field, operator, and value properties. Supported operators: equals, notEquals, contains, startsWith, endsWith, gt, lt, gte, lte, between, in, notIn, isEmpty, isNotEmpty. Example: [{"field":"leadScore","operator":"gt","value":80},{"field":"country","operator":"in","value":["USA","Canada"]}]',
      },
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
        return {
          success: false,
          code: ResponseCode.NOT_FOUND,
          message: "리드를 찾을 수 없습니다.",
          timestamp: new Date().toISOString(),
        }
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
    async ({ body, set }) => {
      try {
        console.log("🔍 백엔드 bulk create 디버깅:", {
          workspaceId: body.workspaceId,
          leadsCount: body.leads?.length || 0,
          customerGroupId: body.customerGroupId,
          createdBy: body.createdBy,
        })

        const result = await leadService.bulkCreateLeads(body)

        console.log("📊 Bulk create result:", {
          created: result.stats.created,
          skipped: result.stats.skipped,
          duplicates: result.duplicateEmails.length,
        })

        // 고객 그룹이 지정된 경우 리드들을 그룹에 추가
        if (body.customerGroupId && result.createdLeads.length > 0) {
          try {
            const leadIds = result.createdLeads.map((lead) => lead.id)
            console.log("🔍 고객 그룹에 추가 시도:", {
              leadIds: leadIds,
              customerGroupId: body.customerGroupId,
              createdBy: body.createdBy,
            })

            await leadService.bulkAddLeadsToCustomerGroup(
              leadIds,
              body.customerGroupId,
              body.createdBy,
            )
            console.log(
              `✅ Successfully added ${leadIds.length} leads to group ${body.customerGroupId}`,
            )
          } catch (error) {
            console.error("❌ Failed to add leads to customer group:", error)
            // 고객 그룹 추가 실패해도 리드 생성은 성공으로 처리
          }
        } else {
          console.log("⚠️ 고객 그룹에 추가하지 않음:", {
            hasCustomerGroupId: !!body.customerGroupId,
            leadsLength: result.createdLeads.length,
          })
        }

        return {
          leads: result.createdLeads,
          duplicateEmails: result.duplicateEmails,
          stats: result.stats,
        }
      } catch (error) {
        console.error("❌ Bulk create leads error:", error)
        set.status = 500
        return {
          error: "Failed to create leads",
          message: error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        leads: t.Array(
          t.Object({
            companyName: t.String(),
            foundCompanyName: t.Optional(t.String()),
            contactName: t.Optional(t.String()),
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
        customerGroupId: t.Optional(t.String({ format: "uuid" })),
      }),
      response: {
        200: t.Object({
          leads: t.Array(
            t.Object({
              id: t.String({ format: "uuid" }),
              companyName: t.Union([t.String(), t.Null()]),
              foundCompanyName: t.Union([t.String(), t.Null()]),
              businessType: t.Union([t.String(), t.Null()]),
              websiteUrl: t.Union([t.String(), t.Null()]),
              description: t.Union([t.String(), t.Null()]),
              country: t.Union([t.String(), t.Null()]),
              city: t.Union([t.String(), t.Null()]),
              leadStatus: t.Union([t.String(), t.Null()]),
              leadScore: t.Union([t.Number(), t.Null()]),
              createdBy: t.Union([t.String({ format: "uuid" }), t.Null()]),
              createdAt: t.Date(),
            }),
          ),
          duplicateEmails: t.Array(
            t.Object({
              email: t.String(),
              existingLeadId: t.String(),
              companyName: t.String(),
              existingCompanyName: t.Optional(t.String()),
              customerGroupIds: t.Optional(t.Array(t.String({ format: "uuid" }))),
              type: t.Union([t.Literal("database"), t.Literal("csv")]),
            }),
          ),
          stats: t.Object({
            total: t.Number(),
            created: t.Number(),
            skipped: t.Number(),
          }),
        }),
        500: t.Object({
          error: t.String(),
          message: t.String(),
        }),
      },
      detail: {
        tags: ["leads"],
        summary: "JSON 형식으로 리드 일괄 생성",
        description:
          "JSON 배열로 여러 리드를 일괄 생성합니다. 중복 이메일 방지: (1) 요청 데이터 내부의 중복 이메일과 (2) Workspace 내 기존 데이터베이스의 중복 이메일이 자동으로 감지되어 스킵됩니다. 응답에는 생성된 리드 목록, 중복 이메일 상세정보(email, existingLeadId, companyName, existingCompanyName, customerGroupIds, type), 통계(total, created, skipped)가 포함됩니다. 중복 감지 시 기존 리드의 회사명과 소속 고객 그룹 정보도 함께 반환됩니다. 선택적으로 고객 그룹에 자동 추가할 수 있습니다.",
      },
    },
  )

  // Update lead
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const lead = await leadService.updateLead(id, body)
      if (!lead) {
        set.status = 404
        return {
          success: false,
          code: ResponseCode.NOT_FOUND,
          message: "리드를 찾을 수 없습니다.",
          timestamp: new Date().toISOString(),
        }
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
          searchType: query.searchType,
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
        return {
          success: false,
          code: ResponseCode.INTERNAL_ERROR,
          message: "CSV 다운로드에 실패했습니다.",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      query: t.Object({
        leadStatus: t.Optional(t.String()),
        businessType: t.Optional(t.String()),
        country: t.Optional(t.String()),
        city: t.Optional(t.String()),
        search: t.Optional(t.String()),
        searchType: t.Optional(
          t.Union([
            t.Literal("all"),
            t.Literal("company"),
            t.Literal("country"),
            t.Literal("email"),
            t.Literal("website"),
            t.Literal("industry"),
            t.Literal("category"),
          ]),
        ),
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
  // Get filter options for a specific field
  .get(
    "/filter-options/:field",
    async ({ params, query, set }) => {
      try {
        const { field } = params
        const { workspaceId, customerGroupId } = query

        // Validate field parameter
        const allowedFields = [
          "country",
          "city",
          "state",
          "leadSource",
          "employeeCount",
          "businessType",
          "leadStatus",
        ]

        if (!allowedFields.includes(field)) {
          set.status = 400
          return {
            success: false as const,
            code: ResponseCode.BAD_REQUEST,
            message: `Invalid field parameter. Allowed fields: ${allowedFields.join(", ")}`,
            timestamp: new Date().toISOString(),
          }
        }

        // Call service function
        const data = await leadService.getFilterOptions(field, workspaceId, customerGroupId)

        return {
          success: true as const,
          code: ResponseCode.SUCCESS,
          data,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        console.error("Filter options error:", error)
        set.status = 500
        return {
          success: false as const,
          code: ResponseCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Failed to fetch filter options",
          timestamp: new Date().toISOString(),
        }
      }
    },
    {
      params: t.Object({
        field: t.String(),
      }),
      query: t.Object({
        workspaceId: t.Optional(t.String({ format: "uuid" })),
        customerGroupId: t.Optional(t.String({ format: "uuid" })),
      }),
      response: {
        200: t.Object({
          success: t.Literal(true),
          code: t.String(),
          data: filterOptionsResponseSchema,
          timestamp: t.String(),
        }),
        400: t.Object({
          success: t.Literal(false),
          code: t.String(),
          message: t.String(),
          timestamp: t.String(),
        }),
        500: t.Object({
          success: t.Literal(false),
          code: t.String(),
          message: t.String(),
          timestamp: t.String(),
        }),
      },
    },
  )
