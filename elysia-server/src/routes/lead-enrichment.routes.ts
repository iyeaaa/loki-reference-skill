import { Elysia, t } from "elysia"
import { enrichLead } from "../services/lead-enrichment.service"
import logger from "../utils/logger"

export const leadEnrichmentRoutes = new Elysia({ prefix: "/api/v1/lead-enrichment" })
  .post(
    "/enrich",
    async ({ body }) => {
      const { webAddress, companyName } = body

      logger.info({ webAddress, companyName }, "Lead enrichment request received")

      try {
        const hunterApiKey = process.env.HUNTER_API_KEY
        const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY

        const result = await enrichLead(webAddress, companyName, {
          hunterApiKey,
          geminiApiKey,
          skipHunter: !hunterApiKey,
        })

        return {
          success: true,
          data: result,
        }
      } catch (error) {
        logger.error({ error, webAddress }, "Lead enrichment failed")

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          data: null,
        }
      }
    },
    {
      body: t.Object({
        webAddress: t.String({ description: "Company website URL" }),
        companyName: t.String({ description: "Company name" }),
      }),
      detail: {
        tags: ["lead-enrichment"],
        summary: "Enrich lead with company info and emails",
        description: "Fetch company information and emails using Hunter.io and Jina Reader",
      },
    },
  )
  .get(
    "/health",
    () => {
      const hasHunterKey = !!process.env.HUNTER_API_KEY
      const hasGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY)

      return {
        status: "ok",
        services: {
          hunter: hasHunterKey ? "configured" : "not configured",
          jina: "available (free)",
          gemini: hasGeminiKey ? "configured" : "not configured",
        },
      }
    },
    {
      detail: {
        tags: ["lead-enrichment"],
        summary: "Check enrichment service status",
      },
    },
  )
