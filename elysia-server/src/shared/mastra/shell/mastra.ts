import { Mastra } from "@mastra/core"
import { LibSQLStore } from "@mastra/libsql"
import { createGeneralAssistantAgent } from "./agents/general-assistant"
import { createResearchAgent } from "./agents/web-research-agent"
import { mastraConfig } from "./config"
import { enrichDataWorkflow } from "./workflows/enrich-data.workflow"
import { runWebsetWorkflow } from "./workflows/run-webset.workflow"
import { searchCompanyWorkflow } from "./workflows/search-company.workflow"
import { validateCriteriaWorkflow } from "./workflows/validate-criteria.workflow"
import { webCompanySearchV2Workflow } from "./workflows/web-company-search-v2.workflow"

/**
 * Initialize Mastra instance with agents and workflows
 * Shell layer - handles I/O and orchestration
 */
export function createMastra(): Mastra {
  const mastra = new Mastra({
    agents: {
      generalAssistant: createGeneralAssistantAgent(mastraConfig),
      researchAgent: createResearchAgent(mastraConfig),
    },
    workflows: {
      searchCompanyWorkflow,
      enrichDataWorkflow,
      validateCriteriaWorkflow,
      webCompanySearchV2Workflow,
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
