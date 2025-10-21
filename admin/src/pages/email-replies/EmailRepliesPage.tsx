import { AlertCircle, Search, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useEmail } from "@/lib/api/hooks/emails"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
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

  // emailId가 있으면 해당 이메일 정보를 가져와서 threadId 설정
  const { data: emailData } = useEmail(emailId || "", !!emailId)

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
        <div style={{ width: `${leftWidth}%` }} className="flex flex-col h-full">
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

              {/* Thread List Table */}
              <div className="flex-1 overflow-auto">
                {selectedWorkspace ? (
                  <RepliedEmailsTableWithPagination
                    workspaceId={selectedWorkspace.id}
                    searchQuery={searchQuery}
                    selectedStatuses={[]}
                    selectedThreadId={selectedThreadId}
                    onThreadSelect={setSelectedThreadId}
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

        {/* Resizer */}
        <button
          type="button"
          aria-label="Resize panels"
          className={`w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 h-full border-0 p-0 ${
            isResizing ? "bg-blue-400" : ""
          }`}
          onMouseDown={handleMouseDown}
        />

        {/* Right: Thread Detail Panel */}
        <div style={{ width: `${100 - leftWidth}%` }} className="flex flex-col h-full">
          {selectedThreadId ? (
            <ThreadDetailPanel
              threadId={selectedThreadId}
              workspaceId={selectedWorkspace?.id}
              onClose={() => setSelectedThreadId(null)}
            />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <div className="text-sm">선택한 대화가 없습니다.</div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
