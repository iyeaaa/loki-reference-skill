import type { PreviewLeadData } from "../services/lead-import"

export interface FileAttachment {
  fileName: string
  fileSize: number
  fileType: string
  content?: string // Parsed content for CSV files
}

export interface Insight {
  insight: string
  recommendation: string
  impact: "high" | "medium" | "low"
  category?: string
}

export interface VisualizationSuggestion {
  type: "bar" | "line" | "pie" | "table" | "metric"
  title: string
  xAxis?: string
  yAxis?: string
  description: string
  config?: unknown
}

export interface ChatbotProgress {
  type: "init" | "progress" | "complete"
  node?: string
  message?: string
  phase?: string
  percent?: number
  currentStep?: string
  totalSteps?: number
  completedSteps?: number
  details?: {
    sqlTokens?: number
    totalSqlTokens?: number
    queryRowsProcessed?: number
    queryTotalRows?: number
    analysisComplete?: boolean
  }
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  attachment?: FileAttachment
  metadata?: {
    sql?: string
    sqlExplanation?: string
    result?: unknown[]
    insights?: Insight[]
    visualization?: VisualizationSuggestion[]
    followUpQuestions?: string[]
    importResult?: unknown
    importProgress?: unknown
    chatbotProgress?: ChatbotProgress
    leadPreview?: {
      totalRows: number
      previewRows: number
      leads: PreviewLeadData[]
      sheetName: string
      availableSheets: string[]
    }
  }
}

export interface ChatbotAskRequest {
  question: string
  workspaceId: string
  userId?: string
  conversationId?: string
  messages?: ChatMessage[]
}

export interface StreamEvent {
  type:
    | "node"
    | "node-start"
    | "node-complete"
    | "done"
    | "error"
    | "text_chunk"
    | "waiting_confirmation"
    | "interrupt"
    | "ping"
    | "thinking"
    | "progress"
  node?: string
  message?: string
  state?: {
    generatedSQL?: string
    queryResult?: unknown[]
    analysis?: string
    insights?: Insight[]
    visualizationSuggestions?: VisualizationSuggestion[]
    followUpQuestions?: string[]
    error?: string
    needsConfirmation?: boolean
    confirmationMessage?: string
    metadata?: unknown
    sqlExplanation?: string
    executionTime?: number
    messages?: ChatMessage[]
  }
  chunk?: string
  accumulatedText?: string
  timestamp?: number
  error?: string
  percent?: number
  phase?: string
  details?: Record<string, unknown>
  result?: unknown
  // New: interrupt event payload
  payload?: {
    type?: string
    confirmationMessage?: string
    metadata?: {
      sql?: string
      sqlQueries?: string[]
      sqlExplanation?: string
      queryCount?: number
    }
  }
}

export interface ChatbotHistoryResponse {
  messages: ChatMessage[]
  conversationId: string
}

export interface NodeProgressUpdate {
  nodeName: string
  status: "pending" | "in_progress" | "completed" | "error"
  message?: string
  percent?: number
  timestamp: number
}

export interface StreamCallbacks {
  onMessage: (message: ChatMessage) => void
  onMessageUpdate?: (message: ChatMessage) => void
  onThinking: (thinking: string) => void
  onProgress?: (progress: ChatbotProgress) => void
  onError?: (error: string) => void
  onConfirmationRequired?: (message: string) => void
  onNodeProgress?: (progress: NodeProgressUpdate) => void
}
