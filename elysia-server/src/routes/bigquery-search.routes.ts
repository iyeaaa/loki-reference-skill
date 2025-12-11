import { eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db/index"
import { customerGroupMembers, customerGroups } from "../db/schema/customer-groups"
import { leadContacts } from "../db/schema/lead-details"
import { leads } from "../db/schema/leads"
import { InvalidQueryError, searchBigQuery } from "../services/bigquery-search.service"
import logger from "../utils/logger"

// BigQuery 검색 라우트
export const bigquerySearchRoutes = new Elysia({ prefix: "/api/v1/bigquery" })
  .post(
    "/search",
    async ({ body }) => {
      const { query, dataDictionary } = body

      logger.info({ query }, "BigQuery search request received")

      try {
        const result = await searchBigQuery(query, dataDictionary)

        return {
          success: true,
          sql: result.sql,
          explanation: result.explanation,
          results: result.results,
          totalCount: result.totalCount,
        }
      } catch (error) {
        // 유효하지 않은 쿼리 에러 처리
        if (error instanceof InvalidQueryError) {
          logger.warn({ query }, "Invalid query received")
          return {
            success: false,
            error: "invalid_query",
            sql: null,
            explanation: error.message,
            results: [],
            totalCount: 0,
          }
        }

        logger.error({ error, query }, "BigQuery search failed")

        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        return {
          success: false,
          error: errorMessage,
          sql: null,
          explanation: "검색 중 오류가 발생했습니다.",
          results: [],
          totalCount: 0,
        }
      }
    },
    {
      body: t.Object({
        query: t.String({ description: "Natural language search query" }),
        dataDictionary: t.Object({
          tableName: t.String(),
          columns: t.Array(t.String()),
          industries: t.Array(t.String()),
          countries: t.Array(t.String()),
          employeeRanges: t.Array(t.String()),
          revenueRanges: t.Array(t.String()),
        }),
      }),
      detail: {
        tags: ["bigquery"],
        summary: "Search BigQuery with natural language",
        description: "Convert natural language query to SQL and execute against BigQuery",
      },
    },
  )
  // BigQuery 검색 결과를 고객 그룹에 추가
  .post(
    "/add-to-group",
    async ({ body }) => {
      const { groupId, leads: leadsData } = body

      try {
        // 그룹 조회
        const [group] = await db
          .select({ id: customerGroups.id, workspaceId: customerGroups.workspaceId })
          .from(customerGroups)
          .where(eq(customerGroups.id, groupId))
          .limit(1)

        if (!group) {
          return { success: false, error: "Customer group not found", addedCount: 0 }
        }

        const createdLeadIds: string[] = []

        for (const lead of leadsData) {
          // 리드 생성
          const [newLead] = await db
            .insert(leads)
            .values({
              workspaceId: group.workspaceId,
              companyName: lead.companyName || "Unknown",
              websiteUrl: lead.webAddress || null,
              country: lead.country || null,
              city: lead.city || null,
              businessType: lead.industry || null,
              leadSource: "bigquery",
              leadStatus: "new",
              notes: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || null,
            })
            .returning({ id: leads.id })

          if (newLead) {
            createdLeadIds.push(newLead.id)

            // 이메일 추가
            if (lead.email) {
              await db.insert(leadContacts).values({
                leadId: newLead.id,
                contactType: "email",
                contactValue: lead.email,
                label: "primary",
                isPrimary: true,
                isVerified: false,
              })
            }

            // 전화번호 추가
            if (lead.phone) {
              await db.insert(leadContacts).values({
                leadId: newLead.id,
                contactType: "phone",
                contactValue: lead.phone,
                label: "primary",
                isPrimary: true,
                isVerified: false,
              })
            }
          }
        }

        // 그룹에 추가
        if (createdLeadIds.length > 0) {
          await db.insert(customerGroupMembers).values(
            createdLeadIds.map((leadId) => ({
              groupId,
              leadId,
            })),
          )
        }

        logger.info(
          { groupId, addedCount: createdLeadIds.length },
          "Leads added to group from BigQuery",
        )

        return { success: true, addedCount: createdLeadIds.length }
      } catch (error) {
        logger.error({ error, groupId }, "Failed to add leads to group")
        return { success: false, error: String(error), addedCount: 0 }
      }
    },
    {
      body: t.Object({
        groupId: t.String({ format: "uuid" }),
        leads: t.Array(
          t.Object({
            email: t.Optional(t.Nullable(t.String())),
            firstName: t.Optional(t.Nullable(t.String())),
            lastName: t.Optional(t.Nullable(t.String())),
            companyName: t.Optional(t.Nullable(t.String())),
            phone: t.Optional(t.Nullable(t.String())),
            country: t.Optional(t.Nullable(t.String())),
            city: t.Optional(t.Nullable(t.String())),
            industry: t.Optional(t.Nullable(t.String())),
            webAddress: t.Optional(t.Nullable(t.String())),
          }),
        ),
      }),
      detail: {
        tags: ["bigquery"],
        summary: "Add BigQuery search results to customer group",
      },
    },
  )
  .get(
    "/health",
    () => {
      return {
        status: "ok",
        message: "BigQuery search service is running",
      }
    },
    {
      detail: {
        tags: ["bigquery"],
        summary: "Health check for BigQuery service",
      },
    },
  )
