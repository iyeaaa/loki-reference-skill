import { useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Reply, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useThreadEmails } from "@/lib/api/hooks/emails"
import { EmailItem } from "./EmailItem"
import { InlineComposeBox } from "./InlineComposeBox"

interface ThreadDetailPanelProps {
  threadId: string
  workspaceId?: string
  onClose: () => void
}

export function ThreadDetailPanel({ threadId, workspaceId, onClose }: ThreadDetailPanelProps) {
  const { data, isLoading, error } = useThreadEmails(threadId, workspaceId)
  const emails = data?.data || []
  const queryClient = useQueryClient()

  // 답장 상태
  const [showReply, setShowReply] = useState(false)
  const [composeExpanded, setComposeExpanded] = useState(false)
  const [composeFullscreen, setComposeFullscreen] = useState(false)

  // 각 이메일의 펼침/접힘 상태 (기본값: 모두 펼침)
  const [expandedEmails, setExpandedEmails] = useState<Record<string, boolean>>({})

  // 중간 메일들을 숨길지 여부
  const [showMiddleEmails, setShowMiddleEmails] = useState(false)

  // threadId가 변경되면 상태 초기화
  // biome-ignore lint/correctness/useExhaustiveDependencies: threadId 변경 시에만 초기화 필요
  useEffect(() => {
    setExpandedEmails({})
    setShowMiddleEmails(false)
    setShowReply(false)
    setComposeExpanded(false)
    setComposeFullscreen(false)
  }, [threadId])

  // 이메일이 펼쳐져 있는지 확인 (기본값: 마지막 이메일만 펼침)
  const isExpanded = (emailId: string) => {
    if (expandedEmails[emailId] !== undefined) {
      return expandedEmails[emailId]
    }
    // 기본값: 마지막 이메일만 펼침
    return emails[emails.length - 1]?.id === emailId
  }

  // 이메일 토글 (현재 isExpanded 상태를 기반으로 토글)
  const toggleEmail = (emailId: string) => {
    const currentState = isExpanded(emailId)
    setExpandedEmails((prev) => ({
      ...prev,
      [emailId]: !currentState,
    }))
  }

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
          <div className="pb-4">
            {emails.length >= 4 ? (
              <>
                {/* 첫 번째 메일 */}
                <EmailItem
                  key={emails[0].id}
                  email={emails[0]}
                  isExpanded={isExpanded(emails[0].id)}
                  onToggle={() => toggleEmail(emails[0].id)}
                />

                {/* 중간 메일 압축/해제 버튼 */}
                {!showMiddleEmails ? (
                  <div className="relative flex items-center justify-center py-3">
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-gray-300 dark:border-gray-600" />
                    <button
                      type="button"
                      onClick={() => setShowMiddleEmails(true)}
                      className="relative bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
                    >
                      <ChevronDown className="h-4 w-4" />
                      <span>{emails.length - 2}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* 중간 메일들 */}
                    {emails.slice(1, -1).map((email) => (
                      <EmailItem
                        key={email.id}
                        email={email}
                        isExpanded={isExpanded(email.id)}
                        onToggle={() => toggleEmail(email.id)}
                      />
                    ))}
                  </>
                )}

                {/* 마지막 메일 */}
                <EmailItem
                  key={emails[emails.length - 1].id}
                  email={emails[emails.length - 1]}
                  isExpanded={isExpanded(emails[emails.length - 1].id)}
                  onToggle={() => toggleEmail(emails[emails.length - 1].id)}
                />
              </>
            ) : (
              emails.map((email) => (
                <EmailItem
                  key={email.id}
                  email={email}
                  isExpanded={isExpanded(email.id)}
                  onToggle={() => toggleEmail(email.id)}
                />
              ))
            )}

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
