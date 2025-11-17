import { z } from "zod"

/**
 * Email Reply Generation Workflow Types
 * Type-safe schemas for customer service email replies
 */

/**
 * Email context for reply generation
 */
export const EmailReplyContextSchema = z.object({
  fromEmail: z.string().describe("Sender email address"),
  subject: z.string().describe("Email subject"),
  content: z.string().describe("Email content/body"),
  receivedTime: z.date().describe("Time email was received"),
})

export type EmailReplyContext = z.infer<typeof EmailReplyContextSchema>

/**
 * Email reply generation response
 */
export const EmailReplyResponseSchema = z.object({
  success: z.boolean().describe("Whether generation succeeded"),
  replyContent: z.string().optional().describe("Generated reply content"),
  error: z.string().optional().describe("Error message if failed"),
})

export type EmailReplyResponse = z.infer<typeof EmailReplyResponseSchema>
