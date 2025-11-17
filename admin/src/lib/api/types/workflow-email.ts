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
  mode: "ai" | "manual" | "template"
  aiPrompt?: string
  aiModel?: string
  templateSubject?: string
  templateBody?: string
  templateBodyHtml?: string
  incremental?: boolean // true면 이미 생성된 이메일은 스킵
}

export interface GenerateAllEmailsResponse {
  message: string
  generated: number
  total: number
  failed: number
  skipped?: number // incremental 모드일 때 스킵된 수
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
