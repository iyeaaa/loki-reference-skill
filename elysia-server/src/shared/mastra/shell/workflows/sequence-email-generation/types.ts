import { z } from "zod"

/**
 * Sequence Email Generation Workflow Types
 * Type-safe schemas for Korean business email generation
 */

/**
 * Contact information
 */
const ContactSchema = z.object({
  contactName: z.string().optional().describe("Contact person name"),
  email: z.string().describe("Contact email address"),
  type: z.string().describe("Contact type (e.g., email, phone)"),
  label: z.string().optional().describe("Contact label"),
  isPrimary: z.boolean().describe("Whether this is the primary contact"),
})

/**
 * Social media profile
 */
const SocialMediaSchema = z.object({
  platform: z.string().describe("Social media platform"),
  url: z.string().describe("Profile URL"),
  username: z.string().optional().describe("Username"),
  followerCount: z.string().optional().describe("Follower count"),
})

/**
 * Product information
 */
const ProductSchema = z.object({
  productName: z.string().describe("Product name"),
  description: z.string().optional().describe("Product description"),
})

/**
 * Context for sequence email generation
 */
export const SequenceEmailContextSchema = z.object({
  // Basic recipient information
  companyName: z.string().describe("Recipient company name"),
  contactName: z.string().optional().describe("Recipient contact person name"),
  industry: z.string().optional().describe("Recipient industry/business type"),
  website: z.string().optional().describe("Recipient website URL"),

  // Enriched context arrays
  contacts: z.array(ContactSchema).optional().describe("All contacts for this lead"),
  socialMedia: z.array(SocialMediaSchema).optional().describe("Social media profiles"),
  products: z.array(ProductSchema).optional().describe("Products/services offered"),
  businessSectors: z.array(z.string()).optional().describe("Business sectors"),
  productCategories: z.array(z.string()).optional().describe("Product categories"),
  industryTypes: z.array(z.string()).optional().describe("Industry types"),

  // Additional metadata (used for prompt assembly inside workflow)
  additionalContext: z.string().optional().describe("Additional context for email generation"),
})

export type SequenceEmailContext = z.infer<typeof SequenceEmailContextSchema>

/**
 * Sequence email generation response
 */
export const SequenceEmailResponseSchema = z.object({
  success: z.boolean().describe("Whether generation succeeded"),
  subject: z.string().optional().describe("Email subject line"),
  bodyText: z.string().optional().describe("Email body content"),
  error: z.string().optional().describe("Error message if failed"),
})

export type SequenceEmailResponse = z.infer<typeof SequenceEmailResponseSchema>
