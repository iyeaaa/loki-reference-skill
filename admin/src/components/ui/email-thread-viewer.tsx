import { Loader2, Reply } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FloatingReplyPopup } from "./floating-reply-popup"

export type EmailMessage = {
  id: string
  from: string
  fromName?: string
  to: string
  subject: string
  body: string
  timestamp: string
  isInbound: boolean
}

type EmailThreadViewerProps = {
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
    if (!(replyText.trim() && onSendReply)) {
      return
    }

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
      <Card className={`flex h-full items-center justify-center ${className}`}>
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <div className="text-muted-foreground text-sm">Loading messages...</div>
        </div>
      </Card>
    )
  }

  if (messages.length === 0) {
    return (
      <Card className={`flex h-full items-center justify-center ${className}`}>
        <div className="text-center text-muted-foreground">
          <div className="text-sm">No messages to display</div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`flex h-full flex-col ${className}`}>
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="flex-1 truncate font-medium text-base">
            {messages[0]?.subject || "No Subject"}
          </h3>
        </div>
      </div>

      {/* Email thread */}
      <ScrollArea className="flex-1 px-4 pb-4">
        <div className="pb-4">
          {messages.map((message) => (
            <div
              className={`w-full rounded-lg border-t px-2 pt-4 pb-2 ${
                message.isInbound ? "bg-blue-50/30 dark:bg-blue-950/10" : ""
              }`}
              key={message.id}
            >
              <div className="mb-2 flex items-start gap-3">
                {/* Profile Circle */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                  <span className="font-medium text-gray-600 text-xs dark:text-gray-300">
                    {getInitials(message.from)}
                  </span>
                </div>

                {/* Message info */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-medium text-sm">
                      {message.fromName || message.from}{" "}
                      <span className="font-normal text-gray-500 text-xs">
                        &lt;{message.from}&gt;
                      </span>
                    </div>
                    <div className="ml-2 whitespace-nowrap text-gray-600 text-xs dark:text-gray-400">
                      {message.timestamp}
                    </div>
                  </div>
                  <div className="mb-2 text-muted-foreground text-xs">to {message.to}</div>
                  <div className="mt-3 whitespace-pre-wrap text-gray-700 text-sm dark:text-gray-300">
                    {message.body}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Reply button */}
      <div className="border-t px-4 py-3">
        <Button onClick={() => setShowReply(true)} size="sm" variant="default">
          <Reply className="mr-2 h-4 w-4" />
          Reply
        </Button>
      </div>

      <FloatingReplyPopup
        isOpen={showReply}
        isSending={isSending}
        onClose={() => setShowReply(false)}
        onSend={handleSendReply}
        subject={`Re: ${messages[0]?.subject || ""}`}
        to={messages.at(-1)?.from || ""}
      />
    </Card>
  )
}
