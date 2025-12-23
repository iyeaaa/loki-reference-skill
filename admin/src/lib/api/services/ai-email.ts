import { apiFetch } from "../client"

// Types for AI Email Draft Generation
export type GenerateEmailDraftRequest = {
  fromEmail: string
  subject?: string
  content: string
}

export type GenerateEmailDraftResponse = {
  body: string
  subject: string
}

// Types for AI Template Generation
export type GenerateTemplateRequest = {
  workspaceId: string
  country: string
  prompt: string
  model?: string
  temperature?: number
}

export type GenerateTemplateResponse = {
  emailSubject: string
  emailBodyText: string
  emailBodyHtml: string
  detectedLanguage: string
}

// Types for AI Follow-up Generation
export type GenerateFollowupRequest = {
  threadId: string
  workspaceId?: string
}

export type GenerateFollowupResponse = {
  threadId: string
  subject: string
  emailCount: number
  rawResponse: string
}

// Types for AI Summary Generation
export type GenerateSummaryRequest = {
  threadId: string
  workspaceId?: string
  language?: string
}

export type GenerateSummaryResponse = {
  threadId: string
  subject: string
  emailCount: number
  summary: string
}

export const aiEmailApi = {
  /**
   * Generate AI email reply draft
   * POST /api/ai/email-draft
   */
  generateDraft: (data: GenerateEmailDraftRequest) =>
    apiFetch<GenerateEmailDraftResponse>("/api/ai/email-draft", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * Generate AI email template based on workspace info
   * POST /api/v1/sequences/generate-template
   */
  generateTemplate: (data: GenerateTemplateRequest) =>
    apiFetch<GenerateTemplateResponse>("/api/v1/sequences/generate-template", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * Generate AI follow-up suggestion for email thread
   * POST /api/ai/generate-followup
   */
  generateFollowup: (data: GenerateFollowupRequest) =>
    apiFetch<GenerateFollowupResponse>("/api/ai/generate-followup", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * Generate AI conversation summary
   * POST /api/ai/generate-summary
   */
  generateSummary: (data: GenerateSummaryRequest) =>
    apiFetch<GenerateSummaryResponse>("/api/ai/generate-summary", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}
