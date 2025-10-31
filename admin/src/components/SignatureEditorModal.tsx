import { useQueryClient } from "@tanstack/react-query"
import { Mail, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  emailSignatureKeys,
  useCreateEmailSignature,
  useDefaultEmailSignature,
  useUpdateEmailSignature,
} from "@/lib/api/hooks/email-signatures"

interface SignatureEditorModalProps {
  isOpen: boolean
  onClose: () => void
  defaultSignature: string
  onSave: (signature: string) => void
  workspaceId?: string
  userId?: string
}

export function SignatureEditorModal({
  isOpen,
  onClose,
  defaultSignature,
  onSave,
  workspaceId,
  userId,
}: SignatureEditorModalProps) {
  const [signatureName, setSignatureName] = useState("")
  const [signatureContent, setSignatureContent] = useState(defaultSignature)

  // DB에서 기본 서명 가져오기 (workspaceId와 userId가 있을 때만)
  const shouldFetchSignature = isOpen && !!workspaceId && !!userId

  const { data: existingSignature, refetch } = useDefaultEmailSignature(
    { workspaceId: workspaceId || "", userId: userId || "" },
    shouldFetchSignature,
  )

  const createSignature = useCreateEmailSignature()
  const updateSignature = useUpdateEmailSignature()
  const queryClient = useQueryClient()

  const nameId = useId()
  const contentId = useId()

  // 기존 서명이 있으면 내용 업데이트
  useEffect(() => {
    if (existingSignature) {
      setSignatureName(existingSignature.name)
      setSignatureContent(existingSignature.signatureHtml)
    } else {
      setSignatureContent(defaultSignature)
    }
  }, [existingSignature, defaultSignature])

  const handleSave = async () => {
    if (!workspaceId || !userId) {
      toast.error("사용자 정보가 없습니다. 다시 로그인해주세요.")
      return
    }

    try {
      const signatureText = signatureContent
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()

      if (existingSignature) {
        // 기존 서명 업데이트
        await updateSignature.mutateAsync({
          id: existingSignature.id,
          body: {
            name: signatureName || existingSignature.name,
            signatureHtml: signatureContent,
            signatureText,
            isDefault: true,
          },
          params: {
            workspaceId,
            userId,
          },
        })
        toast.success("서명이 업데이트되었습니다.")
      } else {
        // 새 서명 생성
        await createSignature.mutateAsync({
          body: {
            name: signatureName || "기본 서명",
            signatureHtml: signatureContent,
            signatureText,
            isDefault: true,
          },
          params: {
            workspaceId,
            userId,
          },
        })
        toast.success("서명이 저장되었습니다.")
      }

      // 모든 서명 관련 쿼리 무효화 (모든 컴포넌트에서 최신 서명 가져오도록)
      await queryClient.invalidateQueries({
        queryKey: emailSignatureKeys.all,
      })

      // 현재 쿼리 다시 불러오기
      if (shouldFetchSignature) {
        await refetch()
      }

      // 현재 스텝에 서명 적용
      onSave(signatureContent)
      onClose()
    } catch (error) {
      console.error("서명 저장 오류:", error)
      toast.error("서명 저장에 실패했습니다.")
    }
  }

  const handleClose = () => {
    // Reset to default when closing without saving
    if (existingSignature) {
      setSignatureName(existingSignature.name)
      setSignatureContent(existingSignature.signatureHtml)
    } else {
      setSignatureContent(defaultSignature)
      setSignatureName("")
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <DialogTitle>서명 편집</DialogTitle>
          </div>
          <DialogDescription>
            이메일에 추가될 서명을 편집하세요. 변경사항은 현재 스텝에만 적용됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={nameId}>서명 이름 (선택사항)</Label>
            <Input
              id={nameId}
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="예: 공식 서명, 간단한 서명"
            />
            <p className="text-xs text-muted-foreground">
              서명 이름은 참고용입니다. 이메일에는 포함되지 않습니다.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={contentId}>서명 내용</Label>
            <RichTextEditor
              value={signatureContent}
              onChange={setSignatureContent}
              placeholder="서명 내용을 입력하세요"
              height="300px"
            />
            <p className="text-xs text-muted-foreground">
              서명은 이메일 본문 하단에 자동으로 추가됩니다.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              💡 <strong>팁:</strong> 서명에는 이름, 직책, 연락처, 회사 정보 등을 포함할 수
              있습니다. HTML 형식으로 작성하면 더 풍부한 표현이 가능합니다.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={createSignature.isPending || updateSignature.isPending}
          >
            <Mail className="h-4 w-4 mr-2" />
            {createSignature.isPending || updateSignature.isPending
              ? "저장 중..."
              : "저장하고 적용"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
