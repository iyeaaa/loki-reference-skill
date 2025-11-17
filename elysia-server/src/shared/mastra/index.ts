/**
 * Shared Mastra slice - AI agent infrastructure
 *
 * Core: Configuration validation
 * Shell: Mastra instance, agent creation
 */

export type { AgentInstructions, MastraConfig } from "./core/validate"
// Core exports
export { validateAgentInstructions, validateMastraConfig } from "./core/validate"
export { createEmailDraftAgent } from "./shell/agents/email-draft-agent"
export { createEmailReplyAgent } from "./shell/agents/email-reply-agent"
export { createGeneralAssistantAgent } from "./shell/agents/general-assistant"
export { createSequenceEmailAgent } from "./shell/agents/sequence-email-agent"
export { createCampaignStepsAgent } from "./shell/agents/steps-agent"
export { createResearchAgent } from "./shell/agents/web-research-agent"
// Shell exports
export { mastra } from "./shell/mastra"
