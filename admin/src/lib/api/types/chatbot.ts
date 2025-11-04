export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  metadata?: {
    sql?: string
    result?: unknown[]
    insights?: unknown[]
    visualization?: unknown[]
    followUpQuestions?: string[]
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
  type: "node" | "done" | "error" | "text_chunk" | "waiting_confirmation" | "interrupt"
  node?: string
  state?: {
    generatedSQL?: string
    queryResult?: unknown[]
    analysis?: string
    insights?: unknown[]
    visualizationSuggestions?: unknown[]
    followUpQuestions?: string[]
    error?: string
    needsConfirmation?: boolean
    confirmationMessage?: string
  }
  chunk?: string
  accumulatedText?: string
  timestamp?: number
  error?: string
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

export interface StreamCallbacks {
  onMessage: (message: ChatMessage) => void
  onMessageUpdate?: (message: ChatMessage) => void
  onThinking: (thinking: string) => void
  onError?: (error: string) => void
  onConfirmationRequired?: (message: string) => void
}
