import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { ChatMessage } from "@/lib/api/types/chatbot"
import { MessageBubble } from "./MessageBubble"
import { type NodeProgress, NodeProgressTracker } from "./NodeProgressTracker"
import { StarSpinner } from "./StarSpinner"

// Map server messages to translation keys
const THINKING_MESSAGE_KEYS: Record<string, string> = {
  // Node start messages
  "Analyzing your request...": "chatbot.thinking.analyzingRequest",
  "Finding the data you need...": "chatbot.thinking.findingData",
  "Validating request...": "chatbot.thinking.validatingRequest",
  "Loading data...": "chatbot.thinking.loadingData",
  "Organizing results...": "chatbot.thinking.organizingResults",
  "Summarizing key insights...": "chatbot.thinking.summarizingInsights",
  "Creating visualizations...": "chatbot.thinking.creatingVisualizations",
  "Generating follow-up questions...": "chatbot.thinking.generatingFollowUps",
  // Progress messages
  "Analyzing results...": "chatbot.thinking.analyzingResults",
  "Analysis complete": "chatbot.thinking.analysisComplete",
  "Checking if query is safe to execute...": "chatbot.thinking.checkingQuerySafety",
  "Checking data access permissions...": "chatbot.thinking.checkingPermissions",
  "Checking query complexity...": "chatbot.thinking.checkingComplexity",
  "Searching for data...": "chatbot.thinking.searchingData",
  "Analyzing lead data with AI...": "chatbot.thinking.analyzingLeadData",
}

interface StreamingMessageContainerProps {
  message: ChatMessage | null
  isStreaming: boolean
  needsConfirmation: boolean
  onConfirm?: (confirmed: boolean) => void
  nodeProgress: NodeProgress[]
  thinkingMessage: string | null
  hideArtifact?: boolean
}

/**
 * Unified streaming message container - Claude/ChatGPT style
 *
 * Structure:
 * 1. Message content (always visible when present)
 * 2. Progress indicators (smoothly transition below content)
 * 3. Thinking status (shown at the end)
 *
 * Key improvements:
 * - Single source of truth for streaming state
 * - No flickering or disappearing content
 * - Smooth transitions between states
 * - Progress always shown below content (not replacing it)
 */
export const StreamingMessageContainer = React.memo(function StreamingMessageContainer({
  message,
  isStreaming,
  needsConfirmation,
  onConfirm,
  nodeProgress,
  thinkingMessage,
  hideArtifact = false,
}: StreamingMessageContainerProps) {
  const { t } = useTranslation()

  // Translate thinking message if it matches a known key
  const translatedThinkingMessage = useMemo(() => {
    if (!thinkingMessage) return null
    const translationKey = THINKING_MESSAGE_KEYS[thinkingMessage]
    return translationKey ? t(translationKey) : thinkingMessage
  }, [thinkingMessage, t])

  // Don't render if there's nothing to show
  if (!message && nodeProgress.length === 0 && !thinkingMessage) {
    return null
  }

  const hasProgress = nodeProgress.length > 0
  const hasThinking = !!translatedThinkingMessage

  return (
    <div className="w-full space-y-3">
      {/* Section 1: Thinking indicator with star spinner */}
      {hasThinking && (
        <div className="animate-in fade-in duration-200 flex items-center gap-2.5">
          <StarSpinner size={16} />
          <p className="text-sm text-muted-foreground font-medium">{translatedThinkingMessage}</p>
        </div>
      )}

      {/* Section 2: Main message content */}
      {message && (
        <MessageBubble
          message={message}
          isStreaming={isStreaming}
          needsConfirmation={needsConfirmation}
          onConfirm={onConfirm}
          hideArtifact={hideArtifact}
        />
      )}

      {/* Section 3: Progress indicators - Always below content */}
      {hasProgress && (
        <div className="ml-12">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <NodeProgressTracker progress={nodeProgress} />
          </div>
        </div>
      )}
    </div>
  )
})
