import { ChevronLeft, ChevronRight, Eye, Mail, MailOpen } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useEmailReplies } from "@/lib/api/hooks/email-replies"
import type { EmailReplyWithDetails } from "@/lib/api/types/email-reply"
import { formatRelativeTime } from "@/lib/date-utils"

interface RepliesTableWithPaginationProps {
  searchQuery: string
  workspaceId: string | undefined
  selectedReadStatus: boolean | undefined
  selectedSentiments: string[]
  selectedEmailAccountId: string | undefined
  selectedReplies: string[]
  onToggleReply: (replyId: string) => void
  onToggleAll: (replyIds: string[]) => void
  onViewReply: (reply: EmailReplyWithDetails) => void
}

export function RepliesTableWithPagination({
  searchQuery,
  workspaceId,
  selectedReadStatus,
  selectedSentiments,
  selectedEmailAccountId,
  selectedReplies,
  onToggleReply,
  onToggleAll,
  onViewReply,
}: RepliesTableWithPaginationProps) {
  const { t } = useTranslation("email-replies")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 10

  // Build params for API call
  const filters = {
    workspaceId,
    isRead: selectedReadStatus,
    sentiment: selectedSentiments.length === 1 ? selectedSentiments[0] : undefined,
    search: searchQuery || undefined,
    emailAccountId: selectedEmailAccountId,
  }

  const offset = (currentPage - 1) * limit

  // Use React Query hook for fetching replies
  const { data: repliesData, isFetching } = useEmailReplies({
    limit,
    offset,
    filters,
  })

  const replies = repliesData?.data || []
  const total = repliesData?.total || 0
  const totalPages = Math.ceil(total / limit) || 1

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return { label: "분석 전", color: "bg-gray-100 text-gray-800" }

    switch (sentiment) {
      case "positive":
        return { label: "긍정적", color: "bg-green-100 text-green-800" }
      case "neutral":
        return { label: "중립", color: "bg-gray-100 text-gray-800" }
      case "negative":
        return { label: "부정적", color: "bg-red-100 text-red-800" }
      case "interested":
        return { label: "관심있음", color: "bg-blue-100 text-blue-800" }
      case "not_interested":
        return { label: "관심없음", color: "bg-orange-100 text-orange-800" }
      default:
        return { label: sentiment, color: "bg-gray-100 text-gray-800" }
    }
  }

  const handleToggleAll = useCallback(() => {
    onToggleAll(replies.map((r) => r.id))
  }, [replies, onToggleAll])

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setPageInputValue(page.toString())
  }

  const handlePageInputChange = (value: string) => {
    setPageInputValue(value)
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const page = parseInt(pageInputValue, 10)
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page)
      } else {
        setPageInputValue(currentPage.toString())
      }
    }
  }

  const handlePageInputBlur = () => {
    const page = parseInt(pageInputValue, 10)
    if (Number.isNaN(page) || page < 1 || page > totalPages) {
      setPageInputValue(currentPage.toString())
    }
  }

  return (
    <div className="space-y-4">
      {/* Loading overlay */}
      {isFetching && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
          <div className="text-sm text-muted-foreground">{t("table.loading")}</div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    replies.length > 0 &&
                    selectedReplies.length === replies.length &&
                    replies.every((r) => selectedReplies.includes(r.id))
                  }
                  onCheckedChange={handleToggleAll}
                />
              </TableHead>
              <TableHead className="w-16">상태</TableHead>
              <TableHead>회사명</TableHead>
              <TableHead>제목</TableHead>
              <TableHead>이메일 계정</TableHead>
              <TableHead>감정</TableHead>
              <TableHead>날짜</TableHead>
              <TableHead className="w-24">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {replies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  답장이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              replies.map((reply) => (
                <TableRow key={reply.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedReplies.includes(reply.id)}
                      onCheckedChange={() => onToggleReply(reply.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {reply.isRead ? (
                      <MailOpen className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Mail className="h-4 w-4 text-blue-600" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <div className="font-medium truncate">
                        {reply.replyEmail?.companyName ||
                          reply.replyEmail?.contactName ||
                          reply.replyEmail?.leadName ||
                          "-"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px] truncate">
                      {reply.replyEmail?.subject || "(제목 없음)"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm truncate max-w-[150px]">
                      {reply.emailAccount?.emailAddress || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const badge = getSentimentBadge(reply.sentiment)
                      return (
                        <Badge variant="outline" className={badge.color}>
                          {badge.label}
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {reply.replyEmail?.sentAt
                      ? formatRelativeTime(new Date(reply.replyEmail.sentAt))
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => onViewReply(reply)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          총 {total}개 중 {offset + 1}-{Math.min(offset + limit, total)}개 표시
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isFetching}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={pageInputValue}
              onChange={(e) => handlePageInputChange(e.target.value)}
              onKeyDown={handlePageInputKeyDown}
              onBlur={handlePageInputBlur}
              className="w-16 text-center"
              disabled={isFetching}
            />
            <span className="text-sm text-muted-foreground">/ {totalPages}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isFetching}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
