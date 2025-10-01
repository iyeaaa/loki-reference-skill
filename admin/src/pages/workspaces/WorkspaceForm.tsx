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
import type { User } from "@/lib/api/types/user"
import type { Workspace } from "@/lib/api/types/workspace"
import { WorkspaceMembersSection } from "./WorkspaceMembersSection"

interface WorkspaceFormProps {
  workspace?: Workspace
  isEdit?: boolean
  users: User[]
  onSave: (workspaceData: unknown) => Promise<void> | void
  onCancel: () => void
  onAddMemberClick?: () => void
}

export function WorkspaceForm({
  workspace,
  isEdit = false,
  users,
  onSave,
  onCancel,
  onAddMemberClick,
}: WorkspaceFormProps) {
  const nameId = useId()
  const descriptionId = useId()
  const isActiveId = useId()

  const [formData, setFormData] = useState({
    name: workspace?.name || "",
    description: workspace?.description || "",
    ownerId: workspace?.ownerId || "",
    isActive: workspace?.isActive ?? true,
  })
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState("")

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(ownerSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(ownerSearch.toLowerCase())
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={handleSubmit} className="flex-1 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={nameId}>
              워크스페이스명 <span className="text-red-500">*</span>
            </Label>
            <Input
              id={nameId}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="워크스페이스 이름을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={descriptionId}>설명</Label>
            <Textarea
              id={descriptionId}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="워크스페이스에 대한 설명을 입력하세요 (선택사항)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner">
              소유자 <span className="text-red-500">*</span>
            </Label>
            <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={ownerOpen}
                  className="w-full justify-between font-normal"
                  type="button"
                >
                  {formData.ownerId
                    ? users.find((user) => user.id === formData.ownerId)?.username ||
                      users.find((user) => user.id === formData.ownerId)?.email
                    : "소유자 선택"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command className="max-h-[300px]">
                  <CommandInput
                    placeholder="사용자 검색..."
                    value={ownerSearch}
                    onValueChange={setOwnerSearch}
                  />
                  <CommandList>
                    <CommandEmpty>사용자를 찾을 수 없습니다.</CommandEmpty>
                    <CommandGroup>
                      {filteredUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={`${user.username} ${user.email}`}
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              ownerId: user.id,
                            })
                            setOwnerOpen(false)
                            setOwnerSearch("")
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              formData.ownerId === user.id ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          <div className="flex flex-col">
                            <span>{user.username}</span>
                            <span className="text-xs text-gray-500">{user.email}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id={isActiveId}
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
            />
            <Label htmlFor={isActiveId}>활성 상태</Label>
          </div>
        </div>

        {workspace?.id && (
          <div className="pt-6 border-t">
            <WorkspaceMembersSection
              workspaceId={workspace.id}
              isEdit={isEdit}
              onAddMemberClick={onAddMemberClick || (() => {})}
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t sticky bottom-0 bg-white">
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button
            type="submit"
            className="min-w-[100px]"
            disabled={!formData.name || !formData.ownerId}
          >
            {isEdit ? "수정 완료" : "생성"}
          </Button>
        </div>
      </form>
    </div>
  )
}
