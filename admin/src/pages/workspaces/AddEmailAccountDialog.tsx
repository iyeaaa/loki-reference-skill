import { Check, ChevronsUpDown } from "lucide-react"
import { useEffect, useId, useState } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useCreateEmailAccount } from "@/lib/api/hooks/email-accounts"
import { useWorkspaceMembers } from "@/lib/api/hooks/workspaces"

type AddEmailAccountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

export function AddEmailAccountDialog({
  open,
  onOpenChange,
  workspaceId,
}: AddEmailAccountDialogProps) {
  const emailAddressId = useId()
  const displayNameId = useId()
  const apiKeyId = useId()
  const sendgridVerifiedSenderIdId = useId()
  const dailyLimitId = useId()
  const monthlyLimitId = useId()
  const isVerifiedId = useId()
  const isDefaultId = useId()

  const [formData, setFormData] = useState({
    userId: "",
    emailAddress: "",
    displayName: "",
    apiKey: "",
    sendgridVerifiedSenderId: "",
    isVerified: false,
    isDefault: false,
    dailyLimit: "",
    monthlyLimit: "",
    status: "inactive" as "active" | "inactive" | "error" | "rate_limited" | "suspended",
  })

  const [userOpen, setUserOpen] = useState(false)
  const [userSearch, setUserSearch] = useState("")

  const { data: members = [] } = useWorkspaceMembers(workspaceId, !!workspaceId)
  const createEmailAccount = useCreateEmailAccount()

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        userId: "",
        emailAddress: "",
        displayName: "",
        apiKey: "",
        sendgridVerifiedSenderId: "",
        isVerified: false,
        isDefault: false,
        dailyLimit: "",
        monthlyLimit: "",
        status: "inactive",
      })
      setUserSearch("")
    }
  }, [open])

  const filteredMembers = members.filter(
    (member) =>
      member.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
      member.email?.toLowerCase().includes(userSearch.toLowerCase()),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      userId: formData.userId,
      workspaceId,
      emailAddress: formData.emailAddress,
      displayName: formData.displayName || undefined,
      apiKey: formData.apiKey,
      sendgridVerifiedSenderId: formData.sendgridVerifiedSenderId || undefined,
      isVerified: formData.isVerified,
      isDefault: formData.isDefault,
      dailyLimit: formData.dailyLimit ? Number(formData.dailyLimit) : undefined,
      monthlyLimit: formData.monthlyLimit ? Number(formData.monthlyLimit) : undefined,
      status: formData.status,
    }

    createEmailAccount.mutate(payload, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>이메일 계정 추가</DialogTitle>
          <DialogDescription>
            워크스페이스에 새로운 이메일 계정을 등록합니다. 사용자별로 이메일 발송 계정을 설정할 수
            있습니다.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* 사용자 선택 */}
          <div className="space-y-2">
            <Label htmlFor="user">
              사용자 <span className="text-red-500">*</span>
            </Label>
            <Popover onOpenChange={setUserOpen} open={userOpen}>
              <PopoverTrigger asChild>
                <Button
                  aria-expanded={userOpen}
                  className="w-full justify-between font-normal"
                  role="combobox"
                  type="button"
                  variant="outline"
                >
                  {formData.userId
                    ? members.find((member) => member.userId === formData.userId)?.username ||
                      members.find((member) => member.userId === formData.userId)?.email
                    : "사용자 선택"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command className="max-h-[300px]">
                  <CommandInput
                    onValueChange={setUserSearch}
                    placeholder="사용자 검색..."
                    value={userSearch}
                  />
                  <CommandList>
                    <CommandEmpty>사용자를 찾을 수 없습니다.</CommandEmpty>
                    <CommandGroup>
                      {filteredMembers.map((member) => (
                        <CommandItem
                          key={member.userId}
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              userId: member.userId,
                            })
                            setUserOpen(false)
                            setUserSearch("")
                          }}
                          value={`${member.username} ${member.email}`}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              formData.userId === member.userId ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          <div className="flex flex-col">
                            <span>{member.username}</span>
                            <span className="text-gray-500 text-xs">{member.email}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-muted-foreground text-xs">
              이 사용자가 이메일 발송 시 사용할 계정입니다
            </p>
          </div>

          {/* 이메일 주소 */}
          <div className="space-y-2">
            <Label htmlFor={emailAddressId}>
              이메일 주소 <span className="text-red-500">*</span>
            </Label>
            <Input
              id={emailAddressId}
              onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
              placeholder="sender@example.com"
              required
              type="email"
              value={formData.emailAddress}
            />
          </div>

          {/* 표시 이름 */}
          <div className="space-y-2">
            <Label htmlFor={displayNameId}>표시 이름</Label>
            <Input
              id={displayNameId}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="발신자 이름"
              value={formData.displayName}
            />
            <p className="text-muted-foreground text-xs">
              수신자에게 표시될 발신자 이름 (선택사항)
            </p>
          </div>

          {/* SendGrid API Key */}
          <div className="space-y-2">
            <Label htmlFor={apiKeyId}>
              SendGrid API Key <span className="text-red-500">*</span>
            </Label>
            <Input
              id={apiKeyId}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="SG.xxxxxxxxxxxxxxxxxx"
              required
              type="password"
              value={formData.apiKey}
            />
          </div>

          {/* SendGrid Verified Sender ID */}
          <div className="space-y-2">
            <Label htmlFor={sendgridVerifiedSenderIdId}>SendGrid Verified Sender ID</Label>
            <Input
              id={sendgridVerifiedSenderIdId}
              onChange={(e) =>
                setFormData({ ...formData, sendgridVerifiedSenderId: e.target.value })
              }
              placeholder="Verified Sender ID (선택사항)"
              value={formData.sendgridVerifiedSenderId}
            />
          </div>

          {/* 일일 발송 제한 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={dailyLimitId}>일일 발송 제한</Label>
              <Input
                id={dailyLimitId}
                min="0"
                onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
                placeholder="예: 500"
                type="number"
                value={formData.dailyLimit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={monthlyLimitId}>월간 발송 제한</Label>
              <Input
                id={monthlyLimitId}
                min="0"
                onChange={(e) => setFormData({ ...formData, monthlyLimit: e.target.value })}
                placeholder="예: 10000"
                type="number"
                value={formData.monthlyLimit}
              />
            </div>
          </div>

          {/* 상태 */}
          <div className="space-y-2">
            <Label htmlFor="status">
              상태 <span className="text-red-500">*</span>
            </Label>
            <Select
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  status: value as typeof formData.status,
                })
              }
              value={formData.status}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">활성</SelectItem>
                <SelectItem value="inactive">비활성</SelectItem>
                <SelectItem value="error">오류</SelectItem>
                <SelectItem value="rate_limited">전송제한</SelectItem>
                <SelectItem value="suspended">중단됨</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 체크박스들 */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.isVerified}
                id={isVerifiedId}
                onCheckedChange={(checked) => setFormData({ ...formData, isVerified: !!checked })}
              />
              <Label className="font-normal" htmlFor={isVerifiedId}>
                이메일 주소 인증됨
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.isDefault}
                id={isDefaultId}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: !!checked })}
              />
              <Label className="font-normal" htmlFor={isDefaultId}>
                이 사용자의 기본 계정으로 설정
              </Label>
            </div>
          </div>

          {/* 버튼들 */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              취소
            </Button>
            <Button
              disabled={
                !(formData.userId && formData.emailAddress && formData.apiKey) ||
                createEmailAccount.isPending
              }
              type="submit"
            >
              {createEmailAccount.isPending ? "추가 중..." : "추가"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
