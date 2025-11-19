import { Check, Edit2, Mail, Plus, Trash2, X } from "lucide-react"
import { useId, useState } from "react"
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
  useDeleteEmailSignature,
  useEmailSignatures,
  useSetDefaultEmailSignature,
  useUpdateEmailSignature,
} from "@/lib/api/hooks/email-signatures"
import type { CreateEmailSignatureRequest, EmailSignature } from "@/lib/api/types/email-signature"
import { useAuth } from "@/lib/auth-provider"

export function EmailSignatureManagement() {
  const { user } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null)

  // Get workspaceId from localStorage
  const workspaceId = localStorage.getItem("selectedWorkspace") || ""

  const nameInputId = useId()
  const isDefaultCheckboxId = useId()
  const [formData, setFormData] = useState<CreateEmailSignatureRequest>({
    name: "",
    signatureHtml: "",
    signatureText: "",
    isDefault: false,
  })

  // API Hooks
  const { data: signatures, isLoading } = useEmailSignatures(
    {
      workspaceId: workspaceId || "",
      includeInactive: false,
    },
    !!workspaceId,
  )
  const createMutation = useCreateEmailSignature()
  const updateMutation = useUpdateEmailSignature()
  const deleteMutation = useDeleteEmailSignature()
  const setDefaultMutation = useSetDefaultEmailSignature()

  const handleOpenDialog = (signature?: EmailSignature) => {
    if (signature) {
      setEditingSignature(signature)
      setFormData({
        name: signature.name,
        signatureHtml: signature.signatureHtml,
        signatureText: signature.signatureText,
        isDefault: signature.isDefault,
      })
    } else {
      setEditingSignature(null)
      setFormData({
        name: "",
        signatureHtml: "",
        signatureText: "",
        isDefault: false,
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
      isDefault: false,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!workspaceId || !user?.id) return

    const params = { workspaceId, userId: user.id }

    if (editingSignature) {
      await updateMutation.mutateAsync({
        id: editingSignature.id,
        body: formData,
        params: { workspaceId },
      })
    } else {
      await createMutation.mutateAsync({
        body: formData,
        params,
      })
    }

    handleCloseDialog()
  }

  const handleDelete = async (signatureId: string) => {
    if (!workspaceId) return
    if (!confirm("정말 이 서명을 삭제하시겠습니까?")) return

    await deleteMutation.mutateAsync({
      id: signatureId,
      params: {
        workspaceId,
        hardDelete: false,
      },
    })
  }

  const handleSetDefault = async (signatureId: string) => {
    if (!workspaceId || !user?.id) return

    await setDefaultMutation.mutateAsync({
      id: signatureId,
      params: {
        workspaceId,
        userId: user.id,
      },
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
          <div className="text-center py-4 text-muted-foreground">로딩 중...</div>
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
              <Plus className="h-4 w-4 mr-2" />새 서명 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!signatures || signatures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>등록된 서명이 없습니다.</p>
              <p className="text-sm mt-1">새 서명을 추가하여 시작하세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {signatures.map((signature) => (
                <div
                  key={signature.id}
                  className="border rounded-lg p-4 hover:border-violet-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{signature.name}</h3>
                        {signature.isDefault && (
                          <Badge variant="default">
                            <Check className="h-3 w-3 mr-1" />
                            기본
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        생성: {new Date(signature.createdAt).toLocaleDateString("ko-KR")} | 수정:{" "}
                        {new Date(signature.updatedAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!signature.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(signature.id)}
                          disabled={setDefaultMutation.isPending}
                        >
                          기본으로 설정
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(signature)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(signature.id)}
                        disabled={deleteMutation.isPending}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSignature ? "서명 수정" : "새 서명 추가"}</DialogTitle>
            <DialogDescription>이메일 발송 시 자동으로 추가될 서명을 작성하세요</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={nameInputId}>서명 이름 *</Label>
              <Input
                id={nameInputId}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 기본 서명, 공식 서명"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signatureText">서명 내용 (텍스트)</Label>
              <RichTextEditor
                value={formData.signatureText}
                onChange={(value) => {
                  setFormData({
                    ...formData,
                    signatureText: value,
                    // HTML도 같이 업데이트 (간단한 변환)
                    signatureHtml: value.replace(/\n/g, "<br>"),
                  })
                }}
                placeholder="서명 내용을 입력하세요&#10;&#10;예:&#10;홍길동&#10;주식회사 그린다에이아이 | 대리&#10;Tel. 010-1234-5678&#10;Email. hong@grinda.ai"
                height="300px"
              />
              <p className="text-xs text-muted-foreground">
                이 내용은 HTML 형식으로 자동 변환되어 저장됩니다
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={isDefaultCheckboxId}
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor={isDefaultCheckboxId} className="cursor-pointer">
                이 서명을 기본 서명으로 설정
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                취소
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
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
