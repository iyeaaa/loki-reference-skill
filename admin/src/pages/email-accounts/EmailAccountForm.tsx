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
import type { EmailAccountStatus, UserEmailAccount } from "@/lib/api/types/email-account"
import type { Workspace } from "@/lib/api/types/workspace"

interface EmailAccountFormProps {
  account?: UserEmailAccount
  isEdit?: boolean
  workspaces: Workspace[]
  onSave: (accountData: unknown) => Promise<void> | void
  onCancel: () => void
}

export function EmailAccountForm({
  account,
  isEdit = false,
  workspaces = [],
  onSave,
  onCancel,
}: EmailAccountFormProps) {
  const emailId = useId()
  const displayNameId = useId()
  const apiKeyId = useId()
  const sendgridVerifiedSenderIdId = useId()
  const dailyLimitId = useId()
  const monthlyLimitId = useId()
  const isDefaultId = useId()

  const [formData, setFormData] = useState({
    emailAddress: account?.emailAddress || "",
    displayName: account?.displayName || "",
    workspaceId: account?.workspaceId || "",
    apiKey: account?.apiKey || "",
    sendgridVerifiedSenderId: account?.sendgridVerifiedSenderId || "",
    status: (account?.status || "inactive") as EmailAccountStatus,
    isDefault: account?.isDefault ?? false,
    dailyLimit: account?.dailyLimit?.toString() || "",
    monthlyLimit: account?.monthlyLimit?.toString() || "",
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

    const dataToSend = {
      emailAddress: formData.emailAddress,
      displayName: formData.displayName || undefined,
      workspaceId: formData.workspaceId,
      apiKey: formData.apiKey,
      sendgridVerifiedSenderId: formData.sendgridVerifiedSenderId || undefined,
      status: formData.status,
      isDefault: formData.isDefault,
      dailyLimit: formData.dailyLimit ? parseInt(formData.dailyLimit, 10) : undefined,
      monthlyLimit: formData.monthlyLimit ? parseInt(formData.monthlyLimit, 10) : undefined,
    }

    onSave(dataToSend)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={emailId}>이메일 주소 *</Label>
        <Input
          id={emailId}
          type="email"
          value={formData.emailAddress}
          onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={displayNameId}>표시 이름</Label>
        <Input
          id={displayNameId}
          value={formData.displayName}
          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
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
      </div>

      <div className="space-y-2">
        <Label htmlFor={apiKeyId}>SendGrid API Key *</Label>
        <Input
          id={apiKeyId}
          type="password"
          value={formData.apiKey}
          onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
          required
          placeholder="SG.****"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={sendgridVerifiedSenderIdId}>SendGrid Verified Sender ID</Label>
        <Input
          id={sendgridVerifiedSenderIdId}
          value={formData.sendgridVerifiedSenderId}
          onChange={(e) => setFormData({ ...formData, sendgridVerifiedSenderId: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">상태</Label>
        <Select
          value={formData.status}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              status: value as EmailAccountStatus,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="inactive">비활성</SelectItem>
            <SelectItem value="error">오류</SelectItem>
            <SelectItem value="rate_limited">제한됨</SelectItem>
            <SelectItem value="suspended">정지됨</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={dailyLimitId}>일일 발송 제한</Label>
          <Input
            id={dailyLimitId}
            type="number"
            min="0"
            value={formData.dailyLimit}
            onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
            placeholder="무제한"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={monthlyLimitId}>월별 발송 제한</Label>
          <Input
            id={monthlyLimitId}
            type="number"
            min="0"
            value={formData.monthlyLimit}
            onChange={(e) => setFormData({ ...formData, monthlyLimit: e.target.value })}
            placeholder="무제한"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id={isDefaultId}
          checked={formData.isDefault}
          onCheckedChange={(checked) => setFormData({ ...formData, isDefault: !!checked })}
        />
        <Label htmlFor={isDefaultId}>기본 계정으로 설정</Label>
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
