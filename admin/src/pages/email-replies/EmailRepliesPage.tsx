import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  HelpCircle,
  Inbox,
  Mail,
  MailOpen,
  MessageSquare,
  Minus,
  Send,
  Sparkles,
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
import { Card, CardContent } from "@/components/ui/card"
import { EmailSidebar } from "@/components/ui/email-sidebar"
import { type FilterConfig, FilterPanel } from "@/components/ui/filter-panel"
import { useBulkDeleteEmailReplies, useIntentCounts } from "@/lib/api/hooks/email-replies"
import { useEmail } from "@/lib/api/hooks/emails"
import { emailRepliesApi } from "@/lib/api/services/email-replies"
import type { RepliedEmail } from "@/lib/api/types/email"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { ConfirmDialog } from "./ConfirmDialog"
import { InboxOnboardingGuide } from "./InboxOnboardingGuide"
import { OverallSummaryModal } from "./OverallSummaryModal"
import { RepliedEmailsList } from "./RepliedEmailsList"
import { ThreadDetailPanel } from "./ThreadDetailPanel"

// Type for the replied emails query cache data
type RepliedEmailsCache = {
  repliedEmails: RepliedEmail[]
  total?: number
}

// Type for intent counts query cache data
type IntentCountsCache = {
  unread?: number
  [key: string]: number | undefined
}

