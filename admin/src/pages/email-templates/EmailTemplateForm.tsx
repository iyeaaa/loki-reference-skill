import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { EmailTemplate } from "@/lib/api/types/email-template";
import type { Workspace } from "@/lib/api/types/workspace";
import { Label } from "@radix-ui/react-label";
import { Input } from "@/components/ui/input";

interface EmailTemplateFormProps {
  template?: EmailTemplate;
  isEdit?: boolean;
  workspaces: Workspace[];
  onSave: (templateData: unknown) => Promise<void> | void;
  onCancel: () => void;
}

export function EmailTemplateForm({
  template,
  isEdit = false,
  workspaces = [],
  onSave,
  onCancel,
}: EmailTemplateFormProps) {
  const nameId = useId();
  const subjectId = useId();
  const bodyTextId = useId();
  const categoryId = useId();
  const descriptionId = useId();

  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    subject: template?.subject || "",
    bodyHtml: template?.bodyHtml || "",
    bodyText: template?.bodyText || "",
    category: template?.category || "",
    isShared: true,
    workspaceId: template?.workspaceId || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={nameId}>템플릿명 *</Label>
        <Input
          id={nameId}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="예: 신규 고객 환영 메일"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={descriptionId}>설명</Label>
        <Input
          id={descriptionId}
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="템플릿에 대한 간단한 설명을 입력하세요"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={subjectId}>제목 *</Label>
        <Input
          id={subjectId}
          value={formData.subject}
          onChange={(e) =>
            setFormData({ ...formData, subject: e.target.value })
          }
          required
          placeholder="예: {{name}}님, 환영합니다!"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={bodyTextId}>텍스트 본문</Label>
        <RichTextEditor
          value={formData.bodyText || ""}
          onChange={(value) => setFormData({ ...formData, bodyText: value })}
          placeholder="텍스트 형식의 이메일 본문을 입력하세요"
          height="200px"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={categoryId}>카테고리</Label>
        <Input
          id={categoryId}
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
          placeholder="예: welcome, promotion, transaction"
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
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="min-w-[100px]">
          {isEdit ? "수정 완료" : "생성"}
        </Button>
      </div>
    </form>
  );
}
