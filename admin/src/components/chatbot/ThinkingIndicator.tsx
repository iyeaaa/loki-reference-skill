import React from "react"
import { useTypingEffect } from "@/hooks/useTypingEffect"

interface ThinkingIndicatorProps {
  thinking: string
}

export const ThinkingIndicator = React.memo(function ThinkingIndicator({
  thinking,
}: ThinkingIndicatorProps) {
  const displayedText = useTypingEffect({ text: thinking, speed: 12 })

  return (
    <div className="w-full">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 will-change-auto">
        {/* Animated dots */}
        <div className="flex gap-1 pt-1">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          <div
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
            style={{ animationDelay: "0.2s" }}
          />
          <div
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
            style={{ animationDelay: "0.4s" }}
          />
        </div>

        {/* Progress message with typing effect */}
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {displayedText}
            <span className="animate-pulse">|</span>
          </p>
        </div>
      </div>
    </div>
  )
})
