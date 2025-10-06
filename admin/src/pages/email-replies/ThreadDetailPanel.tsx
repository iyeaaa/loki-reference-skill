import { useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, MoreHorizontal, Reply, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useThreadEmails } from "@/lib/api/hooks/emails"
import { formatKoreanDateTime } from "@/lib/date-utils"
import { InlineComposeBox } from "./InlineComposeBox"

interface ThreadDetailPanelProps {
  threadId: string
  workspaceId?: string
  onClose: () => void
}

/**
 * Split email body by email address pattern
 * Detects lines containing <email@example.com> and treats everything from that line onwards as quoted text
 */
function splitEmailByEmailPattern(bodyText: string): {
  mainContent: string
  quotedText: string | null
} {
  if (!bodyText) {
    return { mainContent: "", quotedText: null }
  }

  // Pattern to detect email in angle brackets: <email@example.com>
  const emailPattern = /<[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}>/

  const lines = bodyText.split("\n")

  // Find the first line containing an email address in angle brackets
  for (let i = 0; i < lines.length; i++) {
    if (emailPattern.test(lines[i])) {
      const mainContent = lines.slice(0, i).join("\n").trim()
      const quotedText = lines.slice(i).join("\n").trim()
      return { mainContent, quotedText }
    }
  }

  // No email pattern found, return all as main content
  return { mainContent: bodyText, quotedText: null }
}

/**
 * Email body component with collapsible quoted text
 */
function EmailBody({ bodyText, bodyHtml }: { bodyText?: string; bodyHtml?: string }) {
  const [isQuotedExpanded, setIsQuotedExpanded] = useState(false)

  const content = bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]*>/g, "").trim() : "")
  const { mainContent, quotedText } = splitEmailByEmailPattern(content)

  if (!content) {
    return <div className="text-muted-foreground italic">(내용 없음)</div>
  }

  return (
    <div className="space-y-2">
      {/* Main content */}
      {mainContent && <div className="whitespace-pre-wrap break-words">{mainContent}</div>}

      {/* Quoted text (collapsible) - default collapsed */}
      {quotedText && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setIsQuotedExpanded(!isQuotedExpanded)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-700"
          >
            {isQuotedExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </button>

          {isQuotedExpanded && (
            <div className="mt-2 pl-3 border-l-2 border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
              {quotedText}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ThreadDetailPanel({ threadId, workspaceId, onClose }: ThreadDetailPanelProps) {
  const { data, isLoading, error } = useThreadEmails(threadId, workspaceId)
  const emails = data?.data || []
  const queryClient = useQueryClient()

  // 답장 상태
  const [showReply, setShowReply] = useState(false)
  const [composeExpanded, setComposeExpanded] = useState(false)
  const [composeFullscreen, setComposeFullscreen] = useState(false)

  if (isLoading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <div className="text-sm text-muted-foreground">스레드 로딩 중...</div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-red-600">
          <div className="text-sm">스레드 로드 실패</div>
        </div>
      </Card>
    )
  }

  if (emails.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-sm">메시지가 없습니다</div>
        </div>
      </Card>
    )
  }

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase()
  }

  const getName = (email: string, leadName?: string | null) => {
    if (leadName) return leadName
    return email.split("@")[0]
  }

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-base truncate flex-1">
            {emails[0]?.subject || "(제목 없음)"}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 ml-2">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Email thread */}
      <TooltipProvider>
        <ScrollArea className="flex-1 px-4 pb-4">
          <div className="space-y-8 pb-4">
            {emails.map((email, index) => {
              const senderEmail = email.fromEmail
              const senderName = getName(
                email.fromEmail,
                email.direction === "inbound" ? email.leadName : null,
              )
              const recipientEmail = email.toEmail
              const recipientName = getName(
                email.toEmail,
                email.direction === "outbound" ? email.leadName : null,
              )

              const senderDomain = senderEmail.split("@")[1]

              return (
                <div key={email.id} className={index > 0 ? "pt-6 border-t" : ""}>
                  {/* Sender header */}
                  <div className="flex items-start gap-3 mb-2">
                    {/* Profile Circle */}
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {getInitials(senderEmail)}
                      </span>
                    </div>

                    {/* Sender info */}
                    <div className="flex-1 min-w-0 flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {senderName}{" "}
                          <span className="text-gray-500 font-normal">&lt;{senderEmail}&gt;</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <span>{recipientName}에게</span>
                          <Popover>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded p-0.5 transition-colors"
                                  >
                                    <ChevronDown className="h-3 w-3 text-gray-400" />
                                  </button>
                                </PopoverTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>상세 정보 보기</p>
                              </TooltipContent>
                            </Tooltip>
                            <PopoverContent className="w-80" align="start">
                              <div className="space-y-2 text-xs">
                                <div className="flex">
                                  <span className="font-medium w-24 text-gray-700 dark:text-gray-300">
                                    보낸사람:
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {senderName} &lt;{senderEmail}&gt;
                                  </span>
                                </div>
                                <div className="flex">
                                  <span className="font-medium w-24 text-gray-700 dark:text-gray-300">
                                    받는사람:
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {recipientEmail}
                                  </span>
                                </div>
                                <div className="flex">
                                  <span className="font-medium w-24 text-gray-700 dark:text-gray-300">
                                    날짜:
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {formatKoreanDateTime(email.createdAt)}
                                  </span>
                                </div>
                                <div className="flex">
                                  <span className="font-medium w-24 text-gray-700 dark:text-gray-300">
                                    제목:
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {email.subject || "(제목 없음)"}
                                  </span>
                                </div>
                                <div className="flex">
                                  <span className="font-medium w-24 text-gray-700 dark:text-gray-300">
                                    발송 도메인:
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {senderDomain}
                                  </span>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatKoreanDateTime(email.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Email body */}
                  <div className="ml-13 text-sm text-gray-700 dark:text-gray-300 mt-3">
                    <EmailBody
                      bodyText={email.bodyText ?? undefined}
                      bodyHtml={email.bodyHtml ?? undefined}
                    />
                  </div>
                </div>
              )
            })}

            {/* 인라인 작성 영역 */}
            {showReply && emails.length > 0 && (
              <InlineComposeBox
                originalEmail={emails[emails.length - 1]}
                workspaceId={workspaceId || ""}
                expanded={composeExpanded}
                fullscreen={composeFullscreen}
                onExpand={() => setComposeExpanded(!composeExpanded)}
                onFullscreen={() => setComposeFullscreen(!composeFullscreen)}
                onClose={() => {
                  setShowReply(false)
                  setComposeExpanded(false)
                  setComposeFullscreen(false)
                }}
                onSent={() => {
                  // 스레드 새로고침
                  queryClient.invalidateQueries({ queryKey: ["thread-emails", threadId] })
                  queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
                }}
              />
            )}
          </div>
        </ScrollArea>
      </TooltipProvider>

      {/* 하단 답장 버튼 (Gmail 스타일) */}
      {!showReply && emails.length > 0 && (
        <div className="px-4 py-3 border-t">
          <Button
            onClick={() => {
              setShowReply(true)
              setComposeExpanded(false)
            }}
            size="sm"
            variant="default"
          >
            <Reply className="h-4 w-4 mr-2" />
            답장
          </Button>
        </div>
      )}
    </Card>
  )
}
