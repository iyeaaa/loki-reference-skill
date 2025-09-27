"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface BulkActionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (action: string, value: string | string[]) => void
  userCount: number
  actionType: "status" | "role" | "department" | "edit_languages" | "review_languages" | null
  departments?: Array<{ id: string; name: string; code: string }>
  languages?: Array<{ code: string; name: string; is_active: boolean }>
}

export function BulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  userCount,
  actionType,
  departments = [],
  languages = [],
}: BulkActionModalProps) {
  const [selectedValue, setSelectedValue] = useState<string>("")
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [departmentOpen, setDepartmentOpen] = useState(false)
  const [departmentSearch, setDepartmentSearch] = useState("")

  const handleConfirm = () => {
    if (actionType === "edit_languages" || actionType === "review_languages") {
      if (selectedLanguages.length > 0) {
        onConfirm(actionType, selectedLanguages)
        setSelectedLanguages([])
        onClose()
      }
    } else if (selectedValue && actionType) {
      onConfirm(actionType, selectedValue)
      setSelectedValue("")
      onClose()
    }
  }

  const filteredDepartments = departments.filter(
    (dept) =>
      dept.name.toLowerCase().includes(departmentSearch.toLowerCase()) ||
      dept.code.toLowerCase().includes(departmentSearch.toLowerCase())
  )

  const getTitle = () => {
    switch (actionType) {
      case "status":
        return "사용자 상태 일괄 변경"
      case "role":
        return "사용자 역할 일괄 변경"
      case "department":
        return "사용자 부서 일괄 변경"
      case "edit_languages":
        return "편집 언어 일괄 변경"
      case "review_languages":
        return "검수 언어 일괄 변경"
      default:
        return "일괄 작업"
    }
  }

  const getDescription = () => {
    switch (actionType) {
      case "status":
        return `선택된 ${userCount}명의 사용자 상태를 변경합니다.`
      case "role":
        return `선택된 ${userCount}명의 사용자 역할을 변경합니다.`
      case "department":
        return `선택된 ${userCount}명의 사용자 부서를 변경합니다.`
      case "edit_languages":
        return `선택된 ${userCount}명의 편집 언어를 변경합니다.`
      case "review_languages":
        return `선택된 ${userCount}명의 검수 언어를 변경합니다.`
      default:
        return ""
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {actionType === "status" && (
            <div className="space-y-2">
              <Label>변경할 상태</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="inactive">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === "role" && (
            <div className="space-y-2">
              <Label>변경할 역할</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger>
                  <SelectValue placeholder="역할 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="internal_reviewer">내부 검수자</SelectItem>
                  <SelectItem value="external_reviewer">외부 검수자</SelectItem>
                  <SelectItem value="user">사용자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === "department" && (
            <div className="space-y-2">
              <Label>변경할 부서</Label>
              <Popover open={departmentOpen} onOpenChange={setDepartmentOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={departmentOpen}
                    className="w-full justify-between"
                  >
                    {selectedValue
                      ? departments.find((dept) => dept.id === selectedValue)?.name
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
                              setSelectedValue(currentValue === selectedValue ? "" : currentValue)
                              setDepartmentOpen(false)
                              setDepartmentSearch("")
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedValue === dept.id ? "opacity-100" : "opacity-0"
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
          )}

          {actionType === "edit_languages" && (
            <div className="space-y-2">
              <Label>편집 권한 언어</Label>
              <MultiSelectCombobox
                options={languages
                  .filter((lang) => lang.is_active)
                  .map((lang) => ({
                    value: lang.code,
                    label: lang.name,
                    sublabel: lang.code,
                  }))}
                value={selectedLanguages}
                onValueChange={setSelectedLanguages}
                placeholder="언어 선택..."
                searchPlaceholder="언어 검색..."
                emptyText="언어를 찾을 수 없습니다."
              />
            </div>
          )}

          {actionType === "review_languages" && (
            <div className="space-y-2">
              <Label>검수 권한 언어</Label>
              <MultiSelectCombobox
                options={languages
                  .filter((lang) => lang.is_active)
                  .map((lang) => ({
                    value: lang.code,
                    label: lang.name,
                    sublabel: lang.code,
                  }))}
                value={selectedLanguages}
                onValueChange={setSelectedLanguages}
                placeholder="언어 선택..."
                searchPlaceholder="언어 검색..."
                emptyText="언어를 찾을 수 없습니다."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              actionType === "edit_languages" || actionType === "review_languages"
                ? selectedLanguages.length === 0
                : !selectedValue
            }
          >
            변경
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
