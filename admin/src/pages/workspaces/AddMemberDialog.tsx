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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAddWorkspaceMember } from "@/lib/api/hooks/workspaces"
import type { User } from "@/lib/api/types/user"

interface AddMemberDialogProps {
  workspaceId: string
  users: User[]
  existingMemberUserIds: string[]
  isOpen: boolean
  onClose: () => void
}

export function AddMemberDialog({
  workspaceId,
  users,
  existingMemberUserIds,
  isOpen,
  onClose,
}: AddMemberDialogProps) {
  const userSelectId = useId()
  const roleSelectId = useId()

  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedRole, setSelectedRole] = useState<"owner" | "admin" | "member" | "viewer">(
    "member"
  )
  const [userOpen, setUserOpen] = useState(false)
  const [userSearch, setUserSearch] = useState("")

  const addMember = useAddWorkspaceMember()

  // Filter out users who are already members
  const availableUsers = users.filter((user) => !existingMemberUserIds.includes(user.id))

  const filteredUsers = availableUsers.filter(
    (user) =>
      user.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId) return

    addMember.mutate(
      {
        workspaceId,
        data: {
          userId: selectedUserId,
          role: selectedRole,
        },
      },
      {
        onSuccess: () => {
          setSelectedUserId("")
          setSelectedRole("member")
          setUserSearch("")
          onClose()
        },
      }
    )
  }

  const handleClose = () => {
    setSelectedUserId("")
    setSelectedRole("member")
    setUserSearch("")
    onClose()
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return "소유자"
      case "admin":
        return "관리자"
      case "member":
        return "멤버"
      case "viewer":
        return "뷰어"
      default:
        return role
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>멤버 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={userSelectId}>
              사용자 <span className="text-red-500">*</span>
            </Label>
            <Popover open={userOpen} onOpenChange={setUserOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={userSelectId}
                  variant="outline"
                  role="combobox"
                  aria-expanded={userOpen}
                  className="w-full justify-between font-normal"
                  type="button"
                >
                  {selectedUserId
                    ? availableUsers.find((user) => user.id === selectedUserId)?.username ||
                      availableUsers.find((user) => user.id === selectedUserId)?.email
                    : "사용자 선택"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput
                    placeholder="사용자 검색..."
                    value={userSearch}
                    onValueChange={setUserSearch}
                  />
                  <CommandList>
                    {filteredUsers.length === 0 ? (
                      <CommandEmpty>
                        {availableUsers.length === 0
                          ? "추가 가능한 사용자가 없습니다."
                          : "사용자를 찾을 수 없습니다."}
                      </CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {filteredUsers.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.id}
                            onSelect={(currentValue) => {
                              setSelectedUserId(currentValue === selectedUserId ? "" : currentValue)
                              setUserOpen(false)
                              setUserSearch("")
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedUserId === user.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <div className="flex flex-col">
                              <span>{user.username}</span>
                              <span className="text-xs text-gray-500">{user.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor={roleSelectId}>
              역할 <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id={roleSelectId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">{getRoleLabel("owner")}</SelectItem>
                <SelectItem value="admin">{getRoleLabel("admin")}</SelectItem>
                <SelectItem value="member">{getRoleLabel("member")}</SelectItem>
                <SelectItem value="viewer">{getRoleLabel("viewer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              취소
            </Button>
            <Button
              type="submit"
              disabled={!selectedUserId || addMember.isPending}
              className="min-w-[100px]"
            >
              {addMember.isPending ? "추가 중..." : "추가"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
