import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import { ChevronRight, Mail, Search, ThumbsDown, ThumbsUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  CampaignNotification,
  LeadDiscoveryNotification,
  ReplyNotification,
} from "@/lib/api/services/dashboard"

// Lead Discovery Notifications (Websets)
interface LeadDiscoveryNotificationsProps {
  notifications: LeadDiscoveryNotification[]
  isLoading?: boolean
}

export function LeadDiscoveryNotifications({
  notifications,
  isLoading = false,
}: LeadDiscoveryNotificationsProps) {
  const { t } = useTranslation()

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return t("dashboard.notifications.leadDiscovery.completed")
      case "pending":
        return t("dashboard.notifications.leadDiscovery.pending")
    }
    return status
  }

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Search className="h-4 w-4" />
            {t("dashboard.notifications.leadDiscovery.title")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("dashboard.notifications.leadDiscovery.description")}
          </CardDescription>
        </div>
        <Link
          to="/websets"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          {t("dashboard.notifications.leadDiscovery.viewMore")} <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {t("dashboard.notifications.leadDiscovery.noData")}
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={`/websets/${notification.id}`}
                  className="block p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-medium text-sm line-clamp-1">
                      {notification.title || notification.query}
                    </h4>
                    <Badge variant="secondary" className="text-xs ml-2">
                      {t("dashboard.notifications.leadDiscovery.status", {
                        status: notification.discoveredLeads,
                      })}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                    {notification.query}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </span>
                    <Badge
                      variant={notification.status === "completed" ? "default" : "outline"}
                      className="text-xs"
                    >
                      {getStatusLabel(notification.status)}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Campaign Notifications (Sequences)
interface CampaignNotificationsProps {
  notifications: CampaignNotification[]
  isLoading?: boolean
}

export function CampaignNotifications({
  notifications,
  isLoading = false,
}: CampaignNotificationsProps) {
  const { t } = useTranslation()
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "created":
        return t("dashboard.notifications.campaign.created")
      case "sent":
        return t("dashboard.notifications.campaign.sent")
      case "scheduled":
        return t("dashboard.notifications.campaign.scheduled")
      default:
        return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "created":
        return "secondary"
      case "sent":
        return "default"
      case "scheduled":
        return "outline"
      default:
        return "secondary"
    }
  }

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {t("dashboard.notifications.campaign.title")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("dashboard.notifications.campaign.description")}
          </CardDescription>
        </div>
        <Link
          to="/sequences"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          {t("dashboard.notifications.campaign.viewMore")} <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {t("dashboard.notifications.campaign.noData")}
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={`/sequences/edit?id=${notification.id}`}
                  className="block p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-medium text-sm line-clamp-1">{notification.name}</h4>
                    <Badge variant={getTypeColor(notification.type)} className="text-xs ml-2">
                      {getTypeLabel(notification.type)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
                    {notification.type === "sent" && (
                      <span>
                        {t("dashboard.notifications.campaign.sentCount", {
                          count: notification.sentCount,
                        })}
                      </span>
                    )}
                    {notification.type === "scheduled" && (
                      <span>
                        {t("dashboard.notifications.campaign.scheduledCount", {
                          count: notification.recipientCount,
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {notification.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Reply Notifications (Inbox)
interface ReplyNotificationsProps {
  notifications: ReplyNotification[]
  isLoading?: boolean
}

export function ReplyNotifications({ notifications, isLoading = false }: ReplyNotificationsProps) {
  const { t } = useTranslation()

  const getSentimentIcon = (sentiment: string | null) => {
    switch (sentiment) {
      case "positive":
      case "interested":
        return <ThumbsUp className="h-3 w-3 text-green-500" />
      case "negative":
      case "not_interested":
        return <ThumbsDown className="h-3 w-3 text-red-500" />
      default:
        return null
    }
  }

  const getSentimentLabel = (sentiment: string | null) => {
    switch (sentiment) {
      case "positive":
        return t("dashboard.notifications.reply.positive")
      case "negative":
        return t("dashboard.notifications.reply.negative")
      case "interested":
        return t("dashboard.notifications.reply.interested")
      case "not_interested":
        return t("dashboard.notifications.reply.notInterested")
      case "neutral":
        return t("dashboard.notifications.reply.neutral")
      default:
        return null
    }
  }

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {t("dashboard.notifications.reply.title")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("dashboard.notifications.reply.description")}
          </CardDescription>
        </div>
        <Link
          to="/replied-emails"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          {t("dashboard.notifications.reply.viewMore")} <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {t("dashboard.notifications.reply.noData")}
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={`/replied-emails/${notification.id}`}
                  className="block p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium text-sm truncate">{notification.fromEmail}</span>
                      {notification.leadName && (
                        <Badge variant="secondary" className="text-xs">
                          {notification.leadName}
                        </Badge>
                      )}
                    </div>
                    {notification.sentiment && (
                      <div className="flex items-center gap-1 ml-2">
                        {getSentimentIcon(notification.sentiment)}
                        <span className="text-xs text-muted-foreground">
                          {getSentimentLabel(notification.sentiment)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-medium mb-1 line-clamp-1">
                    {notification.subject || t("dashboard.notifications.reply.noSubject")}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                    {notification.bodyText?.slice(0, 100) ||
                      t("dashboard.notifications.reply.noContent")}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
