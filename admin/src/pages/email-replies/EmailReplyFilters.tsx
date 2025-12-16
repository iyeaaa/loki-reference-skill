import { Filter, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEmailAccountsByWorkspace } from "@/lib/api/hooks/email-accounts"

type EmailReplyFiltersProps = {
  selectedReadStatus: boolean | undefined
  selectedSentiments: string[]
  selectedEmailAccountId: string | undefined
  workspaceId: string | undefined
  onReadStatusChange: (status: boolean | undefined) => void
  onSentimentsChange: (sentiments: string[]) => void
  onEmailAccountChange: (accountId: string | undefined) => void
  onClearFilters: () => void
}

const sentimentOptions = [
  { value: "positive", label: "긍정적", color: "bg-green-100 text-green-800" },
  { value: "neutral", label: "중립", color: "bg-gray-100 text-gray-800" },
  { value: "negative", label: "부정적", color: "bg-red-100 text-red-800" },
  { value: "interested", label: "관심있음", color: "bg-blue-100 text-blue-800" },
  { value: "not_interested", label: "관심없음", color: "bg-orange-100 text-orange-800" },
]

export function EmailReplyFilters({
  selectedReadStatus,
  selectedSentiments,
  selectedEmailAccountId,
  workspaceId,
  onReadStatusChange,
  onSentimentsChange,
  onEmailAccountChange,
  onClearFilters,
}: EmailReplyFiltersProps) {
  const { data: emailAccounts } = useEmailAccountsByWorkspace(workspaceId || "", !!workspaceId)

  const hasActiveFilters =
    selectedReadStatus !== undefined || selectedSentiments.length > 0 || !!selectedEmailAccountId

  const toggleSentiment = (sentiment: string) => {
    if (selectedSentiments.includes(sentiment)) {
      onSentimentsChange(selectedSentiments.filter((s) => s !== sentiment))
    } else {
      onSentimentsChange([...selectedSentiments, sentiment])
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">필터</span>
          </div>
          {hasActiveFilters && (
            <Button onClick={onClearFilters} size="sm" variant="ghost">
              <X className="mr-1 h-4 w-4" />
              필터 초기화
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Read Status Filter */}
          <div>
            <div className="mb-2 font-medium text-sm">읽음 상태</div>
            <Select
              onValueChange={(value) => {
                if (value === "all") {
                  onReadStatusChange(undefined)
                } else {
                  onReadStatusChange(value === "read")
                }
              }}
              value={
                selectedReadStatus === undefined ? "all" : selectedReadStatus ? "read" : "unread"
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="unread">읽지 않음</SelectItem>
                <SelectItem value="read">읽음</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Email Account Filter */}
          <div>
            <div className="mb-2 font-medium text-sm">이메일 계정</div>
            <Select
              onValueChange={(value) => {
                onEmailAccountChange(value === "all" ? undefined : value)
              }}
              value={selectedEmailAccountId || "all"}
            >
              <SelectTrigger>
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {emailAccounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.emailAddress}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sentiment Filter */}
          <div>
            <div className="mb-2 font-medium text-sm">감정 분석</div>
            <div className="flex flex-wrap gap-2">
              {sentimentOptions.map((option) => (
                <Badge
                  className={`cursor-pointer ${
                    selectedSentiments.includes(option.value) ? option.color : ""
                  }`}
                  key={option.value}
                  onClick={() => toggleSentiment(option.value)}
                  variant={selectedSentiments.includes(option.value) ? "default" : "outline"}
                >
                  {option.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
