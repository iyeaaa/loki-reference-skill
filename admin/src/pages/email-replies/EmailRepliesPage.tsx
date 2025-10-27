import { AlertCircle, Check, Search, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
import { useParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  useBulkDeleteEmailReplies,
  useBulkMarkAsRead,
  useBulkMarkAsUnread,
} from "@/lib/api/hooks/email-replies"
import { useEmail } from "@/lib/api/hooks/emails"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { ConfirmDialog } from "./ConfirmDialog"
import { EmailRepliesBulkActionModal } from "./EmailRepliesBulkActionModal"
import { RepliedEmailsTableWithPagination } from "./RepliedEmailsTableWithPagination"
import { ThreadDetailPanel } from "./ThreadDetailPanel"

export default function EmailRepliesPage() {
  const { selectedWorkspace } = useWorkspace()
  const { emailId } = useParams<{ emailId?: string }>()
  const containerId = useId()

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [leftWidth, setLeftWidth] = useState(50) // percentage
  const [isResizing, setIsResizing] = useState(false)
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<"read_status" | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // emailId가 있으면 해당 이메일 정보를 가져와서 threadId 설정
  const { data: emailData } = useEmail(emailId || "", !!emailId)

  // Bulk action hooks
  const bulkMarkAsRead = useBulkMarkAsRead()
  const bulkMarkAsUnread = useBulkMarkAsUnread()
  const bulkDeleteEmails = useBulkDeleteEmailReplies()

  // emailData가 로드되면 threadId 설정
  useEffect(() => {
    if (emailData?.threadId) {
      setSelectedThreadId(emailData.threadId)
    }
  }, [emailData])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearchQuery(searchInput)
    }
  }

  // Email selection handlers
  const toggleEmailSelection = useCallback((emailId: string) => {
    setSelectedEmails((prev) =>
      prev.includes(emailId) ? prev.filter((id) => id !== emailId) : [...prev, emailId],
    )
  }, [])

  const toggleAllEmails = useCallback((emailIds: string[]) => {
    setSelectedEmails((prev) => (prev.length === emailIds.length ? [] : emailIds))
  }, [])

  // Bulk action handlers
  const handleBulkAction = async (actionType: string, value: string) => {
    if (selectedEmails.length === 0) {
      toast.error("선택된 이메일이 없습니다.")
      return
    }

    if (actionType === "read_status") {
      if (value === "read") {
        bulkMarkAsRead.mutate(selectedEmails, {
          onSuccess: () => {
            setSelectedEmails([])
          },
        })
      } else if (value === "unread") {
        bulkMarkAsUnread.mutate(selectedEmails, {
          onSuccess: () => {
            setSelectedEmails([])
          },
        })
      }
    }
  }

  const handleBulkDelete = () => {
    if (selectedEmails.length === 0) return
    setShowConfirmDialog(true)
  }

  const confirmBulkDelete = () => {
    bulkDeleteEmails.mutate(selectedEmails, {
      onSuccess: () => {
        setSelectedEmails([])
      },
    })
  }

  const openBulkActionModal = (type: "read_status") => {
    if (selectedEmails.length === 0) {
      toast.error("선택된 이메일이 없습니다.")
      return
    }
    setBulkActionType(type)
    setShowBulkActionModal(true)
  }

  // Resizer handlers
  const handleMouseDown = () => {
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const container = document.getElementById(containerId)
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

      // Limit between 30% and 70%
      if (newLeftWidth >= 30 && newLeftWidth <= 70) {
        setLeftWidth(newLeftWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, containerId])

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      {/* Workspace 선택 안내 */}
      {!selectedWorkspace && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>워크스페이스를 선택해주세요</AlertTitle>
          <AlertDescription>
            답장 이메일을 조회하려면 사이드바에서 워크스페이스를 선택해주세요.
          </AlertDescription>
        </Alert>
      )}

      {/* Gmail-style Split View */}
      <div id={containerId} className="flex-1 flex relative min-h-0">
        {/* Left: Thread List */}
        <div
          style={{ width: selectedThreadId ? `${leftWidth}%` : "100%" }}
          className="flex flex-col h-full"
        >
          <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader className="pb-3 pt-3 flex-shrink-0">
              <CardTitle className="text-base">
                답장 이메일 관리
                {selectedWorkspace && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({selectedWorkspace.name})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">
              {/* Search input */}
              <div className="mb-3 flex-shrink-0">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="제목, 발신자 이메일로 검색..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-10 pr-10 w-full h-9"
                    disabled={!selectedWorkspace}
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
              {selectedEmails.length > 0 && (
                <div className="flex items-center gap-4 mb-3 flex-shrink-0">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">{selectedEmails.length}개 선택됨</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBulkActionModal("read_status")}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      읽음 상태 변경
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

              {/* Thread List Table */}
              <div className="flex-1 overflow-auto">
                {selectedWorkspace ? (
                  <RepliedEmailsTableWithPagination
                    workspaceId={selectedWorkspace.id}
                    searchQuery={searchQuery}
                    selectedStatuses={[]}
                    selectedThreadId={selectedThreadId}
                    onThreadSelect={setSelectedThreadId}
                    selectedEmails={selectedEmails}
                    onToggleEmail={toggleEmailSelection}
                    onToggleAll={toggleAllEmails}
                  />
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    워크스페이스를 선택하면 답장 이메일 목록이 표시됩니다.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resizer - only show when thread is selected */}
        {selectedThreadId && (
          <button
            type="button"
            aria-label="Resize panels"
            className={`w-px bg-gray-300 hover:bg-blue-400 cursor-col-resize flex-shrink-0 h-full border-0 p-0 ${
              isResizing ? "bg-blue-400" : ""
            }`}
            onMouseDown={handleMouseDown}
          />
        )}

        {/* Right: Thread Detail Panel - only show when thread is selected */}
        {selectedThreadId && (
          <div style={{ width: `${100 - leftWidth}%` }} className="flex flex-col h-full">
            <ThreadDetailPanel
              threadId={selectedThreadId}
              workspaceId={selectedWorkspace?.id}
              onClose={() => setSelectedThreadId(null)}
            />
          </div>
        )}
      </div>

      {/* Bulk Action Modal */}
      <EmailRepliesBulkActionModal
        isOpen={showBulkActionModal}
        onClose={() => {
          setShowBulkActionModal(false)
          setBulkActionType(null)
        }}
        onConfirm={handleBulkAction}
        emailCount={selectedEmails.length}
        actionType={bulkActionType}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmBulkDelete}
        title="이메일 삭제 확인"
        description={`선택한 ${selectedEmails.length}개의 이메일을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
        variant="destructive"
      />
    </div>
  )
}
