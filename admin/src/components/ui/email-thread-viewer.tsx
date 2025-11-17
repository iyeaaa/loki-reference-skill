import { Loader2, Reply } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FloatingReplyPopup } from "./floating-reply-popup"

export interface EmailMessage {
  id: string
  from: string
  fromName?: string
  to: string
  subject: string
  body: string
  timestamp: string
  isInbound: boolean
}

interface EmailThreadViewerProps {
  messages: EmailMessage[]
  onSendReply?: (replyText: string, subject: string) => void | Promise<void>
  loading?: boolean
  className?: string
}

/**
 * Email thread viewer component for displaying email conversations and composing replies
 * Similar to Gmail's thread view with inline reply functionality
 */
export function EmailThreadViewer({
  messages,
  onSendReply,
  loading = false,
  className = "",
}: EmailThreadViewerProps) {
  const [showReply, setShowReply] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const handleSendReply = async (replyText: string, subject: string) => {
    if (!replyText.trim() || !onSendReply) return

    setIsSending(true)
    try {
      await onSendReply(replyText, subject)
      setShowReply(false)
    } catch (error) {
      console.error("Failed to send reply:", error)
    } finally {
      setIsSending(false)
    }
  }

  const getInitials = (email: string) => {
    const parts = email.split("@")[0].split(".")
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return email.substring(0, 2).toUpperCase()
  }

  if (loading) {
    return (
      <Card className={`h-full flex items-center justify-center ${className}`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <div className="text-sm text-muted-foreground">Loading messages...</div>
        </div>
      </Card>
    )
  }

  if (messages.length === 0) {
    return (
      <Card className={`h-full flex items-center justify-center ${className}`}>
        <div className="text-center text-muted-foreground">
          <div className="text-sm">No messages to display</div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-base truncate flex-1">
            {messages[0]?.subject || "No Subject"}
          </h3>
        </div>
      </div>

      {/* Email thread */}
      <ScrollArea className="flex-1 px-4 pb-4">
        <div className="pb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`w-full rounded-lg border-t pt-4 pb-2 px-2 ${
                message.isInbound ? "bg-blue-50/30 dark:bg-blue-950/10" : ""
              }`}
            >
              <div className="flex items-start gap-3 mb-2">
                {/* Profile Circle */}
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {getInitials(message.from)}
                  </span>
                </div>

                {/* Message info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-sm">
                      {message.fromName || message.from}{" "}
                      <span className="text-gray-500 font-normal text-xs">
                        &lt;{message.from}&gt;
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap ml-2">
                      {message.timestamp}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">to {message.to}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 mt-3 whitespace-pre-wrap">
                    {message.body}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Reply button */}
      <div className="px-4 py-3 border-t">
        <Button onClick={() => setShowReply(true)} size="sm" variant="default">
          <Reply className="h-4 w-4 mr-2" />
          Reply
        </Button>
      </div>

      <FloatingReplyPopup
        isOpen={showReply}
        onClose={() => setShowReply(false)}
        onSend={handleSendReply}
        to={messages[messages.length - 1]?.from || ""}
        subject={`Re: ${messages[0]?.subject || ""}`}
        isSending={isSending}
      />
    </Card>
  )
}
