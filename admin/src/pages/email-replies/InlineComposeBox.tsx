import { Loader2, Maximize2, Minimize2, Send, X } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { RecipientInput } from "@/components/RecipientInput"
import { SimpleTextEditor } from "@/components/SimpleTextEditor"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useSendEmail } from "@/lib/api/hooks/emails"
import type { ThreadEmail } from "@/lib/api/types/email"
import { useAuth } from "@/lib/auth-provider"
import {
  generateQuotedText,
  generateReplySubject,
  getReplyRecipient,
  parseEmailList,
} from "@/lib/email-utils"

interface InlineComposeBoxProps {
  originalEmail: ThreadEmail
  workspaceId: string
  expanded: boolean
  fullscreen: boolean
  onExpand: () => void
  onFullscreen: () => void
  onClose: () => void
  onSent?: () => void
}

export function InlineComposeBox({
  originalEmail,
  workspaceId,
  expanded,
  fullscreen,
  onExpand,
  onFullscreen,
  onClose,
  onSent,
}: InlineComposeBoxProps) {
  const { user } = useAuth()
  const sendEmail = useSendEmail()

  // 답장 초기값 설정
  const [to, setTo] = useState(() => getReplyRecipient(originalEmail))
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [subject, setSubject] = useState(() => generateReplySubject(originalEmail.subject))
  const [body, setBody] = useState(() => generateQuotedText(originalEmail))

  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)

  const handleSend = async () => {
    if (!user) {
      toast.error("로그인이 필요합니다")
      return
    }

    if (!workspaceId || workspaceId === "") {
      toast.error("워크스페이스가 선택되지 않았습니다")
      console.error("❌ workspaceId is empty:", { workspaceId, user: user.id })
      return
    }

    // 이메일 주소 검증
    const recipients = parseEmailList(to)
    if (recipients.length === 0) {
      toast.error("유효한 받는사람 이메일 주소를 입력하세요")
      return
    }

    if (!subject.trim()) {
      toast.error("제목을 입력하세요")
      return
    }

    const payload = {
      workspaceId,
      userId: user.id,
      toEmail: recipients[0], // 첫 번째 수신자
      ccEmails: cc ? parseEmailList(cc) : undefined,
      bccEmails: bcc ? parseEmailList(bcc) : undefined,
      subject: subject.trim(),
      bodyText: body,
      // 스레드 정보 포함
      inReplyTo: originalEmail.messageId ?? undefined,
      references: originalEmail.messageId ? [originalEmail.messageId] : undefined,
      // 서명 포함 (기본값: true)
      includeSignature: true,
    }

    console.log("📧 Sending email with payload:", {
      ...payload,
      workspaceId: workspaceId || "EMPTY",
      userId: user.id || "EMPTY",
      hasMessageId: !!originalEmail.messageId,
    })

    try {
      await sendEmail.mutateAsync(payload)

      // 성공 시 초기화 및 닫기
      onSent?.()
      onClose()
    } catch (error) {
      // useSendEmail에서 이미 toast.error 처리됨
      console.error("Failed to send email:", error)
    }
  }

  return (
    <Card
      className={`
        ${fullscreen ? "fixed inset-0 z-50 rounded-none" : "mt-6"}
        ${expanded ? "min-h-[500px]" : "min-h-[300px]"}
        transition-all duration-200 border-2
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 dark:bg-gray-800">
        <div className="text-sm font-medium">답장</div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onExpand}
            className="h-8 w-8 p-0"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onFullscreen}
            className="h-8 w-8 p-0"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Recipients */}
      <div className="px-4 py-2 space-y-2 border-b">
        <RecipientInput
          label="받는사람"
          value={to}
          onChange={setTo}
          disabled={true}
          showCcBcc={!showCc || !showBcc}
          onShowCc={!showCc ? () => setShowCc(true) : undefined}
          onShowBcc={!showBcc ? () => setShowBcc(true) : undefined}
        />

        {showCc && <RecipientInput label="참조" value={cc} onChange={setCc} />}

        {showBcc && <RecipientInput label="숨은참조" value={bcc} onChange={setBcc} />}

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 w-16 flex-shrink-0">제목</span>
          <Input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="제목"
            className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 h-8"
          />
        </div>
      </div>

      {/* Body Editor */}
      <div className={`${expanded ? "min-h-[350px]" : "min-h-[200px]"}`}>
        <SimpleTextEditor value={body} onChange={setBody} placeholder="메시지를 입력하세요..." />
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t flex items-center justify-between bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Button onClick={handleSend} disabled={!to || !subject || sendEmail.isPending} size="sm">
            {sendEmail.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                전송 중...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                전송
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-gray-500">단축키: Cmd+Enter (전송) | Esc (닫기)</div>
      </div>
    </Card>
  )
}
