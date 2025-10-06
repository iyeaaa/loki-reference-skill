import { BookOpen, Mail, MailCheck, Search, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBulkDeleteEmailReplies,
  useBulkMarkAsRead,
  useBulkMarkAsUnread,
} from "@/lib/api/hooks/email-replies"
import type { EmailReplyWithDetails } from "@/lib/api/types/email-reply"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { EmailReplyDetailsDialog } from "./EmailReplyDetailsDialog"
import { EmailReplyFilters } from "./EmailReplyFilters"
import { RepliesTableWithPagination } from "./RepliesTableWithPagination"

export default function EmailRepliesPage() {
  const { selectedWorkspace } = useWorkspace()

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedReadStatus, setSelectedReadStatus] = useState<boolean | undefined>(undefined)
  const [selectedSentiments, setSelectedSentiments] = useState<string[]>([])
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState<string | undefined>(
    undefined,
  )

  const [selectedReplies, setSelectedReplies] = useState<string[]>([])
  const [viewingReply, setViewingReply] = useState<EmailReplyWithDetails | null>(null)

  const bulkMarkAsRead = useBulkMarkAsRead()
  const bulkMarkAsUnread = useBulkMarkAsUnread()
  const bulkDeleteReplies = useBulkDeleteEmailReplies()

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleBulkMarkAsRead = async () => {
    if (selectedReplies.length === 0) {
      toast.error("선택된 답장이 없습니다.")
      return
    }

    bulkMarkAsRead.mutate(selectedReplies, {
      onSuccess: () => {
        setSelectedReplies([])
      },
    })
  }

  const handleBulkMarkAsUnread = async () => {
    if (selectedReplies.length === 0) {
      toast.error("선택된 답장이 없습니다.")
      return
    }

    bulkMarkAsUnread.mutate(selectedReplies, {
      onSuccess: () => {
        setSelectedReplies([])
      },
    })
  }

  const handleBulkDelete = async () => {
    if (selectedReplies.length === 0) {
      toast.error("선택된 답장이 없습니다.")
      return
    }

    if (
      !confirm(
        `선택한 ${selectedReplies.length}개의 답장을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`,
      )
    )
      return

    bulkDeleteReplies.mutate(selectedReplies, {
      onSuccess: () => {
        setSelectedReplies([])
      },
    })
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearchQuery(searchInput)
    }
  }

  const clearFilters = () => {
    setSelectedReadStatus(undefined)
    setSelectedSentiments([])
    setSelectedEmailAccountId(undefined)
    setSearchInput("")
    setSearchQuery("")
  }

  const toggleReplySelection = useCallback((replyId: string) => {
    setSelectedReplies((prev) =>
      prev.includes(replyId) ? prev.filter((id) => id !== replyId) : [...prev, replyId],
    )
  }, [])

  const toggleAllReplies = useCallback((replyIds: string[]) => {
    setSelectedReplies((prev) => (prev.length === replyIds.length ? [] : replyIds))
  }, [])

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <EmailReplyFilters
        selectedReadStatus={selectedReadStatus}
        selectedSentiments={selectedSentiments}
        selectedEmailAccountId={selectedEmailAccountId}
        workspaceId={selectedWorkspace?.id}
        onReadStatusChange={setSelectedReadStatus}
        onSentimentsChange={setSelectedSentiments}
        onEmailAccountChange={setSelectedEmailAccountId}
        onClearFilters={clearFilters}
      />

      {/* Replies Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">이메일 답장 관리</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search input */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="제목, 발신자 이메일로 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-10 pr-10 w-full"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("")
                    setSearchQuery("")
                  }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedReplies.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{selectedReplies.length}개 선택됨</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleBulkMarkAsRead}>
                  <MailCheck className="h-4 w-4 mr-1" />
                  읽음 표시
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkMarkAsUnread}>
                  <Mail className="h-4 w-4 mr-1" />
                  읽지 않음 표시
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  선택 삭제
                </Button>
              </div>
            </div>
          )}

          {/* Replies Table with Pagination */}
          <RepliesTableWithPagination
            searchQuery={searchQuery}
            workspaceId={selectedWorkspace?.id}
            selectedReadStatus={selectedReadStatus}
            selectedSentiments={selectedSentiments}
            selectedEmailAccountId={selectedEmailAccountId}
            selectedReplies={selectedReplies}
            onToggleReply={toggleReplySelection}
            onToggleAll={toggleAllReplies}
            onViewReply={setViewingReply}
          />
        </CardContent>
      </Card>

      {/* Reply Details Dialog */}
      <Dialog open={!!viewingReply} onOpenChange={() => setViewingReply(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              답장 상세 보기
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {viewingReply && (
              <EmailReplyDetailsDialog reply={viewingReply} onClose={() => setViewingReply(null)} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
