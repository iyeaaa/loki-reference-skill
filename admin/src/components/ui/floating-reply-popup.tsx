import { Loader2, Maximize2, Minimize2, Send, X } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { FileAttachment } from "@/components/FileAttachment"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type FloatingReplyPopupProps = {
  isOpen: boolean
  onClose: () => void
  onSend: (replyText: string, subject: string, files?: File[]) => void | Promise<void>
  to: string
  subject: string
  isSending?: boolean
  initialText?: string
}

export function FloatingReplyPopup({
  isOpen,
  onClose,
  onSend,
  to,
  subject,
  isSending = false,
  initialText = "",
}: FloatingReplyPopupProps) {
  const [replyText, setReplyText] = useState("")
  const [editableSubject, setEditableSubject] = useState(subject)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    if (isOpen) {
      if (initialText) {
        setReplyText(initialText)
      }
      setEditableSubject(subject)
    } else {
      // Reset files when closing
      setFiles([])
    }
  }, [isOpen, initialText, subject])

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      return
    }

    try {
      await onSend(replyText, editableSubject, files.length > 0 ? files : undefined)
      setReplyText("")
      setEditableSubject(subject)
      setFiles([])
      onClose()
    } catch (error) {
      console.error("Failed to send reply:", error)
    }
  }

  const handleClose = () => {
    setReplyText("")
    setEditableSubject(subject)
    setFiles([])
    setIsMinimized(false)
    setIsMaximized(false)
    onClose()
  }

  if (!isOpen) {
    return null
  }

  const popupContent = (
    <>
      {isMaximized && (
        <button
          aria-label="Close maximized view"
          className="fixed inset-0 z-40 cursor-default border-0 bg-black/20 p-0"
          onClick={() => setIsMaximized(false)}
          onKeyDown={(e) => e.key === "Escape" && setIsMaximized(false)}
          type="button"
        />
      )}

      <Card
        className={`fixed z-50 bg-white shadow-2xl transition-all duration-200 dark:bg-gray-900 ${
          isMaximized
            ? "inset-4 flex flex-col md:inset-8"
            : isMinimized
              ? "right-4 bottom-0 w-[600px]"
              : "right-4 bottom-0 flex h-[700px] w-[600px] flex-col"
        }`}
      >
        <div className="flex w-full flex-shrink-0 items-center justify-between border-b bg-gray-50 px-4 py-3 dark:bg-gray-800">
          <button
            aria-label={isMinimized ? "Expand reply window" : "Reply header"}
            className="flex-1 cursor-pointer truncate text-left font-medium text-sm"
            disabled={!isMinimized}
            onClick={() => isMinimized && setIsMinimized(false)}
            onKeyDown={(e) => isMinimized && e.key === "Enter" && setIsMinimized(false)}
            tabIndex={isMinimized ? 0 : -1}
            type="button"
          >
            답장
          </button>
          <div className="flex items-center gap-1">
            {!(isMaximized || isMinimized) && (
              <Button
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMinimized(true)
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
            {!isMinimized && (
              <Button
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMaximized(!isMaximized)
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation()
                handleClose()
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="flex-shrink-0 border-b bg-white px-4 py-2 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <span className="w-20 flex-shrink-0 font-medium text-gray-700 text-sm dark:text-gray-300">
                  받는사람
                </span>
                <Input
                  className="h-9 flex-1 border-0 bg-gray-50 px-2 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-gray-800 dark:text-gray-100"
                  disabled
                  type="text"
                  value={to}
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="w-20 flex-shrink-0 font-medium text-gray-700 text-sm dark:text-gray-300">
                  제목
                </span>
                <Input
                  className="h-9 flex-1 border-0 bg-white px-2 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-gray-900 dark:text-gray-100"
                  onChange={(e) => setEditableSubject(e.target.value)}
                  type="text"
                  value={editableSubject}
                />
              </div>
              <div className="mt-2 flex items-start gap-2">
                <span className="w-20 flex-shrink-0 pt-1 font-medium text-gray-700 text-sm dark:text-gray-300">
                  첨부
                </span>
                <div className="flex-1">
                  <FileAttachment
                    files={files}
                    maxSize={20 * 1024 * 1024}
                    onFilesChange={setFiles}
                  />
                </div>
              </div>
            </div>

            <div className={"flex flex-1 flex-col overflow-hidden p-4"}>
              <Textarea
                autoFocus
                className={`resize-none border-0 text-base text-gray-900 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-gray-100 ${
                  isMaximized ? "h-full flex-1" : "min-h-[450px]"
                }`}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="메시지를 입력하세요..."
                value={replyText}
              />
            </div>

            <div className="flex flex-shrink-0 items-center justify-between border-t bg-gray-50 px-4 py-3 dark:bg-gray-800">
              <Button
                className="font-medium"
                disabled={!replyText.trim() || isSending}
                onClick={handleSendReply}
                size="default"
              >
                {isSending ? (
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
          </>
        )}
      </Card>
    </>
  )

  return createPortal(popupContent, document.body)
}
