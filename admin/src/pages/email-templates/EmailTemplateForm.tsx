import { Label } from "@radix-ui/react-label"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import type { EmailTemplate } from "@/lib/api/types/email-template"
import type { Workspace } from "@/lib/api/types/workspace"

type EmailTemplateFormProps = {
  template?: EmailTemplate
  isEdit?: boolean
  workspaces: Workspace[]
  onSave: (templateData: unknown) => Promise<void> | void
  onCancel: () => void
}

export function EmailTemplateForm({
  template,
  isEdit = false,
  workspaces = [],
  onSave,
  onCancel,
}: EmailTemplateFormProps) {
  const nameId = useId()
  const subjectId = useId()
  const bodyTextId = useId()
  const categoryId = useId()
  const descriptionId = useId()

  console.log(workspaces)

  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    subject: template?.subject || "",
    bodyHtml: template?.bodyHtml || "",
    bodyText: template?.bodyText || "",
    category: template?.category || "",
    isShared: template?.isShared ?? true,
    workspaceId: template?.workspaceId || "",
  })

  // Update formData when template changes (for edit mode)
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || "",
        description: template.description || "",
        subject: template.subject || "",
        bodyHtml: template.bodyHtml || "",
        bodyText: template.bodyText || "",
        category: template.category || "",
        isShared: template.isShared ?? true,
        workspaceId: template.workspaceId || "",
      })
    }
  }, [template])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Include bodyText even if empty (empty string is valid)
    onSave({
      ...formData,
      bodyText: formData.bodyText,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor={nameId}>템플릿명 *</Label>
        <Input
          id={nameId}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="예: 신규 고객 환영 메일"
          required
          value={formData.name}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={descriptionId}>설명</Label>
        <Input
          id={descriptionId}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="템플릿에 대한 간단한 설명을 입력하세요"
          value={formData.description}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={subjectId}>제목 *</Label>
        <Input
          id={subjectId}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="예: {{name}}님, 환영합니다!"
          required
          value={formData.subject}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={bodyTextId}>텍스트 본문</Label>
        <RichTextEditor
          height="200px"
          onChange={(value) => {
            setFormData((prev) => ({ ...prev, bodyText: value || "" }))
          }}
          placeholder="텍스트 형식의 이메일 본문을 입력하세요"
          value={formData.bodyText || ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={categoryId}>카테고리</Label>
        <Input
          id={categoryId}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="예: welcome, promotion, transaction"
          value={formData.category}
        />
      </div>

      {/* <div className="flex items-center space-x-2">
        <Checkbox
          id={isSharedId}
          checked={formData.isShared}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, isShared: !!checked })
          }
        />
        <Label htmlFor={isSharedId}>워크스페이스 내 공유</Label>
      </div> */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button onClick={onCancel} type="button" variant="outline">
          취소
        </Button>
        <Button className="min-w-[100px]" type="submit">
          {isEdit ? "수정 완료" : "생성"}
        </Button>
      </div>
    </form>
  )
}
