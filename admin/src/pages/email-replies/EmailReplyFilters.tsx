import { Filter, X } from "lucide-react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  const { data: emailAccounts } = useEmailAccountsByWorkspace(workspaceId || "", !!workspaceId)

  const sentimentOptions = [
    {
      value: "positive",
      label: t("email-replies.filters.sentiment.positive"),
      color: "bg-green-100 text-green-800",
    },
    {
      value: "neutral",
      label: t("email-replies.filters.sentiment.neutral"),
      color: "bg-gray-100 text-gray-800",
    },
    {
      value: "negative",
      label: t("email-replies.filters.sentiment.negative"),
      color: "bg-red-100 text-red-800",
    },
    {
      value: "interested",
      label: t("email-replies.filters.sentiment.interested"),
      color: "bg-blue-100 text-blue-800",
    },
    {
      value: "not_interested",
      label: t("email-replies.filters.sentiment.notInterested"),
      color: "bg-orange-100 text-orange-800",
    },
  ]

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
            <span className="font-medium text-sm">{t("email-replies.filters.label")}</span>
          </div>
          {hasActiveFilters && (
            <Button onClick={onClearFilters} size="sm" variant="ghost">
              <X className="mr-1 h-4 w-4" />
              {t("email-replies.filters.clearFilters")}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Read Status Filter */}
          <div>
            <div className="mb-2 font-medium text-sm">
              {t("email-replies.filters.readStatus.label")}
            </div>
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
                <SelectValue placeholder={t("email-replies.filters.readStatus.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("email-replies.filters.readStatus.all")}</SelectItem>
                <SelectItem value="unread">
                  {t("email-replies.filters.readStatus.unread")}
                </SelectItem>
                <SelectItem value="read">{t("email-replies.filters.readStatus.read")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Email Account Filter */}
          <div>
            <div className="mb-2 font-medium text-sm">
              {t("email-replies.filters.emailAccount.label")}
            </div>
            <Select
              onValueChange={(value) => {
                onEmailAccountChange(value === "all" ? undefined : value)
              }}
              value={selectedEmailAccountId || "all"}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("email-replies.filters.readStatus.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("email-replies.filters.readStatus.all")}</SelectItem>
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
            <div className="mb-2 font-medium text-sm">
              {t("email-replies.filters.sentiment.label")}
            </div>
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
