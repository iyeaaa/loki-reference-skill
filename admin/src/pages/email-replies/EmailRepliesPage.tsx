import { AlertCircle, Trash2 } from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type FilterConfig, FilterPanel } from "@/components/ui/filter-panel"
import { useBulkDeleteEmailReplies, useIntentCounts } from "@/lib/api/hooks/email-replies"
import { useEmail } from "@/lib/api/hooks/emails"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { ConfirmDialog } from "./ConfirmDialog"
import { RepliedEmailsList } from "./RepliedEmailsList"
import { StatsCards } from "./StatsCards"
import { ThreadDetailPanel } from "./ThreadDetailPanel"

export default function EmailRepliesPage() {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()
  const { emailId } = useParams<{ emailId?: string }>()
  const containerId = useId()

  const [selectedIntent, setSelectedIntent] = useState<string>("all")
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [leftWidth, setLeftWidth] = useState(50) // percentage
  const [isResizing, setIsResizing] = useState(false)
  const [selectedThreads, setSelectedThreads] = useState<string[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Filter state from FilterPanel
  const [filters, setFilters] = useState<FilterConfig>({
    search: "",
    sentiment: [],
    category: [],
    priority: [],
    dateFrom: "",
    dateTo: "",
  })

  // Fetch real category counts from API
  const { data: intentCounts } = useIntentCounts(selectedWorkspace?.id || "all")

  // Transform API data to category format
  const categories = [
    { id: "all", label: "All", count: intentCounts?.all || 0 },
    { id: "out_of_office", label: "Auto Messages", count: intentCounts?.out_of_office || 0 },
    {
      id: "positive_interest",
      label: "Positive",
      count: intentCounts?.positive_interest || 0,
    },
    {
      id: "not_interested",
      label: "Negative",
      count: intentCounts?.not_interested || 0,
    },
    { id: "neutral", label: "Other", count: intentCounts?.neutral || 0 },
    {
      id: "unclassified",
      label: "Unclassified",
      count: intentCounts?.unclassified || 0,
    },
  ]

  // emailId가 있으면 해당 이메일 정보를 가져와서 threadId 설정
  const { data: emailData } = useEmail(emailId || "", !!emailId)

  // Bulk action hooks
  const bulkDeleteEmails = useBulkDeleteEmailReplies()

  // emailData가 로드되면 threadId 설정
  useEffect(() => {
    if (emailData?.threadId) {
      setSelectedThreadId(emailData.threadId)
    }
  }, [emailData])

  // Thread selection handlers
  const toggleThreadSelection = useCallback((threadId: string) => {
    setSelectedThreads((prev) =>
      prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId],
    )
  }, [])

  const toggleAllThreads = useCallback((threadIds: string[]) => {
    setSelectedThreads((prev) => (prev.length === threadIds.length ? [] : threadIds))
  }, [])

  // Bulk action handlers
  const handleBulkDelete = () => {
    if (selectedThreads.length === 0) return
    setShowConfirmDialog(true)
  }

  const confirmBulkDelete = () => {
    bulkDeleteEmails.mutate(selectedThreads, {
      onSuccess: () => {
        setSelectedThreads([])
      },
    })
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
    <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 120px)" }}>
      {/* Workspace 선택 안내 */}
      {!selectedWorkspace && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("email-replies.alert.selectWorkspace.title")}</AlertTitle>
          <AlertDescription>
            {t("email-replies.alert.selectWorkspace.description")}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards at the top */}
      {selectedWorkspace && (
        <div className="flex-shrink-0">
          <StatsCards
            categories={categories}
            selectedCategory={selectedIntent}
            onSelectCategory={setSelectedIntent}
          />
        </div>
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
                {t("email-replies.title")}
                {selectedWorkspace && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({selectedWorkspace.name})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">
              {/* Filter Panel */}
              <div className="mb-3 flex-shrink-0">
                <FilterPanel
                  placeholder={t("email-replies.search.placeholder")}
                  onFilterChange={setFilters}
                />
              </div>

              {/* Bulk Actions */}
              {selectedThreads.length > 0 && (
                <div className="flex items-center gap-4 mb-3 flex-shrink-0">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">
                      {t("email-replies.bulk.selected", { count: selectedThreads.length })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t("email-replies.bulk.delete")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Thread List */}
              <div className="flex-1 overflow-auto">
                {selectedWorkspace ? (
                  <RepliedEmailsList
                    workspaceId={selectedWorkspace.id}
                    searchQuery={filters.search}
                    selectedStatuses={[]}
                    selectedIntent={selectedIntent}
                    selectedThreadId={selectedThreadId}
                    onThreadSelect={setSelectedThreadId}
                    selectedThreads={selectedThreads}
                    onToggleThread={toggleThreadSelection}
                    onToggleAll={toggleAllThreads}
                    filterSentiment={filters.sentiment}
                    filterCategory={filters.category}
                    filterPriority={filters.priority}
                    dateFrom={filters.dateFrom}
                    dateTo={filters.dateTo}
                  />
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    {t("email-replies.empty.selectWorkspace")}
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

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmBulkDelete}
        title={t("email-replies.confirm.delete.title")}
        description={t("email-replies.confirm.delete.description", {
          count: selectedThreads.length,
        })}
        confirmText={t("email-replies.confirm.delete.button")}
        cancelText={t("email-replies.confirm.cancel.button")}
        variant="destructive"
      />
    </div>
  )
}