export default function EmailRepliesPage() {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()
  const { emailId } = useParams<{ emailId?: string }>()
  const containerId = useId()
  const queryClient = useQueryClient()

  const [selectedIntent, setSelectedIntent] = useState<string>("all")
  const [sidebarActiveItem, setSidebarActiveItem] = useState<string>("all_mail")
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [direction, setDirection] = useState<"inbound" | "outbound" | "all">("all")
  const [leftWidth, setLeftWidth] = useState(50) // percentage
  const [isResizing, setIsResizing] = useState(false)
  const [selectedThreads, setSelectedThreads] = useState<string[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showOverallSummary, setShowOverallSummary] = useState(false)

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

  // Email sidebar sections with counts (3-section structure with i18n)
  const emailSidebarSections = [
    {
      title: t("email-replies.sidebar.sections.mailbox"),
      items: [
        {
          id: "all_mail",
          label: t("email-replies.sidebar.mailbox.allMail"),
          icon: <Mail className="h-4 w-4" />,
          count: intentCounts?.all_mail,
        },
        {
          id: "inbox",
          label: t("email-replies.sidebar.mailbox.inbox"),
          icon: <Inbox className="h-4 w-4" />,
          count: intentCounts?.inbox,
        },
        {
          id: "sent",
          label: t("email-replies.sidebar.mailbox.sent"),
          icon: <Send className="h-4 w-4" />,
          count: intentCounts?.sent,
        },
      ],
    },
    {
      title: t("email-replies.sidebar.sections.important"),
      items: [
        {
          id: "all",
          label: t("email-replies.sidebar.important.all"),
          icon: <Mail className="h-4 w-4" />,
          count: intentCounts?.all || 0,
        },
        {
          id: "important",
          label: t("email-replies.sidebar.important.important"),
          icon: <Star className="h-4 w-4" />,
          count: intentCounts?.important || 0,
        },
        {
          id: "unread",
          label: t("email-replies.sidebar.important.unread"),
          icon: <MailOpen className="h-4 w-4" />,
          count: intentCounts?.unread || 0,
        },
      ],
    },
    {
      title: t("email-replies.sidebar.sections.aiCategories"),
      items: [
        {
          id: "positive_interest",
          label: t("email-replies.sidebar.aiCategories.positive"),
          icon: <ThumbsUp className="h-4 w-4" />,
          count: intentCounts?.positive_interest || 0,
        },
        {
          id: "not_interested",
          label: t("email-replies.sidebar.aiCategories.negative"),
          icon: <ThumbsDown className="h-4 w-4" />,
          count: intentCounts?.not_interested || 0,
        },
        {
          id: "out_of_office",
          label: t("email-replies.sidebar.aiCategories.autoMessages"),
          icon: <MessageSquare className="h-4 w-4" />,
          count: intentCounts?.out_of_office || 0,
        },
        {
          id: "neutral",
          label: t("email-replies.sidebar.aiCategories.other"),
          icon: <Minus className="h-4 w-4" />,
          count: intentCounts?.neutral || 0,
        },
        {
          id: "unclassified",
          label: t("email-replies.sidebar.aiCategories.unclassified"),
          icon: <HelpCircle className="h-4 w-4" />,
          count: intentCounts?.unclassified || 0,
        },
      ],
    },
  ]

  // Handle sidebar item click
  const handleSidebarItemClick = (itemId: string) => {
    setSidebarActiveItem(itemId)

    // Handle mailbox direction filters
    if (itemId === "inbox") {
      setDirection("inbound")
      setSelectedIntent("all")
      queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
      return
    }
    if (itemId === "sent") {
      setDirection("outbound")
      setSelectedIntent("all")
      queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
      return
    }
    if (itemId === "all_mail") {
      setDirection("all")
      setSelectedIntent("all")
      queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
      return
    }

    // Map sidebar items to intent filters (OVERVIEW and LABELS sections)
    // These sections show inbound email statistics, so direction should be "inbound"
    if (itemId === "all" || itemId === "unread" || itemId === "important") {
      setSelectedIntent("all")
      setDirection("inbound") // OVERVIEW section - inbound only
      queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
    } else {
      // LABELS section (positive_interest, not_interested, etc.)
      setSelectedIntent(itemId)
      setDirection("inbound") // LABELS section - inbound only
      queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
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
      queryClient.setQueriesData({ queryKey: ["replied-emails"] }, (old: unknown) => {
        const cached = old as RepliedEmailsCache | undefined
        if (!cached?.repliedEmails) {
          return old
        }

        const targetEmail = cached.repliedEmails.find(
          (email) => email.threadId === selectedThreadId,
        )
        wasUnread = !!(targetEmail && !targetEmail.isRead)

        return {
          ...cached,
          repliedEmails: cached.repliedEmails.map((email) =>
            email.threadId === selectedThreadId ? { ...email, isRead: true } : email,
          ),
        }
      })

      // Optimistically update unread count
      if (wasUnread) {
        queryClient.setQueryData(
          ["intent-counts", selectedWorkspace?.id || "all"],
          (old: unknown) => {
            const cached = old as IntentCountsCache | undefined
            if (!cached) {
              return old
            }
            return {
              ...cached,
              unread: Math.max(0, (cached.unread || 0) - 1),
            }
          },
        )
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
    if (selectedThreads.length === 0) {
      return
    }
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
      if (!isResizing) {
        return
      }

      const container = document.getElementById(containerId)
      if (!container) {
        return
      }

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
    <div className="flex h-full gap-0">
      {/* Email Sidebar */}
      <EmailSidebar
        activeItemId={sidebarActiveItem}
        onItemClick={handleSidebarItemClick}
        sections={emailSidebarSections}
      />

      {/* Main Content Area */}
      <div
        className="flex flex-1 flex-col overflow-hidden p-4 pl-2"
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
        <div className="relative flex min-h-0 flex-1" id={containerId}>
          {/* Left: Thread List */}
          <div
            className="flex h-full flex-col"
            style={{ width: selectedThreadId ? `${leftWidth}%` : "100%" }}
          >
            <Card className="flex h-full flex-col overflow-hidden">
              <CardContent className="flex flex-1 flex-col overflow-hidden pt-4">
                {/* Filter Panel */}
                <div className="mb-3 flex flex-shrink-0 items-center gap-2">
                  <div className="flex-1">
                    <FilterPanel
                      onFilterChange={setFilters}
                      placeholder={t("email-replies.search.placeholder")}
                    />
                  </div>
                  <Button
                    className="shrink-0"
                    onClick={() => setShowOverallSummary(true)}
                    size="sm"
                    variant="outline"
                  >
                    <Sparkles className="mr-1 h-4 w-4 text-blue-500" />
                    {t("email-replies.overallSummary.button.open")}
                  </Button>
                </div>

                {/* Bulk Actions */}
                {selectedThreads.length > 0 && (
                  <div className="mb-3 flex flex-shrink-0 items-center gap-4">
                    <div className="text-muted-foreground text-sm">
                      <span className="font-medium">
                        {t("email-replies.bulk.selected", { count: selectedThreads.length })}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={handleBulkDelete}
                        size="sm"
                        variant="outline"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        {t("email-replies.bulk.delete")}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Thread List */}
                <div className="flex-1 overflow-auto">
                  {selectedWorkspace ? (
                    <RepliedEmailsList
                      dateFrom={filters.dateFrom}
                      dateTo={filters.dateTo}
                      direction={direction}
                      filterCategory={filters.category}
                      filterImportant={sidebarActiveItem === "important" ? true : undefined}
                      filterPriority={filters.priority}
                      filterSentiment={filters.sentiment}
                      filterUnread={sidebarActiveItem === "unread" ? true : undefined}
                      onThreadSelect={setSelectedThreadId}
                      onToggleAll={toggleAllThreads}
                      onToggleThread={toggleThreadSelection}
                      searchQuery={filters.search}
                      selectedIntent={selectedIntent}
                      selectedStatuses={[]}
                      selectedThreadId={selectedThreadId}
                      selectedThreads={selectedThreads}
                      workspaceId={selectedWorkspace.id}
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
              aria-label="Resize panels"
              className={`h-full w-px flex-shrink-0 cursor-col-resize border-0 bg-gray-300 p-0 hover:bg-blue-400 ${
                isResizing ? "bg-blue-400" : ""
              }`}
              onMouseDown={handleMouseDown}
              type="button"
            />
          )}

          {/* Right: Thread Detail Panel - only show when thread is selected */}
          {selectedThreadId && (
            <div className="flex h-full flex-col" style={{ width: `${100 - leftWidth}%` }}>
              <ThreadDetailPanel
                onClose={() => setSelectedThreadId(null)}
                threadId={selectedThreadId}
                workspaceId={selectedWorkspace?.id}
              />
            </div>
          )}
        </div>

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          cancelText={t("email-replies.confirm.cancel.button")}
          confirmText={t("email-replies.confirm.delete.button")}
          description={t("email-replies.confirm.delete.description", {
            count: selectedThreads.length,
          })}
          isOpen={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={confirmBulkDelete}
          title={t("email-replies.confirm.delete.title")}
          variant="destructive"
        />

        {/* Overall Summary Modal */}
        <OverallSummaryModal
          intent={selectedIntent}
          isOpen={showOverallSummary}
          onClose={() => setShowOverallSummary(false)}
          workspaceId={selectedWorkspace?.id}
        />

        {/* Inbox Onboarding Guide for Trial Users */}
        <InboxOnboardingGuide />
      </div>
    </div>
  )
}
