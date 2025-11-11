import { Mastra } from "@mastra/core"
import { LibSQLStore } from "@mastra/libsql"
import { config } from "../../../config"
import { createGeneralAssistantAgent } from "./agents/general-assistant"
import { createResearchAgent } from "./agents/web-research-agent"
import { enrichDataWorkflow } from "./workflows/enrich-data.workflow"
import { runWebsetWorkflow } from "./workflows/run-webset.workflow"
import { searchCompanyWorkflow } from "./workflows/search-company.workflow"
import { validateCriteriaWorkflow } from "./workflows/validate-criteria.workflow"
import { webCompanyEnrichmentSingleWorkflow } from "./workflows/web-company-enrichment-single.workflow"
import { webCompanySearchV2Workflow } from "./workflows/web-company-search-v2.workflow"

/**
 * Initialize Mastra instance with agents and workflows
 * Shell layer - handles I/O and orchestration
 */
export function createMastra(): Mastra {
  // Create backward-compatible config object for agents
  const mastraConfigCompat = {
    openaiApiKey: config.openai.apiKey,
    model: config.mastra.model,
    maxTokens: config.mastra.maxTokens,
    temperature: config.mastra.temperature,
    rindaLeadPgUrl: config.mastra.rindaLeadPgUrl,
    jinaApiKey: config.apis.jina.apiKey,
    hasdataApiKey: config.apis.hasdata.apiKey,
  }

  const mastra = new Mastra({
    agents: {
      generalAssistant: createGeneralAssistantAgent(mastraConfigCompat),
      researchAgent: createResearchAgent(mastraConfigCompat),
    },
    workflows: {
      searchCompanyWorkflow,
      enrichDataWorkflow,
      validateCriteriaWorkflow,
      webCompanySearchV2Workflow,
      webCompanyEnrichmentSingleWorkflow,
      runWebsetWorkflow,
    },
    storage: new LibSQLStore({
      url: ":memory:",
    }),
  })

  return mastra
}

// Export singleton Mastra instance
export const mastra = createMastra()
