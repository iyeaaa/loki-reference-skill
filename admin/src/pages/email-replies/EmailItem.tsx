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

type EmailItemProps = {
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
    if (isExpanded) {
      return ""
    }
    const content =
      email.bodyText || (email.bodyHtml ? email.bodyHtml.replace(/<[^>]*>/g, "").trim() : "")
    // 최대 150자까지만 표시 (너무 길면 잘라냄)
    return content.length > 150 ? `${content.substring(0, 150)}...` : content
  }

  // 첨부파일 다운로드 핸들러
  const handleDownloadAttachment = async (attachmentIndex: number) => {
    const attachment = email.attachments?.[attachmentIndex]
    if (!attachment) {
      return
    }

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
    if (bytes < 1024) {
      return `${bytes} B`
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }
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
    if (email.direction === "inbound") {
      return null
    }

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
                <span className="text-blue-600 text-xs">{email.openCount}</span>
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
                <span className="text-purple-600 text-xs">{email.clickCount}</span>
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
      className={`w-full rounded-lg border-t px-2 pt-4 pb-2 ${
        email.direction === "inbound" ? "bg-blue-50/30 dark:bg-blue-950/10" : ""
      }`}
    >
      <div>
        {/* Sender header - 클릭 가능 */}
        <button
          className="-m-2 mb-2 flex w-full cursor-pointer items-start gap-3 rounded bg-transparent p-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          onClick={onToggle}
          type="button"
        >
          {/* Profile Circle */}
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
            <span className="font-medium text-gray-600 text-xs dark:text-gray-300">
              {getInitials(senderEmail)}
            </span>
          </div>

          {/* Sender info */}
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="mb-0.5 flex items-center gap-2">
                <div className="truncate font-medium text-sm">
                  {senderName}{" "}
                  <span className="font-normal text-gray-500">&lt;{senderEmail}&gt;</span>
                </div>
                {/* Sequence step badge for outbound emails */}
                {email.direction === "outbound" &&
                  email.sequenceName &&
                  email.stepOrder !== null &&
                  email.stepOrder !== undefined && (
                    <Badge className="flex-shrink-0 text-xs" variant="secondary">
                      Step {email.stepOrder}
                    </Badge>
                  )}
              </div>
              {isExpanded ? (
                <div className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
                  <span>{recipientName}에게</span>
                  <Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          {/* biome-ignore lint/a11y/useSemanticElements: Cannot use button due to nesting in parent button */}
                          <span
                            className="ml-1 inline-flex cursor-pointer rounded p-0.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
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
                    <PopoverContent align="start" className="w-80">
                      <div className="space-y-2 text-xs">
                        <div className="flex">
                          <span className="w-24 font-medium text-gray-700 dark:text-gray-300">
                            보낸사람:
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {senderName} &lt;{senderEmail}&gt;
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 font-medium text-gray-700 dark:text-gray-300">
                            받는사람:
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">{recipientEmail}</span>
                        </div>
                        <div className="flex">
                          <span className="w-24 font-medium text-gray-700 dark:text-gray-300">
                            날짜:
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {formatKoreanDateTime(email.createdAt)}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 font-medium text-gray-700 dark:text-gray-300">
                            제목:
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {email.subject || "(제목 없음)"}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 font-medium text-gray-700 dark:text-gray-300">
                            발송 도메인:
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">{senderDomain}</span>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-gray-400 text-xs dark:text-gray-500">
                  {getPreviewContent() || "(내용 없음)"}
                </div>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {/* Engagement indicators */}
              {renderEngagementIndicators()}
              <div className="whitespace-nowrap text-gray-600 text-xs dark:text-gray-400">
                {formatKoreanDateTime(email.createdAt)}
              </div>
            </div>
          </div>
        </button>

        {/* Intent Badge for inbound emails only */}
        {email.direction === "inbound" && (
          <div className="mt-2 ml-13 flex items-center gap-2">
            <IntentSelector
              currentIntent={email.replyIntent}
              emailId={email.id}
              emailReplyId={email.emailReplyId || undefined}
              size="sm"
            />
          </div>
        )}

        {/* Email body - only show when expanded, 선택 가능 */}
        {isExpanded && (
          <>
            <div className="mt-3 ml-13 cursor-text select-text text-gray-700 text-sm dark:text-gray-300">
              <EmailBody
                bodyHtml={email.bodyHtml ?? undefined}
                bodyText={email.bodyText ?? undefined}
              />
            </div>

            {/* 첨부파일 섹션 */}
            {email.attachments && email.attachments.length > 0 && (
              <div className="mt-4 ml-13 space-y-2">
                <div className="mb-2 font-medium text-muted-foreground text-xs">첨부파일</div>
                <div className="flex flex-wrap gap-2">
                  {email.attachments.map((attachment, index) => (
                    <div
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm transition-colors hover:bg-muted/80"
                      key={index}
                    >
                      {getFileIcon(attachment.filename)}
                      <div className="flex min-w-0 flex-col">
                        <span className="max-w-[200px] truncate font-medium text-foreground">
                          {attachment.filename}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatFileSize(attachment.size)}
                        </span>
                      </div>
                      <Button
                        className="ml-1 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadAttachment(index)
                        }}
                        size="icon"
                        variant="ghost"
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
