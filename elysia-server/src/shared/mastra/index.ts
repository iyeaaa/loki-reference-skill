/**
 * Shared Mastra slice - AI agent infrastructure
 *
 * Core: Configuration validation
 * Shell: Mastra instance, agent creation
 */

export type { AgentInstructions, MastraConfig } from "./core/validate"
// Core exports
export { validateAgentInstructions, validateMastraConfig } from "./core/validate"
export { createGeneralAssistantAgent } from "./shell/agents/general-assistant"
export { createResearchAgent } from "./shell/agents/web-research-agent"
// Shell exports
export { mastraConfig } from "./shell/config"
export { mastra } from "./shell/mastra"
