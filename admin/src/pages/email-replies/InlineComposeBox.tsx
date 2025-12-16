import { Loader2, Maximize2, Minimize2, Send, X } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { FileAttachment } from "@/components/FileAttachment"
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

type InlineComposeBoxProps = {
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
  const [files, setFiles] = useState<File[]>([])

  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)

  const handleSend = async () => {
    if (!user) {
      toast.error("로그인이 필요합니다")
      return
    }

    const effectiveWorkspaceId = originalEmail.workspaceId || workspaceId

    if (!effectiveWorkspaceId || effectiveWorkspaceId === "" || effectiveWorkspaceId === "all") {
      toast.error("워크스페이스가 선택되지 않았습니다")
      console.error("❌ workspaceId is invalid:", {
        workspaceId,
        originalEmailWorkspaceId: originalEmail.workspaceId,
        user: user.id,
      })
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
      workspaceId: effectiveWorkspaceId,
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
      // 첨부 파일
      files: files.length > 0 ? files : undefined,
    }

    console.log("📧 Sending email with payload:", {
      ...payload,
      workspaceId: effectiveWorkspaceId,
      userId: user.id || "EMPTY",
      hasMessageId: !!originalEmail.messageId,
    })

    try {
      await sendEmail.mutateAsync(payload)

      // 성공 시 초기화 및 닫기
      setFiles([]) // 파일 초기화
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
        ${fullscreen ? "fixed inset-0 z-50 flex flex-col overflow-hidden rounded-none bg-white dark:bg-gray-900" : "mt-6"}
        ${expanded && !fullscreen ? "min-h-[500px]" : fullscreen ? "" : "min-h-[300px]"}transition-all border-2 duration-200`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2 dark:bg-gray-800">
        <div className="font-medium text-sm">답장</div>
        <div className="flex items-center gap-1">
          <Button
            className="h-8 w-8 p-0"
            onClick={onExpand}
            size="sm"
            type="button"
            variant="ghost"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            className="h-8 w-8 p-0"
            onClick={onFullscreen}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button className="h-8 w-8 p-0" onClick={onClose} size="sm" type="button" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Recipients */}
      <div className={`space-y-2 border-b px-4 py-2 ${fullscreen ? "flex-shrink-0" : ""}`}>
        <RecipientInput
          disabled={true}
          label="받는사람"
          onChange={setTo}
          onShowBcc={showBcc ? undefined : () => setShowBcc(true)}
          onShowCc={showCc ? undefined : () => setShowCc(true)}
          showCcBcc={!(showCc && showBcc)}
          value={to}
        />

        {showCc && <RecipientInput label="참조" onChange={setCc} value={cc} />}

        {showBcc && <RecipientInput label="숨은참조" onChange={setBcc} value={bcc} />}

        <div className="flex items-center gap-2">
          <span className="w-16 flex-shrink-0 text-gray-600 text-sm">제목</span>
          <Input
            className="h-8 flex-1 border-0 px-2 focus-visible:ring-0 focus-visible:ring-offset-0"
            onChange={(e) => setSubject(e.target.value)}
            placeholder="제목"
            type="text"
            value={subject}
          />
        </div>

        {/* 첨부 파일 */}
        <div className="flex items-start gap-2">
          <span className="w-16 flex-shrink-0 pt-1 text-gray-600 text-sm">첨부</span>
          <div className="flex-1">
            <FileAttachment files={files} maxSize={20 * 1024 * 1024} onFilesChange={setFiles} />
          </div>
        </div>
      </div>

      {/* Body Editor */}
      <div
        className={`${fullscreen ? "flex-1 overflow-auto" : expanded ? "min-h-[350px]" : "min-h-[200px]"}`}
      >
        <SimpleTextEditor onChange={setBody} placeholder="메시지를 입력하세요..." value={body} />
      </div>

      {/* Footer Actions */}
      <div
        className={`flex items-center justify-between border-t bg-gray-50 px-4 py-3 dark:bg-gray-800 ${fullscreen ? "flex-shrink-0" : ""}`}
      >
        <div className="flex items-center gap-2">
          <Button disabled={!(to && subject) || sendEmail.isPending} onClick={handleSend} size="sm">
            {sendEmail.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                전송 중...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                전송
              </>
            )}
          </Button>
        </div>

        <div className="text-gray-500 text-xs">단축키: Cmd+Enter (전송) | Esc (닫기)</div>
      </div>
    </Card>
  )
}
