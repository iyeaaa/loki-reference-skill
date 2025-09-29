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
import type { CustomerGroup } from "@/lib/api/types/customer-group"
import type { Workspace } from "@/lib/api/types/workspace"

interface CustomerGroupFormProps {
  customerGroup?: CustomerGroup
  isEdit?: boolean
  workspaces: Workspace[]
  onSave: (customerGroupData: unknown) => Promise<void> | void
  onCancel: () => void
}

export function CustomerGroupForm({
  customerGroup,
  isEdit = false,
  workspaces = [],
  onSave,
  onCancel,
}: CustomerGroupFormProps) {
  const nameId = useId()
  const descriptionId = useId()
  const isDynamicId = useId()

  const [formData, setFormData] = useState({
    name: customerGroup?.name || "",
    description: customerGroup?.description || "",
    workspaceId: customerGroup?.workspaceId || "",
    isDynamic: customerGroup?.isDynamic ?? false,
  })
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceSearch, setWorkspaceSearch] = useState("")

  const filteredWorkspaces = workspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(workspaceSearch.toLowerCase())
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={nameId}>그룹명</Label>
        <Input
          id={nameId}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="고객 그룹명을 입력하세요"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={descriptionId}>설명</Label>
        <Textarea
          id={descriptionId}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="그룹 설명을 입력하세요 (선택사항)"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="workspace">워크스페이스</Label>
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
                ? workspaces.find((workspace) => workspace.id === formData.workspaceId)?.name
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
                  {filteredWorkspaces.map((workspace) => (
                    <CommandItem
                      key={workspace.id}
                      value={workspace.id}
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
                          formData.workspaceId === workspace.id ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {workspace.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {isEdit && (
          <p className="text-xs text-muted-foreground">워크스페이스는 수정 시 변경할 수 없습니다</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id={isDynamicId}
          checked={formData.isDynamic}
          onCheckedChange={(checked) => setFormData({ ...formData, isDynamic: !!checked })}
        />
        <Label htmlFor={isDynamicId} className="text-sm font-normal">
          동적 그룹 (조건에 따라 자동으로 멤버가 업데이트됨)
        </Label>
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
