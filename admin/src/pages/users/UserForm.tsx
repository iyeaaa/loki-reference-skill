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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Department, User } from "@/lib/api/types/user"

interface UserFormProps {
  user?: User
  isEdit?: boolean
  departments: Department[]
  onSave: (userData: unknown) => Promise<void> | void
  onCancel: () => void
}

export function UserForm({
  user,
  isEdit = false,
  departments = [],
  onSave,
  onCancel,
}: UserFormProps) {
  const usernameId = useId()
  const emailId = useId()
  const employeeIdFormId = useId()
  const passwordId = useId()
  const isActiveId = useId()

  const [formData, setFormData] = useState({
    username: user?.username || "",
    email: user?.email || "",
    password: "",
    userRole: user?.userRole || ("user" as const),
    isActive: user?.isActive ?? true,
    departmentId: user?.departmentId || "",
    employeeId: user?.employeeId || "",
  })
  const [departmentOpen, setDepartmentOpen] = useState(false)
  const [departmentSearch, setDepartmentSearch] = useState("")

  const filteredDepartments = departments.filter(
    (dept) =>
      dept.name.toLowerCase().includes(departmentSearch.toLowerCase()) ||
      dept.code.toLowerCase().includes(departmentSearch.toLowerCase()),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit && !formData.password) {
      const { password: _password, ...dataWithoutPassword } = formData
      onSave(dataWithoutPassword)
    } else {
      onSave(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={usernameId}>사용자명</Label>
        <Input
          id={usernameId}
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={emailId}>이메일</Label>
        <Input
          id={emailId}
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={employeeIdFormId}>사번</Label>
        <Input
          id={employeeIdFormId}
          value={formData.employeeId}
          onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="user_role">역할</Label>
        <Select
          value={formData.userRole}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              userRole: value as "admin" | "user",
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">사용자</SelectItem>
            <SelectItem value="admin">관리자</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">부서</Label>
        <Popover open={departmentOpen} onOpenChange={setDepartmentOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={departmentOpen}
              className="w-full justify-between font-normal"
            >
              {formData.departmentId
                ? departments.find((dept) => dept.id === formData.departmentId)?.name
                : "부서 선택"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput
                placeholder="부서 검색..."
                value={departmentSearch}
                onValueChange={setDepartmentSearch}
              />
              <CommandList>
                <CommandEmpty>부서를 찾을 수 없습니다.</CommandEmpty>
                <CommandGroup>
                  {filteredDepartments.map((dept) => (
                    <CommandItem
                      key={dept.id}
                      value={dept.id}
                      onSelect={(currentValue) => {
                        setFormData({
                          ...formData,
                          departmentId: currentValue === formData.departmentId ? "" : currentValue,
                        })
                        setDepartmentOpen(false)
                        setDepartmentSearch("")
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          formData.departmentId === dept.id ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {dept.name} ({dept.code})
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor={passwordId}>비밀번호</Label>
          <Input
            id={passwordId}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required={!isEdit}
            minLength={8}
          />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id={isActiveId}
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
        />
        <Label htmlFor={isActiveId}>활성 상태</Label>
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
