import { z } from "zod"

/**
 * Mastra configuration validation schema
 */
export const MastraConfigSchema = z.object({
  openaiApiKey: z.string().min(1, "OpenAI API key is required"),
  model: z.string().default("gpt-4o-mini"),
  maxTokens: z.number().int().positive().default(1000),
  temperature: z.number().min(0).max(2).default(0.7),
  rindaLeadPgUrl: z.string().url().min(1, "Rinda Lead PostgreSQL connection URL is required"),
  jinaApiKey: z.string().min(1, "Jina API key is required"),
  hasdataApiKey: z.string().min(1, "HasData API key is required"),
})

export type MastraConfig = z.infer<typeof MastraConfigSchema>

/**
 * Validates Mastra configuration
 * Pure function - no side effects
 */
export function validateMastraConfig(raw: unknown): MastraConfig {
  return MastraConfigSchema.parse(raw)
}

/**
 * Agent instruction validation
 */
export const AgentInstructionsSchema = z.object({
  name: z.string().min(1),
  instructions: z.string().min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
})

export type AgentInstructions = z.infer<typeof AgentInstructionsSchema>

/**
 * Validates agent instructions
 */
export function validateAgentInstructions(raw: unknown): AgentInstructions {
  return AgentInstructionsSchema.parse(raw)
}
