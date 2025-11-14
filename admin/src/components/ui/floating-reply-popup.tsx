import { Loader2, Maximize2, Minimize2, Send, X } from "lucide-react"
import { useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface FloatingReplyPopupProps {
  isOpen: boolean
  onClose: () => void
  onSend: (replyText: string) => void | Promise<void>
  to: string
  subject: string
  isSending?: boolean
}

export function FloatingReplyPopup({
  isOpen,
  onClose,
  onSend,
  to,
  subject,
  isSending = false,
}: FloatingReplyPopupProps) {
  const [replyText, setReplyText] = useState("")
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  const handleSendReply = async () => {
    if (!replyText.trim()) return

    try {
      await onSend(replyText)
      setReplyText("")
      onClose()
    } catch (error) {
      console.error("Failed to send reply:", error)
    }
  }

  const handleClose = () => {
    setReplyText("")
    setIsMinimized(false)
    setIsMaximized(false)
    onClose()
  }

  if (!isOpen) return null

  const popupContent = (
    <>
      {isMaximized && (
        <button
          type="button"
          className="fixed inset-0 bg-black/20 z-40 border-0 p-0 cursor-default"
          onClick={() => setIsMaximized(false)}
          onKeyDown={(e) => e.key === "Escape" && setIsMaximized(false)}
          aria-label="Close maximized view"
        />
      )}

      <Card
        className={`fixed z-50 shadow-2xl transition-all duration-200 bg-white dark:bg-gray-900 ${
          isMaximized
            ? "inset-4 md:inset-8 flex flex-col"
            : isMinimized
              ? "bottom-0 right-4 w-[600px]"
              : "bottom-0 right-4 w-[600px] h-[700px] flex flex-col"
        }`}
      >
        <button
          type="button"
          tabIndex={isMinimized ? 0 : -1}
          className="w-full flex items-center justify-between px-4 py-3 border-b bg-gray-50 dark:bg-gray-800 flex-shrink-0 cursor-pointer text-left"
          onClick={() => isMinimized && setIsMinimized(false)}
          onKeyDown={(e) => isMinimized && e.key === "Enter" && setIsMinimized(false)}
          aria-label={isMinimized ? "Expand reply window" : "Reply header"}
          disabled={!isMinimized}
        >
          <span className="text-sm font-medium truncate flex-1">답장</span>
          <span className="flex items-center gap-1">
            {!isMaximized && !isMinimized && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMinimized(!isMinimized)
                }}
                className="h-8 w-8 p-0"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
            {!isMinimized && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMaximized(!isMaximized)
                }}
                className="h-8 w-8 p-0"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleClose()
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </span>
        </button>

        {!isMinimized && (
          <>
            <div className="px-4 py-2 border-b bg-white dark:bg-gray-900 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 flex-shrink-0">
                  받는사람
                </span>
                <Input
                  type="text"
                  value={to}
                  disabled
                  className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 h-9 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 flex-shrink-0">
                  제목
                </span>
                <Input
                  type="text"
                  value={subject}
                  disabled
                  className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 h-9 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className={`p-4 flex-1 flex flex-col overflow-hidden`}>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="메시지를 입력하세요..."
                className={`resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 ${
                  isMaximized ? "flex-1 h-full" : "min-h-[450px]"
                }`}
                autoFocus
              />
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-between bg-gray-50 dark:bg-gray-800 flex-shrink-0">
              <Button
                onClick={handleSendReply}
                disabled={!replyText.trim() || isSending}
                size="default"
                className="font-medium"
              >
                {isSending ? (
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
          </>
        )}
      </Card>
    </>
  )

  return createPortal(popupContent, document.body)
}
