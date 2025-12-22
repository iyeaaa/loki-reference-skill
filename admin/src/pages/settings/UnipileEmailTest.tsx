import { Mail } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSendUnipileTestEmail } from "@/lib/api/hooks/emails"

export function UnipileEmailTest() {
  const { t } = useTranslation()
  const toEmailId = useId()
  const subjectId = useId()
  const contentId = useId()
  const accountIdId = useId()

  const sendUnipileTestEmail = useSendUnipileTestEmail()

  const [toEmail, setToEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [accountId, setAccountId] = useState("")

  const canSubmit =
    toEmail.trim().length > 0 &&
    subject.trim().length > 0 &&
    content.trim().length > 0 &&
    accountId.trim().length > 0 &&
    !sendUnipileTestEmail.isPending

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }

    await sendUnipileTestEmail.mutateAsync({
      toEmail: toEmail.trim(),
      subject: subject.trim(),
      content,
      accountId: accountId.trim(),
    })

    // One-off: clear accountId after sending
    setAccountId("")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle>{t("settings.unipileTest.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.unipileTest.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="max-w-2xl space-y-4" onSubmit={handleSend}>
          <div className="space-y-2">
            <Label htmlFor={toEmailId}>{t("settings.unipileTest.toEmail")}</Label>
            <Input
              autoComplete="email"
              id={toEmailId}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="recipient@example.com"
              required
              type="email"
              value={toEmail}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={subjectId}>{t("settings.unipileTest.subject")}</Label>
            <Input
              id={subjectId}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("settings.unipileTest.subjectPlaceholder")}
              required
              value={subject}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={contentId}>{t("settings.unipileTest.content")}</Label>
            <Textarea
              id={contentId}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("settings.unipileTest.contentPlaceholder")}
              required
              rows={8}
              value={content}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={accountIdId}>{t("settings.unipileTest.accountId")}</Label>
            <Input
              autoComplete="off"
              id={accountIdId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder={t("settings.unipileTest.accountIdPlaceholder")}
              required
              type="password"
              value={accountId}
            />
            <p className="text-muted-foreground text-xs">
              {t("settings.unipileTest.accountIdHint")}
            </p>
          </div>

          <Button className="w-full sm:w-auto" disabled={!canSubmit} type="submit">
            {sendUnipileTestEmail.isPending
              ? t("settings.unipileTest.sending")
              : t("settings.unipileTest.send")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
