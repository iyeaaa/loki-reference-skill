import "dotenv/config"
import { MastraConfigSchema } from "../core/validate"

/**
 * Loads and validates Mastra configuration from environment
 * Shell layer - orchestrates env reading and validation
 */
export function loadMastraConfig() {
  return MastraConfigSchema.parse({
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: process.env.MASTRA_MODEL,
    maxTokens: process.env.MASTRA_MAX_TOKENS
      ? Number.parseInt(process.env.MASTRA_MAX_TOKENS, 10)
      : undefined,
    temperature: process.env.MASTRA_TEMPERATURE
      ? Number.parseFloat(process.env.MASTRA_TEMPERATURE)
      : undefined,
    rindaLeadPgUrl: process.env.RINDA_LEAD_PG_URL,
    jinaApiKey: process.env.JINA_API_KEY,
    hasdataApiKey: process.env.HASDATA_API_KEY,
  })
}

// Export singleton config instance
export const mastraConfig = loadMastraConfig()
