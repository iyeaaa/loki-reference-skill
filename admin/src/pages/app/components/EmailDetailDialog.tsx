import { format } from "date-fns"
import { Clock, Mail, MailOpen, MousePointerClick, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { Email } from "@/lib/api/types/email"

type EmailDetailDialogProps = {
  email: Email | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmailDetailDialog({ email, open, onOpenChange }: EmailDetailDialogProps) {
  const { t } = useTranslation()

  if (!email) {
    return null
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "opened":
        return "default"
      case "sent":
        return "secondary"
      case "clicked":
        return "default"
      case "replied":
        return "default"
      default:
        return "outline"
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t("app.dashboard.emailDetails", "이메일 상세 정보")}
          </DialogTitle>
          <DialogDescription>
            {email.subject || t("app.dashboard.noSubject", "(제목 없음)")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <div className="space-y-4 pr-4">
            {/* 기본 정보 */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{email.toEmail}</span>
                    <Badge className="text-xs" variant={getStatusBadgeVariant(email.status)}>
                      {t(`app.dashboard.${email.status}`, email.status)}
                    </Badge>
                  </div>
                  {email.leadName && (
                    <p className="text-muted-foreground text-sm">{email.leadName}</p>
                  )}
                  <p className="mt-1 text-muted-foreground text-xs">
                    {t("app.dashboard.from", "보낸 사람")}: {email.fromEmail}
                  </p>
                </div>
              </div>

              {/* CC/BCC */}
              {email.ccEmails && email.ccEmails.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium">CC: </span>
                  <span className="text-muted-foreground">{email.ccEmails.join(", ")}</span>
                </div>
              )}
              {email.bccEmails && email.bccEmails.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium">BCC: </span>
                  <span className="text-muted-foreground">{email.bccEmails.join(", ")}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* 통계 정보 */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-muted-foreground">{t("app.dashboard.sentAt", "발송 시간")}</p>
                  <p className="font-medium">
                    {email.sentAt
                      ? format(new Date(email.sentAt), "MMM d, HH:mm")
                      : t("app.dashboard.notSent", "미발송")}
                  </p>
                </div>
              </div>

              {email.openedAt && (
                <div className="flex items-center gap-2">
                  <MailOpen className="h-4 w-4 text-primary" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">
                      {t("app.dashboard.openedAt", "읽은 시간")}
                    </p>
                    <p className="font-medium">
                      {format(new Date(email.openedAt), "MMM d, HH:mm")}
                    </p>
                  </div>
                </div>
              )}

              {email.clickedAt && (
                <div className="flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4 text-blue-500" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">
                      {t("app.dashboard.clickedAt", "클릭 시간")}
                    </p>
                    <p className="font-medium">
                      {format(new Date(email.clickedAt), "MMM d, HH:mm")}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="text-sm">
                  <p className="text-muted-foreground">{t("app.dashboard.engagement", "참여도")}</p>
                  <p className="font-medium">
                    {t("app.dashboard.opens", "열람")}: {email.openCount} /{" "}
                    {t("app.dashboard.clicks", "클릭")}: {email.clickCount}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* 메일 본문 */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">
                {t("app.dashboard.emailContent", "메일 내용")}
              </h4>
              {email.bodyHtml ? (
                <div
                  className="prose prose-sm max-w-none rounded-lg border bg-muted/30 p-4"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: email content needs to be rendered as HTML
                  dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                />
              ) : email.bodyText ? (
                <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">
                  {email.bodyText}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  {t("app.dashboard.noContent", "내용이 없습니다")}
                </p>
              )}
            </div>

            {/* 첨부파일 */}
            {email.attachments && email.attachments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">
                    {t("app.dashboard.attachments", "첨부파일")} ({email.attachments.length})
                  </h4>
                  <div className="space-y-1">
                    {email.attachments.map((attachment, index) => (
                      <div
                        className="flex items-center gap-2 rounded border p-2 text-sm"
                        key={index}
                      >
                        <span className="font-medium">{attachment.filename}</span>
                        <span className="text-muted-foreground">
                          ({(attachment.size / 1024).toFixed(2)} KB)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 시퀀스 정보 */}
            {email.sequenceName && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">{t("app.dashboard.sequence", "시퀀스")}</h4>
                  <p className="text-muted-foreground text-sm">{email.sequenceName}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
