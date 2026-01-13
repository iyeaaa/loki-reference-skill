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

// Types for Email Translation
export type TranslateEmailRequest = {
  subject: string
  bodyText: string
  targetLanguage: string
}

export type TranslateEmailResponse = {
  subject: string
  bodyText: string
  bodyHtml: string
  detectedLanguage: string
}

// Types for AI Email Editing
export type EditEmailRequest = {
  subject: string
  bodyText: string
  editPrompt: string
  targetLanguage?: string
}

export type EditEmailResponse = {
  subject: string
  bodyText: string
  bodyHtml: string
  detectedLanguage: string
}

// Types for AI Overall Summary Generation
export type GenerateOverallSummaryRequest = {
  workspaceId?: string
  language?: string
  intent?: string
  limit?: number
}

export type GenerateOverallSummaryResponse = {
  emailCount: number
  intentDistribution: Record<string, number>
  summary: string
}

// Types for AI Column Mapping
export type ColumnMappingInput = {
  header: string
  sampleValues: string[]
}

export type ColumnMappingResult = {
  header: string
  mappedField: string | null
  confidence: "high" | "medium" | "low"
  reason: string
}

export type AIColumnMappingRequest = {
  columns: ColumnMappingInput[]
}

export type AIColumnMappingResponse = {
  mappings: ColumnMappingResult[]
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

  /**
   * Translate email to target language
   * POST /api/ai/translate-email
   */
  translateEmail: (data: TranslateEmailRequest) =>
    apiFetch<TranslateEmailResponse>("/api/ai/translate-email", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * Edit email with AI based on user prompt
   * POST /api/ai/edit-email
   */
  editEmail: (data: EditEmailRequest) =>
    apiFetch<EditEmailResponse>("/api/ai/edit-email", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * Generate AI overall summary for replied emails
   * POST /api/ai/generate-overall-summary
   */
  generateOverallSummary: (data: GenerateOverallSummaryRequest) =>
    apiFetch<GenerateOverallSummaryResponse>("/api/ai/generate-overall-summary", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * AI-powered column mapping for CSV import
   * POST /api/ai/column-mapping
   */
  columnMapping: (data: AIColumnMappingRequest) =>
    apiFetch<AIColumnMappingResponse>("/api/ai/column-mapping", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}
