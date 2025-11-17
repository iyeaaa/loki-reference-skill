import { z } from "zod"

/**
 * Email Generation Workflow Types
 * Type-safe schemas for personalized email generation
 */

/**
 * Lead contact information
 */
export const LeadContactSchema = z.object({
  contactName: z.string().optional().describe("Contact person name"),
  email: z.string().describe("Contact email address"),
  type: z.string().describe("Contact type (email, phone, fax, other)"),
  label: z.string().optional().describe("Label (e.g., main, support, sales)"),
  isPrimary: z.boolean().describe("Whether this is the primary contact"),
})

/**
 * Lead social media information
 */
export const LeadSocialMediaSchema = z.object({
  platform: z.string().describe("Social media platform (facebook, instagram, twitter, linkedin)"),
  url: z.string().describe("Profile URL"),
  username: z.string().optional().describe("Username/handle"),
  followerCount: z.string().optional().describe("Follower count (e.g., '10K', '1.5M')"),
})

/**
 * Lead product information
 */
export const LeadProductSchema = z.object({
  productName: z.string().describe("Product or service name"),
  description: z.string().optional().describe("Product description"),
})

/**
 * Context for email generation
 */
export const EmailGenerationContextSchema = z.object({
  // Basic company information
  companyName: z.string().describe("Recipient company name"),
  contactName: z.string().optional().describe("Recipient contact person name"),
  industry: z.string().optional().describe("Recipient industry/business type"),
  website: z.string().optional().describe("Recipient website URL"),

  // Enriched lead context
  contacts: z.array(LeadContactSchema).optional().describe("All contact information for the lead"),
  socialMedia: z.array(LeadSocialMediaSchema).optional().describe("Social media profiles"),
  products: z.array(LeadProductSchema).optional().describe("Products/services offered"),
  businessSectors: z.array(z.string()).optional().describe("Business sectors/categories"),
  productCategories: z.array(z.string()).optional().describe("Product category classifications"),
  industryTypes: z.array(z.string()).optional().describe("Industry type classifications"),

  // Additional context and instructions
  additionalContext: z.string().optional().describe("Extra context for personalization"),
  customPrompt: z.string().describe("Specific instructions for email generation"),
})

export type EmailGenerationContext = z.infer<typeof EmailGenerationContextSchema>

/**
 * Email metadata extracted from parsed email
 */
export const EmailMetadataSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]).describe("Email tone/sentiment"),
  intent: z.array(z.string()).describe("Primary intents/purposes of the email"),
  topics: z.array(z.string()).describe("Key topics discussed"),
  actionItems: z.array(z.string()).describe("Explicit or implied action items"),
})

export type EmailMetadata = z.infer<typeof EmailMetadataSchema>

/**
 * Parsed email data structure
 */
export const ParsedEmailDataSchema = z.object({
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Email body content"),
  greeting: z.string().describe("Greeting section"),
  signature: z.string().describe("Signature/closing section"),
  metadata: EmailMetadataSchema.describe("Extracted metadata"),
})

export type ParsedEmailData = z.infer<typeof ParsedEmailDataSchema>

/**
 * Quality judgment result from AI self-evaluation
 */
export const JudgmentResultSchema = z.object({
  pass: z.boolean().describe("Whether the email passed quality threshold"),
  qualityScore: z.number().min(0).max(10).describe("Quality/tone score (0-10)"),
  accuracyScore: z.number().min(0).max(10).describe("Accuracy/relevance score (0-10)"),
  feedback: z.string().describe("Brief feedback message"),
  issues: z.array(z.string()).optional().describe("Specific issues if pass is false"),
})

export type JudgmentResult = z.infer<typeof JudgmentResultSchema>

/**
 * Email generation response
 */
export const EmailGenerationResponseSchema = z.object({
  success: z.boolean().describe("Whether generation succeeded"),
  parsedEmail: ParsedEmailDataSchema.optional().describe("Parsed email data"),
  error: z.string().optional().describe("Error message if failed"),
  attempts: z.number().optional().describe("Number of generation attempts"),
})

export type EmailGenerationResponse = z.infer<typeof EmailGenerationResponseSchema>

/**
 * Internal draft response (with judgment)
 */
export interface EmailDraftResponse {
  emailContent: string
  judgment: JudgmentResult
}

/**
 * Internal parsed result (before final response)
 */
export interface ParsedEmailResult {
  subject: string
  body: string
  greeting: string
  signature: string
  metadata: EmailMetadata
}
