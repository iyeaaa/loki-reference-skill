import { Mail } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSendNylasTestEmail } from "@/lib/api/hooks/emails"

export function NylasEmailTest() {
  const { t } = useTranslation()
  const toEmailId = useId()
  const subjectId = useId()
  const contentId = useId()
  const grantIdId = useId()

  const sendNylasTestEmail = useSendNylasTestEmail()

  const [toEmail, setToEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [grantId, setGrantId] = useState("")

  const canSubmit =
    toEmail.trim().length > 0 &&
    subject.trim().length > 0 &&
    content.trim().length > 0 &&
    grantId.trim().length > 0 &&
    !sendNylasTestEmail.isPending

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    await sendNylasTestEmail.mutateAsync({
      toEmail: toEmail.trim(),
      subject: subject.trim(),
      content,
      grantId: grantId.trim(),
    })

    // One-off: clear grantId after sending
    setGrantId("")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle>{t("settings.nylasTest.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.nylasTest.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor={toEmailId}>{t("settings.nylasTest.toEmail")}</Label>
            <Input
              id={toEmailId}
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="recipient@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={subjectId}>{t("settings.nylasTest.subject")}</Label>
            <Input
              id={subjectId}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("settings.nylasTest.subjectPlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={contentId}>{t("settings.nylasTest.content")}</Label>
            <Textarea
              id={contentId}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("settings.nylasTest.contentPlaceholder")}
              rows={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={grantIdId}>{t("settings.nylasTest.grantId")}</Label>
            <Input
              id={grantIdId}
              type="password"
              value={grantId}
              onChange={(e) => setGrantId(e.target.value)}
              placeholder={t("settings.nylasTest.grantIdPlaceholder")}
              autoComplete="off"
              required
            />
            <p className="text-xs text-muted-foreground">{t("settings.nylasTest.grantIdHint")}</p>
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
            {sendNylasTestEmail.isPending
              ? t("settings.nylasTest.sending")
              : t("settings.nylasTest.send")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
