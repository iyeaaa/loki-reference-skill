'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogFooter } from '@/components/ui/dialog'
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown } from 'lucide-react'
import type {
  User,
  Department,
  Language,
} from '@/lib/api/types/user'

interface UserFormProps {
  user?: User
  isEdit?: boolean
  departments: Department[]
  languages: Language[]
  onSave: (userData: unknown) => Promise<void> | void
  onCancel: () => void
}

export function UserForm({ 
  user, 
  isEdit = false,
  departments = [], 
  languages = [],
  onSave, 
  onCancel 
}: UserFormProps) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    user_role: user?.user_role || 'user' as const,
    is_active: user?.is_active ?? true,
    department_id: user?.department_id || "",
    employee_id: user?.employee_id || '',
    edit_languages: user?.edit_languages?.map(lang => typeof lang === 'string' ? lang : lang.code) || [],
    review_languages: user?.review_languages?.map(lang => typeof lang === 'string' ? lang : lang.code) || []
  })
  const [departmentOpen, setDepartmentOpen] = useState(false)
  const [departmentSearch, setDepartmentSearch] = useState('')

  const filteredDepartments = departments.filter(dept => 
    dept.name.toLowerCase().includes(departmentSearch.toLowerCase()) ||
    dept.code.toLowerCase().includes(departmentSearch.toLowerCase())
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit && !formData.password) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...dataWithoutPassword } = formData
      onSave(dataWithoutPassword)
    } else {
      onSave(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">사용자명</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData({...formData, username: e.target.value})}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="employee_id">사번</Label>
        <Input
          id="employee_id"
          value={formData.employee_id}
          onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="user_role">역할</Label>
        <Select value={formData.user_role} onValueChange={(value) => setFormData({...formData, user_role: value as 'admin' | 'internal_reviewer' | 'external_reviewer' | 'user'})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">사용자</SelectItem>
            <SelectItem value="internal_reviewer">내부 검수자</SelectItem>
            <SelectItem value="external_reviewer">외부 검수자</SelectItem>
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
              {formData.department_id
                ? departments.find((dept) => dept.id === formData.department_id)?.name
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
                        setFormData({...formData, department_id: currentValue === formData.department_id ? "" : currentValue})
                        setDepartmentOpen(false)
                        setDepartmentSearch('')
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          formData.department_id === dept.id ? "opacity-100" : "opacity-0"
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
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required={!isEdit}
            minLength={8}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>편집 권한 언어</Label>
        <MultiSelectCombobox
          options={languages
            .filter(lang => lang.is_active)
            .map(lang => ({
              value: lang.code,
              label: lang.name,
              sublabel: lang.code
            }))}
          value={formData.edit_languages}
          onValueChange={(values) => setFormData({...formData, edit_languages: values})}
          placeholder="편집 언어 선택..."
          searchPlaceholder="언어 검색..."
          emptyText="언어를 찾을 수 없습니다."
        />
        {formData.edit_languages.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            선택된 언어: {formData.edit_languages.map(code => {
              const lang = languages.find(l => l.code === code);
              return lang ? lang.name : code;
            }).join(', ')}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>검수 권한 언어</Label>
        <MultiSelectCombobox
          options={languages
            .filter(lang => lang.is_active)
            .map(lang => ({
              value: lang.code,
              label: lang.name,
              sublabel: lang.code
            }))}
          value={formData.review_languages}
          onValueChange={(values) => setFormData({...formData, review_languages: values})}
          placeholder="검수 언어 선택..."
          searchPlaceholder="언어 검색..."
          emptyText="언어를 찾을 수 없습니다."
        />
        {formData.review_languages.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            선택된 언어: {formData.review_languages.map(code => {
              const lang = languages.find(l => l.code === code);
              return lang ? lang.name : code;
            }).join(', ')}
          </p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({...formData, is_active: !!checked})}
        />
        <Label htmlFor="is_active">활성 상태</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit">
          {isEdit ? '수정' : '생성'}
        </Button>
      </DialogFooter>
    </form>
  )
}