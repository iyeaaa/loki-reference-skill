import {
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  Eye,
  File,
  FileSpreadsheet,
  MousePointerClick,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ThreadEmail } from "@/lib/api/types/email"
import { formatKoreanDateTime } from "@/lib/date-utils"
import { EmailBody } from "./EmailBody"
import { IntentSelector } from "./IntentSelector"
import { getDomain, getInitials, getName } from "./utils"

interface EmailItemProps {
  email: ThreadEmail
  isExpanded: boolean
  onToggle: () => void
}

/**
 * Individual email item in thread
 */
export function EmailItem({ email, isExpanded, onToggle }: EmailItemProps) {
  const senderEmail = email.fromEmail
  const senderName = getName(email.fromEmail, email.direction === "inbound" ? email.leadName : null)
  const recipientEmail = email.toEmail
  const recipientName = getName(
    email.toEmail,
    email.direction === "outbound" ? email.leadName : null,
  )
  const senderDomain = getDomain(senderEmail)

  // 미리보기 content는 접힌 상태일 때만 계산 (최적화)
  const getPreviewContent = () => {
    if (isExpanded) return ""
    const content =
      email.bodyText || (email.bodyHtml ? email.bodyHtml.replace(/<[^>]*>/g, "").trim() : "")
    // 최대 150자까지만 표시 (너무 길면 잘라냄)
    return content.length > 150 ? `${content.substring(0, 150)}...` : content
  }

  // 첨부파일 다운로드 핸들러
  const handleDownloadAttachment = async (attachmentIndex: number) => {
    const attachment = email.attachments?.[attachmentIndex]
    if (!attachment) return

    try {
      const response = await fetch(`/api/v1/emails/${email.id}/attachments/${attachmentIndex}`)
      if (!response.ok) {
        throw new Error("첨부파일 다운로드 실패")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = attachment.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to download attachment:", error)
    }
  }

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 파일 타입별 아이콘 반환
  const getFileIcon = (filename: string) => {
    const lowerFilename = filename.toLowerCase()
    if (
      lowerFilename.endsWith(".xlsx") ||
      lowerFilename.endsWith(".xls") ||
      lowerFilename.endsWith(".csv")
    ) {
      return <FileSpreadsheet className="h-4 w-4 text-green-600" />
    }
    return <File className="h-4 w-4 text-muted-foreground" />
  }

  // Engagement status indicators (for outbound emails)
  const renderEngagementIndicators = () => {
    if (email.direction === "inbound") return null

    const indicators = []

    // Sent status
    if (email.sentAt) {
      indicators.push(
        <Tooltip key="sent">
          <TooltipTrigger>
            <Check className="h-3 w-3 text-green-600" />
          </TooltipTrigger>
          <TooltipContent>
            <p>전송됨: {formatKoreanDateTime(email.sentAt)}</p>
          </TooltipContent>
        </Tooltip>,
      )
    }

    // Delivered status
    if (email.deliveredAt) {
      indicators.push(
        <Tooltip key="delivered">
          <TooltipTrigger>
            <CheckCheck className="h-3 w-3 text-green-600" />
          </TooltipTrigger>
          <TooltipContent>
            <p>수신됨: {formatKoreanDateTime(email.deliveredAt)}</p>
          </TooltipContent>
        </Tooltip>,
      )
    }

    // Opened status
    if (email.openedAt && email.openCount > 0) {
      indicators.push(
        <Tooltip key="opened">
          <TooltipTrigger>
            <div className="flex items-center gap-0.5">
              <Eye className="h-3 w-3 text-blue-600" />
              {email.openCount > 1 && (
                <span className="text-xs text-blue-600">{email.openCount}</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              열람됨: {formatKoreanDateTime(email.openedAt)} ({email.openCount}회)
            </p>
          </TooltipContent>
        </Tooltip>,
      )
    }

    // Clicked status
    if (email.clickedAt && email.clickCount > 0) {
      indicators.push(
        <Tooltip key="clicked">
          <TooltipTrigger>
            <div className="flex items-center gap-0.5">
              <MousePointerClick className="h-3 w-3 text-purple-600" />
              {email.clickCount > 1 && (
                <span className="text-xs text-purple-600">{email.clickCount}</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              클릭됨: {formatKoreanDateTime(email.clickedAt)} ({email.clickCount}회)
            </p>
          </TooltipContent>
        </Tooltip>,
      )
    }

    return indicators.length > 0 ? (
      <div className="flex items-center gap-1.5">{indicators}</div>
    ) : null
  }

  return (
    <div
      className={`w-full rounded-lg border-t pt-4 pb-2 px-2 ${
        email.direction === "inbound" ? "bg-blue-50/30 dark:bg-blue-950/10" : ""
      }`}
    >
      <div>
        {/* Sender header - 클릭 가능 */}
        <button
          type="button"
          className="w-full flex items-start gap-3 mb-2 cursor-pointer text-left bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 rounded p-2 -m-2 transition-colors"
          onClick={onToggle}
        >
          {/* Profile Circle */}
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {getInitials(senderEmail)}
            </span>
          </div>

          {/* Sender info */}
          <div className="flex-1 min-w-0 flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="font-medium text-sm truncate">
                  {senderName}{" "}
                  <span className="text-gray-500 font-normal">&lt;{senderEmail}&gt;</span>
                </div>
                {/* Sequence step badge for outbound emails */}
                {email.direction === "outbound" &&
                  email.sequenceName &&
                  email.stepOrder !== null &&
                  email.stepOrder !== undefined && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      Step {email.stepOrder}
                    </Badge>
                  )}
              </div>
              {isExpanded ? (
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <span>{recipientName}에게</span>
                  <Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          {/* biome-ignore lint/a11y/useSemanticElements: Cannot use button due to nesting in parent button */}
                          <span
                            className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded p-0.5 transition-colors inline-flex cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation()
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <ChevronDown className="h-3 w-3 text-gray-400" />
                          </span>
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
                          <span className="text-gray-600 dark:text-gray-400">{recipientEmail}</span>
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
                          <span className="text-gray-600 dark:text-gray-400">{senderDomain}</span>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 whitespace-pre-wrap line-clamp-2">
                  {getPreviewContent() || "(내용 없음)"}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Engagement indicators */}
              {renderEngagementIndicators()}
              <div className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {formatKoreanDateTime(email.createdAt)}
              </div>
            </div>
          </div>
        </button>

        {/* Intent Badge for inbound emails only */}
        {email.direction === "inbound" && (
          <div className="ml-13 mt-2 flex items-center gap-2">
            <IntentSelector
              emailId={email.id}
              emailReplyId={email.emailReplyId || undefined}
              currentIntent={email.replyIntent}
              size="sm"
            />
          </div>
        )}

        {/* Email body - only show when expanded, 선택 가능 */}
        {isExpanded && (
          <>
            <div className="ml-13 text-sm text-gray-700 dark:text-gray-300 mt-3 select-text cursor-text">
              <EmailBody
                bodyText={email.bodyText ?? undefined}
                bodyHtml={email.bodyHtml ?? undefined}
              />
            </div>

            {/* 첨부파일 섹션 */}
            {email.attachments && email.attachments.length > 0 && (
              <div className="ml-13 mt-4 space-y-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">첨부파일</div>
                <div className="flex flex-wrap gap-2">
                  {email.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm hover:bg-muted/80 transition-colors"
                    >
                      {getFileIcon(attachment.filename)}
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate max-w-[200px]">
                          {attachment.filename}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadAttachment(index)
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
