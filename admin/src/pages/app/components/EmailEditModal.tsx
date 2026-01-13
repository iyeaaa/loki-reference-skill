import { Languages, Loader2, Sparkles, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { aiEmailApi } from "@/lib/api/services/ai-email"

type EmailStep = {
  id: string
  stepOrder: number
  delayDays: number
  scheduledHour?: number
  scheduledMinute?: number
  emailSubject: string
  emailBodyText?: string
  emailBodyHtml?: string
}

type EmailEditModalProps = {
  step: EmailStep | null
  isOpen: boolean
  onClose: () => void
  onSave: (subject: string, body: string) => Promise<void>
  isSaving: boolean
  isKorean: boolean
}

export function EmailEditModal({
  step,
  isOpen,
  onClose,
  onSave,
  isSaving,
  isKorean,
}: EmailEditModalProps) {
  const [editSubject, setEditSubject] = useState("")
  const [editBody, setEditBody] = useState("")

  // Translation state
  const [showTranslation, setShowTranslation] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedSubject, setTranslatedSubject] = useState("")
  const [translatedBody, setTranslatedBody] = useState("")
  const lastTranslatedRef = useRef<{ subject: string; body: string } | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialAutoTranslatedRef = useRef(false)

  // AI Editing state
  const [showAIEdit, setShowAIEdit] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editPrompt, setEditPrompt] = useState("")

  useEffect(() => {
    if (step) {
      setEditSubject(step.emailSubject || "")
      setEditBody(step.emailBodyText || "")
      // Reset states when step changes
      setShowTranslation(false)
      setTranslatedSubject("")
      setTranslatedBody("")
      lastTranslatedRef.current = null
      initialAutoTranslatedRef.current = false
      setShowAIEdit(false)
      setEditPrompt("")
    }
  }, [step])

  const handleSave = async () => {
    await onSave(editSubject, editBody)
  }

  const translateEmail = useCallback(
    async ({ showToast }: { showToast: boolean }) => {
      if (isTranslating) {
        return
      }
      if (!(editSubject && editBody)) {
        if (showToast) {
          toast.error(isKorean ? "제목과 본문을 입력해주세요" : "Please enter subject and body")
        }
        return
      }

      setShowTranslation(true)
      setIsTranslating(true)
      try {
        // Translate to current locale (Korean or English)
        const targetLanguage = isKorean ? "Korean" : "English"
        const result = await aiEmailApi.translateEmail({
          subject: editSubject,
          bodyText: editBody,
          targetLanguage,
        })

        setTranslatedSubject(result.subject)
        setTranslatedBody(result.bodyText)
        setShowTranslation(true)
        lastTranslatedRef.current = { subject: editSubject, body: editBody }
        if (showToast) {
          toast.success(isKorean ? "번역이 완료되었습니다" : "Translation completed")
        }
      } catch (error) {
        console.error("Translation failed:", error)
        if (showToast) {
          toast.error(isKorean ? "번역에 실패했습니다" : "Translation failed")
        }
      } finally {
        setIsTranslating(false)
      }
    },
    [editBody, editSubject, isKorean, isTranslating],
  )

  const handleTranslate = async () => {
    await translateEmail({ showToast: true })
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }
    if (initialAutoTranslatedRef.current) {
      return
    }
    if (!(editSubject && editBody)) {
      return
    }
    initialAutoTranslatedRef.current = true
    translateEmail({ showToast: false }).catch(() => {})
  }, [editBody, editSubject, isOpen, translateEmail])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    if (!(editSubject && editBody)) {
      return
    }
    if (
      lastTranslatedRef.current &&
      lastTranslatedRef.current.subject === editSubject &&
      lastTranslatedRef.current.body === editBody
    ) {
      return
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      if (
        lastTranslatedRef.current &&
        lastTranslatedRef.current.subject === editSubject &&
        lastTranslatedRef.current.body === editBody
      ) {
        return
      }
      translateEmail({ showToast: false }).catch(() => {})
    }, 2000)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [editBody, editSubject, isOpen, translateEmail])

  const handleAIEdit = async () => {
    if (!editPrompt.trim()) {
      toast.error(isKorean ? "편집 지시사항을 입력해주세요" : "Please enter edit instructions")
      return
    }

    if (!(editSubject && editBody)) {
      toast.error(isKorean ? "제목과 본문을 입력해주세요" : "Please enter subject and body")
      return
    }

    setIsEditing(true)
    try {
      const targetLanguage = isKorean ? "Korean" : "English"
      const result = await aiEmailApi.editEmail({
        subject: editSubject,
        bodyText: editBody,
        editPrompt: editPrompt.trim(),
        targetLanguage,
      })

      setEditSubject(result.subject)
      setEditBody(result.bodyText)
      setShowAIEdit(false)
      setEditPrompt("")
      toast.success(isKorean ? "이메일이 수정되었습니다" : "Email edited successfully")
    } catch (error) {
      console.error("AI Edit failed:", error)
      toast.error(isKorean ? "AI 편집에 실패했습니다" : "AI edit failed")
    } finally {
      setIsEditing(false)
    }
  }

  if (!step) {
    return null
  }

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isKorean ? `${step.stepOrder}번째 이메일 수정` : `Edit Email #${step.stepOrder}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              disabled={isTranslating || !editSubject || !editBody}
              onClick={handleTranslate}
              size="sm"
              variant="outline"
            >
              {isTranslating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Languages className="mr-2 h-4 w-4" />
              )}
              {isKorean ? "번역 보기" : "Translate"}
            </Button>
            <Button
              onClick={() => setShowAIEdit(!showAIEdit)}
              size="sm"
              variant={showAIEdit ? "default" : "outline"}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isKorean ? "AI 편집" : "AI Edit"}
            </Button>
          </div>

          {/* AI Edit Section */}
          {showAIEdit && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <Label className="flex items-center gap-2 text-blue-700">
                  <Sparkles className="h-4 w-4" />
                  {isKorean ? "AI 편집 지시사항" : "AI Edit Instructions"}
                </Label>
                <Button
                  className="h-6 w-6 p-0"
                  onClick={() => setShowAIEdit(false)}
                  size="sm"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                className="mb-3 min-h-[80px] border-blue-200 bg-white"
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder={
                  isKorean
                    ? "예: 더 친근하게 수정해줘, 문장을 짧게 만들어줘, 가치 제안을 강조해줘..."
                    : "e.g., Make it more friendly, Shorten the sentences, Emphasize the value proposition..."
                }
                value={editPrompt}
              />
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isEditing || !editPrompt.trim()}
                onClick={handleAIEdit}
                size="sm"
              >
                {isEditing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isKorean ? "AI로 수정하기" : "Edit with AI"}
              </Button>
            </div>
          )}

          {/* Main Content: Side by Side or Single View */}
          <div className={showTranslation ? "grid gap-4 lg:grid-cols-2" : ""}>
            {/* Original / Editable Content */}
            <div className="space-y-4">
              {showTranslation && (
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline">{isKorean ? "원본" : "Original"}</Badge>
                </div>
              )}
              <div className="space-y-2">
                <Label>{isKorean ? "제목" : "Subject"}</Label>
                <Input
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder={isKorean ? "이메일 제목..." : "Email subject..."}
                  value={editSubject}
                />
              </div>

              <div className="space-y-2">
                <Label>{isKorean ? "본문" : "Body"}</Label>
                <Textarea
                  className="min-h-[200px]"
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder={isKorean ? "이메일 본문..." : "Email body..."}
                  value={editBody}
                />
              </div>
            </div>

            {/* Translated Content */}
            {showTranslation && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center justify-between">
                  <Badge className="bg-blue-100 text-blue-700" variant="outline">
                    {isKorean ? "번역됨" : "Translated"}
                  </Badge>
                  <div className="flex gap-2">
                    <Button
                      className="h-8 w-8 p-0"
                      onClick={() => setShowTranslation(false)}
                      size="sm"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">{isKorean ? "제목" : "Subject"}</Label>
                  <div className="rounded-md border bg-gray-50 p-2 text-sm">
                    {translatedSubject ? translatedSubject : <Skeleton className="h-4 w-40" />}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-500">{isKorean ? "본문" : "Body"}</Label>
                  <div className="max-h-[200px] min-h-[200px] space-y-2 overflow-y-auto whitespace-pre-wrap rounded-md border bg-gray-50 p-2 text-sm">
                    {translatedBody ? (
                      translatedBody
                    ) : (
                      <>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-3/4" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Available Variables */}
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-2 font-medium text-gray-700 text-xs">
              {isKorean ? "사용 가능한 변수" : "Available variables"}
            </p>
            <div className="flex flex-wrap gap-2">
              {["{{company_name}}", "{{contact_name}}", "{{country}}"].map((v) => (
                <Badge className="cursor-pointer text-xs" key={v} variant="secondary">
                  {v}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            {isKorean ? "취소" : "Cancel"}
          </Button>
          <Button disabled={isSaving} onClick={handleSave}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isKorean ? "저장" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
