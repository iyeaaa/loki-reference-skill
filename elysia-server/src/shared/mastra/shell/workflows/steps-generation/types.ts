import { z } from "zod"

/**
 * Campaign Step Generation Types
 * Schemas for AI-powered campaign step generation workflow
 */

/**
 * Context for generating campaign steps
 */
export const CampaignStepGenerationContextSchema = z.object({
  workspaceName: z.string().describe("Name of the workspace"),
  companyName: z.string().describe("Company name"),
  companyWebsite: z.string().optional().describe("Company website URL"),
  industry: z.string().optional().describe("Industry/sector"),
  companyDescription: z.string().optional().describe("Company description"),
  companySize: z.string().optional().describe("Company size"),
  rawResearchOutput: z.string().optional().describe("Company research output"),
  totalLeads: z.number().describe("Total number of leads in the campaign"),
  averageIndustry: z.string().optional().describe("Primary industry of leads"),
  leadsDescription: z.string().describe("Description of the lead group"),
  campaignName: z.string().optional().describe("Name of the campaign"),
  campaignDescription: z.string().optional().describe("Description of the campaign"),
  campaignMemo: z.string().optional().describe("Memo for the campaign"),
  groupName: z.string().optional().describe("Name of the lead group"),
  groupDescription: z.string().optional().describe("Description of the lead group"),
})

export type CampaignStepGenerationContext = z.infer<typeof CampaignStepGenerationContextSchema>

/**
 * Generated campaign step structure
 */
export const GeneratedCampaignStepSchema = z.object({
  stepOrder: z.number().min(1).describe("Step sequence number (1-based)"),
  emailType: z.string().describe("Type of email (Cold Intro, Follow-up, etc.)"),
  delayDays: z.number().min(0).describe("Days to wait from previous step"),
  scheduledHour: z.number().min(0).max(23).describe("Scheduled hour (0-23, UTC)"),
  scheduledMinute: z.number().min(0).max(59).describe("Scheduled minute (0-59)"),
})

export type GeneratedCampaignStep = z.infer<typeof GeneratedCampaignStepSchema>

/**
 * Quality judgment result
 */
export const JudgmentResultSchema = z.object({
  pass: z.boolean().describe("Whether the quality check passed"),
  qualityScore: z.number().min(0).max(10).describe("Quality/strategy score (0-10)"),
  accuracyScore: z.number().min(0).max(10).describe("Accuracy score (0-10)"),
  feedback: z.string().describe("Feedback message"),
  issues: z.array(z.string()).optional().describe("List of issues found"),
})

export type JudgmentResult = z.infer<typeof JudgmentResultSchema>

/**
 * Campaign steps generation response
 */
export const CampaignStepsResponseSchema = z.object({
  success: z.boolean().describe("Whether generation succeeded"),
  steps: z.array(GeneratedCampaignStepSchema).describe("Generated campaign steps"),
  reasoning: z.string().optional().describe("Explanation of the strategy"),
  error: z.string().optional().describe("Error message if failed"),
  attempts: z.number().optional().describe("Number of attempts made"),
})

export type CampaignStepsResponse = z.infer<typeof CampaignStepsResponseSchema>

/**
 * Internal draft response from AI
 */
export const StepsDraftResponseSchema = z.object({
  stepsDescription: z.string().describe("Detailed description of campaign strategy"),
  reasoning: z.string().describe("Brief explanation of overall strategy"),
  judgment: JudgmentResultSchema.describe("Quality assessment"),
})

export type StepsDraftResponse = z.infer<typeof StepsDraftResponseSchema>

/**
 * Parsed steps structure
 */
export const ParsedStepsSchema = z.object({
  steps: z.array(GeneratedCampaignStepSchema).describe("Parsed campaign steps"),
  reasoning: z.string().describe("Strategy explanation"),
})

export type ParsedSteps = z.infer<typeof ParsedStepsSchema>
