import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  HelpCircle,
  Mail,
  MailOpen,
  MessageSquare,
  Minus,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmailSidebar } from "@/components/ui/email-sidebar"
import { type FilterConfig, FilterPanel } from "@/components/ui/filter-panel"
import { useBulkDeleteEmailReplies, useIntentCounts } from "@/lib/api/hooks/email-replies"
import { useEmail } from "@/lib/api/hooks/emails"
import { emailRepliesApi } from "@/lib/api/services/email-replies"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { ConfirmDialog } from "./ConfirmDialog"
import { RepliedEmailsList } from "./RepliedEmailsList"
import { ThreadDetailPanel } from "./ThreadDetailPanel"

export default function EmailRepliesPage() {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()
  const { emailId } = useParams<{ emailId?: string }>()
  const containerId = useId()
  const queryClient = useQueryClient()

  const [selectedIntent, setSelectedIntent] = useState<string>("all")
  const [sidebarActiveItem, setSidebarActiveItem] = useState<string>("all")
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

  // Email sidebar sections with counts
  const emailSidebarSections = [
    {
      title: "OVERVIEW",
      items: [
        {
          id: "all",
          label: "All",
          icon: <Mail className="h-4 w-4" />,
          count: intentCounts?.all || 0,
        },
        {
          id: "important",
          label: "Important",
          icon: <Star className="h-4 w-4" />,
          count: intentCounts?.important || 0,
        },
        {
          id: "unread",
          label: "Unread",
          icon: <MailOpen className="h-4 w-4" />,
          count: intentCounts?.unread || 0,
        },
      ],
    },
    {
      title: "LABELS",
      items: [
        {
          id: "positive_interest",
          label: "Positive",
          icon: <ThumbsUp className="h-4 w-4" />,
          count: intentCounts?.positive_interest || 0,
        },
        {
          id: "not_interested",
          label: "Negative",
          icon: <ThumbsDown className="h-4 w-4" />,
          count: intentCounts?.not_interested || 0,
        },
        {
          id: "out_of_office",
          label: "Auto Messages",
          icon: <MessageSquare className="h-4 w-4" />,
          count: intentCounts?.out_of_office || 0,
        },
        {
          id: "neutral",
          label: "Other",
          icon: <Minus className="h-4 w-4" />,
          count: intentCounts?.neutral || 0,
        },
        {
          id: "unclassified",
          label: "Unclassified",
          icon: <HelpCircle className="h-4 w-4" />,
          count: intentCounts?.unclassified || 0,
        },
      ],
    },
  ]

  // Handle sidebar item click
  const handleSidebarItemClick = (itemId: string) => {
    setSidebarActiveItem(itemId)
    // Map sidebar items to intent filters
    if (itemId === "all" || itemId === "unread" || itemId === "important") {
      setSelectedIntent("all")
      // Invalidate queries when switching to important/unread filters to get fresh data
      if (itemId === "important" || itemId === "unread") {
        queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
      }
    } else {
      setSelectedIntent(itemId)
    }
  }

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

  // Mark thread as read when selected (optimistic update)
  useEffect(() => {
    if (selectedThreadId) {
      // Check if the thread is currently unread
      let wasUnread = false
      // biome-ignore lint/suspicious/noExplicitAny: QueryClient cache data is untyped
      queryClient.setQueriesData({ queryKey: ["replied-emails"] }, (old: any) => {
        if (!old?.repliedEmails) return old

        // biome-ignore lint/suspicious/noExplicitAny: QueryClient cache data is untyped
        const targetEmail = old.repliedEmails.find(
          (email: any) => email.threadId === selectedThreadId,
        )
        wasUnread = targetEmail && !targetEmail.isRead

        return {
          ...old,
          // biome-ignore lint/suspicious/noExplicitAny: QueryClient cache data is untyped
          repliedEmails: old.repliedEmails.map((email: any) =>
            email.threadId === selectedThreadId ? { ...email, isRead: true } : email,
          ),
        }
      })

      // Optimistically update unread count
      if (wasUnread) {
        // biome-ignore lint/suspicious/noExplicitAny: QueryClient cache data is untyped
        queryClient.setQueryData(["intent-counts", selectedWorkspace?.id || "all"], (old: any) => {
          if (!old) return old
          return {
            ...old,
            unread: Math.max(0, (old.unread || 0) - 1),
          }
        })
      }

      // Make API call in background
      emailRepliesApi
        .markThreadAsRead(selectedThreadId)
        .then(() => {
          // Refetch counts to ensure accuracy
          queryClient.refetchQueries({ queryKey: ["intent-counts"] })
        })
        .catch((error) => {
          console.error("Failed to mark thread as read:", error)
          // Revert on error
          queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
          queryClient.invalidateQueries({ queryKey: ["intent-counts"] })
        })
    }
  }, [selectedThreadId, queryClient, selectedWorkspace?.id])

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
    <div className="flex gap-0 h-full">
      {/* Email Sidebar */}
      <EmailSidebar
        sections={emailSidebarSections}
        activeItemId={sidebarActiveItem}
        onItemClick={handleSidebarItemClick}
      />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col overflow-hidden p-4 pl-2"
        style={{ height: "calc(100vh - 120px)" }}
      >
        {/* Workspace 선택 안내 */}
        {!selectedWorkspace && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("email-replies.alert.selectWorkspace.title")}</AlertTitle>
            <AlertDescription>
              {t("email-replies.alert.selectWorkspace.description")}
            </AlertDescription>
          </Alert>
        )}

        {/* {selectedWorkspace && (
          <div className="flex-shrink-0">
            <StatsCards
              categories={categories}
              selectedCategory={selectedIntent}
              onSelectCategory={setSelectedIntent}
            />
          </div>
        )} */}

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
                      filterImportant={sidebarActiveItem === "important" ? true : undefined}
                      filterUnread={sidebarActiveItem === "unread" ? true : undefined}
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
    </div>
  )
}
