import { Check, ChevronsUpDown } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Sequence, SequenceStatus } from "@/lib/api/types/sequence"
import type { Workspace } from "@/lib/api/types/workspace"

interface SequenceFormProps {
  sequence?: Sequence
  isEdit?: boolean
  workspaces: Workspace[]
  onSave: (sequenceData: unknown) => Promise<void> | void
  onCancel: () => void
}

export function SequenceForm({
  sequence,
  isEdit = false,
  workspaces = [],
  onSave,
  onCancel,
}: SequenceFormProps) {
  const nameId = useId()
  const descriptionId = useId()

  const [formData, setFormData] = useState({
    name: sequence?.name || "",
    description: sequence?.description || "",
    workspaceId: sequence?.workspaceId || "",
    status: (sequence?.status || "draft") as SequenceStatus,
  })
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceSearch, setWorkspaceSearch] = useState("")

  const filteredWorkspaces = workspaces.filter(
    (workspace) =>
      workspace.name.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
      workspace.id.toLowerCase().includes(workspaceSearch.toLowerCase())
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={nameId}>시퀀스명</Label>
        <Input
          id={nameId}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="예: 신규 고객 온보딩 시퀀스"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={descriptionId}>설명</Label>
        <Textarea
          id={descriptionId}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="시퀀스에 대한 설명을 입력하세요..."
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
                ? workspaces.find((ws) => ws.id === formData.workspaceId)?.name ||
                  formData.workspaceId
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
          <p className="text-xs text-muted-foreground">워크스페이스는 생성 후 변경할 수 없습니다</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">상태</Label>
        <Select
          value={formData.status}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              status: value as SequenceStatus,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">초안</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="paused">일시정지</SelectItem>
            <SelectItem value="archived">보관됨</SelectItem>
          </SelectContent>
        </Select>
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
