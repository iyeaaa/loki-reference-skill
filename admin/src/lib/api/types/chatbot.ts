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
  type: "node" | "done" | "error" | "text_chunk"
  node?: string
  state?: {
    generatedSQL?: string
    queryResult?: unknown[]
    analysis?: string
    insights?: unknown[]
    visualizationSuggestions?: unknown[]
    followUpQuestions?: string[]
    error?: string
  }
  chunk?: string
  accumulatedText?: string
  timestamp?: number
  error?: string
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
}
