import React from "react"
import type { ChatMessage } from "@/lib/api/types/chatbot"
import { MessageBubble } from "./MessageBubble"
import { type NodeProgress, NodeProgressTracker } from "./NodeProgressTracker"
import { StarSpinner } from "./StarSpinner"

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
  // Don't render if there's nothing to show
  if (!message && nodeProgress.length === 0 && !thinkingMessage) {
    return null
  }

  const hasProgress = nodeProgress.length > 0
  const hasThinking = !!thinkingMessage

  return (
    <div className="w-full space-y-3">
      {/* Section 1: Thinking indicator with star spinner */}
      {hasThinking && (
        <div className="animate-in fade-in duration-200 flex items-center gap-2.5">
          <StarSpinner size={16} />
          <p className="text-sm text-muted-foreground font-medium">{thinkingMessage}</p>
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
