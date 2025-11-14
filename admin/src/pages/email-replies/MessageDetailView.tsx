import { Copy, Loader2, Mail, Send } from "lucide-react"
import { useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Tag } from "@/components/ui/tag"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ThreadEmail } from "@/lib/api/types/email"
import { formatKoreanDateTime } from "@/lib/date-utils"

interface MessageDetailViewProps {
  isOpen: boolean
  onClose: () => void
  email: ThreadEmail | null
  loading?: boolean
}

export function MessageDetailView({
  isOpen,
  onClose,
  email,
  loading = false,
}: MessageDetailViewProps) {
  const replyContentId = useId()
  const [replyContent, setReplyContent] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Reset reply content when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReplyContent("")
    }
  }, [isOpen])

  const handleSendReply = async () => {
    if (!replyContent.trim()) {
      toast.error("Please enter reply content")
      return
    }

    setIsSending(true)
    try {
      // TODO: Implement actual send reply logic
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call
      toast.success("Reply sent successfully")
      setReplyContent("")
      onClose()
    } catch (_error) {
      toast.error("Failed to send reply")
    } finally {
      setIsSending(false)
    }
  }

  const getInitials = (emailAddress: string) => {
    const parts = emailAddress.split("@")[0].split(".")
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return emailAddress.substring(0, 2).toUpperCase()
  }

  const getName = (emailAddress: string, leadName?: string | null) => {
    if (leadName) return leadName
    const localPart = emailAddress.split("@")[0]
    return localPart
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const makeLinksClickable = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {part}
          </a>
        )
      }
      return part
    })
  }

  if (!email && !loading) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Mail className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Select an email to view its contents</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  if (loading || !email) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Loading message...</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const senderName = getName(email.fromEmail, email.leadName)
  const recipientName = getName(email.toEmail)

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold mb-2 pr-8">{email.subject || "(No Subject)"}</h2>
              <div className="flex flex-wrap gap-2">
                {email.replyIntent && (
                  <Tag variant="other-category" size="small">
                    {email.replyIntent.replace("_", " ")}
                  </Tag>
                )}
                {email.replySentiment && (
                  <Tag
                    variant={
                      email.replySentiment === "positive" || email.replySentiment === "interested"
                        ? "positive"
                        : email.replySentiment === "negative" ||
                            email.replySentiment === "not_interested"
                          ? "negative"
                          : "other"
                    }
                    size="small"
                  >
                    {email.replySentiment.replace("_", " ")}
                  </Tag>
                )}
                <Badge variant={email.direction === "inbound" ? "default" : "secondary"}>
                  {email.direction === "inbound" ? "Inbound" : "Outbound"}
                </Badge>
                <Badge variant="outline">{email.status}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {getInitials(email.fromEmail)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{senderName}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(email.fromEmail)}
                        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        &lt;{email.fromEmail}&gt;
                        <Copy className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy email address</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-sm text-muted-foreground">
                to {recipientName} &lt;{email.toEmail}&gt;
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatKoreanDateTime(email.createdAt)}
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {email.bodyHtml ? (
              <div
                className="whitespace-pre-wrap break-words"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Email content needs to be rendered as HTML
                dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
              />
            ) : (
              <div className="whitespace-pre-wrap break-words">
                {email.bodyText ? makeLinksClickable(email.bodyText) : "(No content)"}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Reply Section */}
        <div className="border-t flex-shrink-0">
          {/* Reply Header */}
          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-950/20 border-b">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Send className="h-4 w-4" />
                <span className="font-medium text-sm">New Reply</span>
              </div>
              <span className="text-sm text-muted-foreground">Reply to {email.fromEmail}</span>
            </div>
          </div>

          {/* Reply Content Label */}
          <div className="px-6 pt-4 pb-2">
            <label
              htmlFor={replyContentId}
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Reply Content
            </label>
          </div>

          {/* Reply Textarea */}
          <div className="px-6 pb-4">
            <Textarea
              id={replyContentId}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Enter reply content..."
              className="min-h-[120px] resize-none"
              disabled={isSending}
            />
          </div>

          {/* Action Buttons */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex items-center gap-3">
            <Button
              onClick={handleSendReply}
              disabled={!replyContent.trim() || isSending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Reply
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={isSending}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
