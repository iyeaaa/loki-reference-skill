import { Elysia, t } from "elysia"
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
