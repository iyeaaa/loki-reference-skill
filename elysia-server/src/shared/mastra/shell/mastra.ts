import { Mastra } from "@mastra/core"
import { LibSQLStore } from "@mastra/libsql"
import { config } from "../../../config"
import { createEmailDraftAgent } from "./agents/email-draft-agent"
import { createEmailReplyAgent } from "./agents/email-reply-agent"
import { createGeneralAssistantAgent } from "./agents/general-assistant"
import { onboardingResearchAgent } from "./agents/onboarding-research-agent/index"
import { createSequenceEmailAgent } from "./agents/sequence-email-agent"
import { createCampaignStepsAgent } from "./agents/steps-agent"
import { structuredExtractionAgent } from "./agents/structured-extraction-agent"
import { createResearchAgent } from "./agents/web-research-agent"
import { emailGenerationWorkflow } from "./workflows/email-generation/generate-email.workflow"
import { emailReplyGenerationWorkflow } from "./workflows/email-reply-generation/generate-reply.workflow"
import { enrichDataWorkflow } from "./workflows/enrich-data.workflow"
import { onboardingEnrichmentWorkflow } from "./workflows/onboarding-enrichment/onboarding-enrichment"
import { runWebsetWorkflow } from "./workflows/run-webset.workflow"
import { searchCompanyWorkflow } from "./workflows/search-company.workflow"
import { sequenceEmailGenerationWorkflow } from "./workflows/sequence-email-generation/generate-sequence-email.workflow"
import { campaignStepsGenerationWorkflow } from "./workflows/steps-generation/generate-steps.workflow"
import { validateCriteriaWorkflow } from "./workflows/validate-criteria.workflow"
import { webCompanyEnrichmentSingleWorkflow } from "./workflows/web-company-enrichment-single.workflow"
import { webCompanySearchV2Workflow } from "./workflows/web-company-search-v2.workflow"

/**
 * Initialize Mastra instance with agents and workflows
 * Shell layer - handles I/O and orchestration
 */
function createMastra(): Mastra {
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
      campaignStepsAgent: createCampaignStepsAgent(),
      emailDraftAgent: createEmailDraftAgent(mastraConfigCompat),
      emailReplyAgent: createEmailReplyAgent(mastraConfigCompat),
      sequenceEmailAgent: createSequenceEmailAgent(),
      structuredExtractionAgent,
      onboardingResearchAgent,
    },
    workflows: {
      searchCompanyWorkflow,
      enrichDataWorkflow,
      validateCriteriaWorkflow,
      webCompanySearchV2Workflow,
      webCompanyEnrichmentSingleWorkflow,
      runWebsetWorkflow,
      campaignStepsGenerationWorkflow,
      emailGenerationWorkflow,
      emailReplyGenerationWorkflow,
      sequenceEmailGenerationWorkflow,
      onboardingEnrichmentWorkflow,
    },
    storage: new LibSQLStore({
      url: ":memory:",
    }),
  })

  return mastra
}

// Lazy singleton pattern - prevents blocking during server startup
let _mastraInstance: Mastra | null = null
let _initError: Error | null = null

/**
 * Get Mastra instance (lazy-loaded singleton)
 * Initializes on first call to prevent blocking server startup
 *
 * IMPORTANT: This should ONLY be called inside route handlers or service functions,
 * NEVER at module level to avoid blocking server startup
 */
export function getMastra(): Mastra {
  if (_initError) {
    throw _initError
  }
  if (!_mastraInstance) {
    try {
      _mastraInstance = createMastra()
    } catch (error) {
      _initError = error as Error
      throw _initError
    }
  }
  return _mastraInstance
}

// For backward compatibility, export a getter-based object
// This allows existing code like `mastra.getWorkflow()` to work
// but only initializes when actually accessed
export const mastra = {
  getWorkflow: (name: string) => getMastra().getWorkflow(name),
  getAgent: (name: string) => getMastra().getAgent(name),
  // get workflows() { return getMastra().workflows },
  // get agents() { return getMastra().agents },
}
