// Workflow Generated Email Types

export type WorkflowEmailStatus = "pending" | "generating" | "generated" | "edited" | "failed"
export type GenerationMode = "ai" | "manual" | "template"

export interface WorkflowGeneratedEmail {
  id: string
  sequenceId: string
  nodeId: string
  leadId: string
  subject: string
  bodyText?: string | null
  bodyHtml?: string | null
  status: WorkflowEmailStatus
  generationMode: GenerationMode
  aiPrompt?: string | null
  aiModel?: string | null
  generationError?: string | null
  contextSnapshot?: Record<string, unknown> | null
  generatedAt?: string | null
  editedAt?: string | null
  createdAt: string
  updatedAt: string
  // Extended fields from joins
  companyName?: string
  contactName?: string
  contactEmail?: string
  industry?: string
}

export interface GenerateAllEmailsRequest {
  mode: "ai" | "manual"
  aiPrompt?: string
  aiModel?: string
  templateSubject?: string
  templateBody?: string
  templateBodyHtml?: string
}

export interface GenerateAllEmailsResponse {
  message: string
  generated: number
  total: number
  failed: number
  errors?: Array<{
    leadId: string
    error: string
  }>
}

export interface UpdateGeneratedEmailRequest {
  subject?: string
  bodyText?: string
  bodyHtml?: string
}
