import { Check, Edit2, Mail, Plus, Trash2, X } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  useCreateEmailSignature,
  useDefaultEmailSignature,
  useDeleteEmailSignature,
  useEmailSignatures,
  useSetDefaultEmailSignature,
  useUpdateEmailSignature,
} from "@/lib/api/hooks/email-signatures"
import type { CreateEmailSignatureRequest, EmailSignature } from "@/lib/api/types/email-signature"
import { useAuth } from "@/lib/auth-provider"
import { generateSignatureHtml, htmlToMarkdown } from "@/lib/utils/email-signature"

export function EmailSignatureManagement() {
  const { user } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null)

  // Get workspaceId from localStorage
  // 백엔드에서 JWT 토큰으로 "all"을 처리하므로 프론트엔드에서는 그대로 전달
  const workspaceId = localStorage.getItem("selectedWorkspace") || ""

  // 기본 서명 템플릿 생성 (HTML 형식)
  const getDefaultSignature = () => {
    if (user) {
      const name = user.username || "사용자"
      const title = user.userRole || "직원"
      const html = generateSignatureHtml({ name, title })
      // HTML을 텍스트로 변환 (줄바꿈과 공백 처리)
      const text = htmlToMarkdown(html)
        .replace(/&nbsp;/g, " ") // HTML 엔티티 변환
        .replace(/\s+/g, " ") // 연속된 공백을 하나로
        .replace(/\n\s*\n/g, "\n\n") // 여러 줄바꿈을 두 개로 정리
        .trim()
      return { html, text }
    }
    const html = generateSignatureHtml()
    const text = htmlToMarkdown(html)
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n\n")
      .trim()
    return { html, text }
  }

  const nameInputId = useId()
  const [formData, setFormData] = useState<CreateEmailSignatureRequest>({
    name: "",
    signatureHtml: "",
    signatureText: "",
  })

  // API Hooks
  // 모든 서명 조회 (workspaceId 무관)
  const { data: signatures, isLoading } = useEmailSignatures(
    {
      includeInactive: false,
      userId: user?.id,
    },
    true,
  )
  const { data: defaultSignature } = useDefaultEmailSignature()
  const createMutation = useCreateEmailSignature()
  const updateMutation = useUpdateEmailSignature()
  const deleteMutation = useDeleteEmailSignature()
  const setDefaultMutation = useSetDefaultEmailSignature()

  // 기본 서명 여부 확인
  const isDefaultSignature = (signatureId: string) => {
    // API 응답의 isDefault 플래그 확인
    const signature = signatures?.find((sig) => sig.id === signatureId)
    if (signature?.isDefault) {
      return true
    }
    // defaultSignature 쿼리 결과 확인
    if (defaultSignature?.id === signatureId) {
      return true
    }
    return false
  }

  const handleOpenDialog = (signature?: EmailSignature) => {
    if (signature) {
      setEditingSignature(signature)
      setFormData({
        name: signature.name,
        signatureHtml: signature.signatureHtml,
        signatureText: signature.signatureText,
      })
    } else {
      // 새 서명 추가 시 기본 템플릿 사용 (HTML 형식)
      const defaultSignature = getDefaultSignature()
      setEditingSignature(null)
      setFormData({
        name: "",
        signatureHtml: defaultSignature.html,
        signatureText: defaultSignature.text,
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingSignature(null)
    setFormData({
      name: "",
      signatureHtml: "",
      signatureText: "",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingSignature) {
      await updateMutation.mutateAsync({
        id: editingSignature.id,
        body: formData,
      })
    } else {
      // workspaceId, userId는 선택적 (생성자 추적용)
      await createMutation.mutateAsync({
        body: formData,
        params: workspaceId && workspaceId !== "all" ? { workspaceId } : undefined,
      })
    }

    handleCloseDialog()
  }

  const handleDelete = async (signatureId: string) => {
    if (!confirm("정말 이 서명을 삭제하시겠습니까?")) {
      return
    }

    await deleteMutation.mutateAsync({
      id: signatureId,
    })
  }

  const handleSetDefault = async (signatureId: string) => {
    if (!user?.id) {
      toast.error("사용자 정보를 찾을 수 없습니다")
      return
    }
    await setDefaultMutation.mutateAsync({
      id: signatureId,
      userId: user.id,
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>이메일 서명 관리</CardTitle>
          </div>
          <CardDescription>이메일 발송 시 사용할 서명을 관리합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-4 text-center text-muted-foreground">로딩 중...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <CardTitle>이메일 서명 관리</CardTitle>
              </div>
              <CardDescription>이메일 발송 시 사용할 서명을 관리합니다</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />새 서명 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!signatures || signatures.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Mail className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p>등록된 서명이 없습니다.</p>
              <p className="mt-1 text-sm">새 서명을 추가하여 시작하세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {signatures.map((signature) => (
                <div
                  className="rounded-lg border p-4 transition-colors hover:border-violet-300"
                  key={signature.id}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="font-semibold">{signature.name}</h3>
                        {isDefaultSignature(signature.id) && (
                          <Badge variant="default">
                            <Check className="mr-1 h-3 w-3" />
                            기본
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        생성: {new Date(signature.createdAt).toLocaleDateString("ko-KR")} | 수정:{" "}
                        {new Date(signature.updatedAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!isDefaultSignature(signature.id) && (
                        <Button
                          disabled={setDefaultMutation.isPending}
                          onClick={() => handleSetDefault(signature.id)}
                          size="sm"
                          variant="outline"
                        >
                          기본으로 설정
                        </Button>
                      )}
                      <Button onClick={() => handleOpenDialog(signature)} size="sm" variant="ghost">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(signature.id)}
                        size="sm"
                        title="서명 삭제"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 border-t pt-3">
                    <div className="text-sm">
                      <div
                        className="prose prose-sm max-w-none"
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: signature content is user-generated and needs to be rendered as HTML
                        dangerouslySetInnerHTML={{
                          __html: signature.signatureHtml,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSignature ? "서명 수정" : "새 서명 추가"}</DialogTitle>
            <DialogDescription>이메일 발송 시 자동으로 추가될 서명을 작성하세요</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor={nameInputId}>서명 이름 *</Label>
              <Input
                id={nameInputId}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 기본 서명, 공식 서명"
                required
                value={formData.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signatureText">서명 내용 (텍스트)</Label>
              <RichTextEditor
                height="300px"
                onChange={(value) => {
                  setFormData({
                    ...formData,
                    signatureText: value,
                    // 텍스트 변경 시 HTML도 업데이트 (줄바꿈을 <br>로 변환)
                    // 단, 새로 추가한 경우가 아니면 기존 HTML 구조 유지
                    signatureHtml: editingSignature
                      ? value.replace(/\n/g, "<br>")
                      : formData.signatureHtml || value.replace(/\n/g, "<br>"),
                  })
                }}
                placeholder="서명 내용을 입력하세요&#10;&#10;예:&#10;홍길동&#10;주식회사 그린다에이아이 | 대리&#10;Tel. 010-1234-5678&#10;Email. hong@grinda.ai"
                value={formData.signatureText}
              />
              <p className="text-muted-foreground text-xs">
                이 내용은 HTML 형식으로 자동 변환되어 저장됩니다. 새 서명 추가 시 기본 HTML
                템플릿(이미지 포함)이 적용됩니다.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={handleCloseDialog}
                type="button"
                variant="outline"
              >
                <X className="mr-2 h-4 w-4" />
                취소
              </Button>
              <Button disabled={createMutation.isPending || updateMutation.isPending} type="submit">
                {createMutation.isPending || updateMutation.isPending
                  ? "저장 중..."
                  : editingSignature
                    ? "수정"
                    : "생성"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
