import { Check, ChevronsUpDown } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import type { EmailTemplate } from "@/lib/api/types/email-template"
import type { Workspace } from "@/lib/api/types/workspace"

interface EmailTemplateFormProps {
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
  const bodyHtmlId = useId()
  const bodyTextId = useId()
  const categoryId = useId()
  const descriptionId = useId()
  const isSharedId = useId()

  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    subject: template?.subject || "",
    bodyHtml: template?.bodyHtml || "",
    bodyText: template?.bodyText || "",
    category: template?.category || "",
    isShared: template?.isShared ?? false,
    workspaceId: template?.workspaceId || "",
  })
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceSearch, setWorkspaceSearch] = useState("")

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(workspaceSearch.toLowerCase())
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

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
        <Textarea
          id={descriptionId}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="템플릿에 대한 간단한 설명을 입력하세요"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={subjectId}>제목 *</Label>
        <Input
          id={subjectId}
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          required
          placeholder="예: {{name}}님, 환영합니다!"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={bodyHtmlId}>HTML 본문</Label>
        <Textarea
          id={bodyHtmlId}
          value={formData.bodyHtml}
          onChange={(e) => setFormData({ ...formData, bodyHtml: e.target.value })}
          placeholder="HTML 형식의 이메일 본문을 입력하세요"
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={bodyTextId}>텍스트 본문</Label>
        <Textarea
          id={bodyTextId}
          value={formData.bodyText}
          onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
          placeholder="텍스트 형식의 이메일 본문을 입력하세요"
          rows={6}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={categoryId}>카테고리</Label>
        <Input
          id={categoryId}
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="예: welcome, promotion, transaction"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="workspace">워크스페이스 *</Label>
        <Popover open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={workspaceOpen}
              className="w-full justify-between font-normal"
              disabled={isEdit}
            >
              {formData.workspaceId
                ? workspaces.find((ws) => ws.id === formData.workspaceId)?.name
                : "워크스페이스 선택"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput
                placeholder="워크스페이스 검색..."
                value={workspaceSearch}
                onValueChange={setWorkspaceSearch}
              />
              <CommandList>
                <CommandEmpty>워크스페이스를 찾을 수 없습니다.</CommandEmpty>
                <CommandGroup>
                  {filteredWorkspaces.map((ws) => (
                    <CommandItem
                      key={ws.id}
                      value={ws.id}
                      onSelect={(currentValue) => {
                        setFormData({
                          ...formData,
                          workspaceId: currentValue === formData.workspaceId ? "" : currentValue,
                        })
                        setWorkspaceOpen(false)
                        setWorkspaceSearch("")
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          formData.workspaceId === ws.id ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {ws.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {isEdit && (
          <p className="text-xs text-muted-foreground">워크스페이스는 수정할 수 없습니다</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id={isSharedId}
          checked={formData.isShared}
          onCheckedChange={(checked) => setFormData({ ...formData, isShared: !!checked })}
        />
        <Label htmlFor={isSharedId}>워크스페이스 내 공유</Label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="min-w-[100px]">
          {isEdit ? "수정 완료" : "생성"}
        </Button>
      </div>
    </form>
  )
}
