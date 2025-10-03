import { Plus, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Lead, LeadStatus } from "@/lib/api/types/lead"
import type {
  ContactType,
  LeadContact,
  LeadSocialMedia,
  SocialMediaPlatform,
} from "@/lib/api/types/lead-detail"

interface LeadFormData extends Omit<Partial<Lead>, "leadScore" | "contacts" | "socialMedia"> {
  leadScore?: number
  contacts?: LeadContact[]
  socialMedia?: LeadSocialMedia[]
  workspaceId?: string
}

interface LeadFormProps {
  lead?: Lead
  isEdit?: boolean
  workspaceId?: string
  customerGroups?: Array<{ id: string; name: string }>
  selectedGroup?: string
  onGroupChange?: (groupId: string) => void
  onSave: (leadData: LeadFormData) => Promise<void> | void
  onCancel: () => void
}

export function LeadForm({
  lead,
  isEdit = false,
  workspaceId,
  customerGroups = [],
  selectedGroup = "",
  onGroupChange,
  onSave,
  onCancel,
}: LeadFormProps) {
  const companyNameId = useId()
  const foundCompanyNameId = useId()
  const websiteUrlId = useId()
  const businessTypeId = useId()
  const countryId = useId()
  const cityId = useId()
  const addressId = useId()
  const descriptionId = useId()
  const notesId = useId()
  const leadScoreId = useId()

  const [formData, setFormData] = useState({
    companyName: lead?.companyName || "",
    foundCompanyName: lead?.foundCompanyName || "",
    websiteUrl: lead?.websiteUrl || "",
    finalUrl: lead?.finalUrl || "",
    businessType: lead?.businessType || "",
    leadStatus: lead?.leadStatus || ("new" as LeadStatus),
    country: lead?.country || "",
    city: lead?.city || "",
    address: lead?.address || "",
    description: lead?.description || "",
    notes: lead?.notes || "",
    leadScore: lead?.leadScore?.toString() || "",
    leadSource: lead?.leadSource || "",
  })

  const [contacts, setContacts] = useState<Partial<LeadContact>[]>(
    lead?.contacts && lead.contacts.length > 0 ? lead.contacts : [],
  )

  const [socialMedia, setSocialMedia] = useState<Partial<LeadSocialMedia>[]>(
    lead?.socialMedia && lead.socialMedia.length > 0 ? lead.socialMedia : [],
  )

  const finalUrlId = useId()
  const leadSourceId = useId()
  const customerGroupId = useId()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submitData: LeadFormData = {
      ...formData,
      leadScore: formData.leadScore ? parseInt(formData.leadScore, 10) : undefined,
      contacts: contacts.filter(
        (c) => c.contactValue && c.contactValue.trim() !== "",
      ) as LeadContact[],
      socialMedia: socialMedia.filter((s) => s.url && s.url.trim() !== "") as LeadSocialMedia[],
    }

    // Add workspaceId for create mode
    if (!isEdit && workspaceId) {
      submitData.workspaceId = workspaceId
    }

    onSave(submitData)
  }

  const addContact = () => {
    setContacts([
      ...contacts,
      {
        contactType: "email" as ContactType,
        contactValue: "",
        isPrimary: false,
      },
    ])
  }

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index))
  }

  const updateContact = (index: number, field: keyof LeadContact, value: string | boolean) => {
    const updated = [...contacts]
    updated[index] = { ...updated[index], [field]: value }
    setContacts(updated)
  }

  const addSocialMedia = () => {
    setSocialMedia([
      ...socialMedia,
      { platform: "facebook" as SocialMediaPlatform, url: "", username: "" },
    ])
  }

  const removeSocialMedia = (index: number) => {
    setSocialMedia(socialMedia.filter((_, i) => i !== index))
  }

  const updateSocialMedia = (index: number, field: keyof LeadSocialMedia, value: string) => {
    const updated = [...socialMedia]
    updated[index] = { ...updated[index], [field]: value }
    setSocialMedia(updated)
  }

  const statusOptions: { value: LeadStatus; label: string }[] = [
    { value: "new", label: "신규" },
    { value: "contacted", label: "연락됨" },
    { value: "qualified", label: "적격" },
    { value: "unqualified", label: "부적격" },
    { value: "converted", label: "전환됨" },
    { value: "lost", label: "실패" },
    { value: "unsubscribed", label: "구독취소" },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor={companyNameId}>회사명</Label>
          <Input
            id={companyNameId}
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            placeholder="회사명 입력"
          />
        </div>

        {/* Found Company Name */}
        <div className="space-y-2">
          <Label htmlFor={foundCompanyNameId}>발견된 회사명</Label>
          <Input
            id={foundCompanyNameId}
            value={formData.foundCompanyName}
            onChange={(e) => setFormData({ ...formData, foundCompanyName: e.target.value })}
            placeholder="발견된 회사명"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Website URL */}
        <div className="space-y-2">
          <Label htmlFor={websiteUrlId}>웹사이트 URL</Label>
          <Input
            id={websiteUrlId}
            type="url"
            value={formData.websiteUrl}
            onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
            placeholder="https://example.com"
          />
        </div>

        {/* Final URL */}
        <div className="space-y-2">
          <Label htmlFor={finalUrlId}>최종 URL</Label>
          <Input
            id={finalUrlId}
            type="url"
            value={formData.finalUrl}
            onChange={(e) => setFormData({ ...formData, finalUrl: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Business Type */}
        <div className="space-y-2">
          <Label htmlFor={businessTypeId}>업종</Label>
          <Input
            id={businessTypeId}
            value={formData.businessType}
            onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
            placeholder="예: IT, 제조업, 서비스업"
          />
        </div>

        {/* Lead Status */}
        <div className="space-y-2">
          <Label htmlFor="leadStatus">리드 상태</Label>
          <Select
            value={formData.leadStatus}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                leadStatus: value as LeadStatus,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Country */}
        <div className="space-y-2">
          <Label htmlFor={countryId}>국가</Label>
          <Input
            id={countryId}
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            placeholder="예: 대한민국"
          />
        </div>

        {/* City */}
        <div className="space-y-2">
          <Label htmlFor={cityId}>도시</Label>
          <Input
            id={cityId}
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="예: 서울"
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor={addressId}>주소</Label>
        <Input
          id={addressId}
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="상세 주소 입력"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Lead Score */}
        <div className="space-y-2">
          <Label htmlFor={leadScoreId}>리드 점수</Label>
          <Input
            id={leadScoreId}
            type="number"
            min="0"
            max="100"
            value={formData.leadScore}
            onChange={(e) => setFormData({ ...formData, leadScore: e.target.value })}
            placeholder="0-100"
          />
        </div>

        {/* Lead Source */}
        <div className="space-y-2">
          <Label htmlFor={leadSourceId}>리드 소스</Label>
          <Input
            id={leadSourceId}
            value={formData.leadSource}
            onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
            placeholder="예: 웹사이트, 추천, 광고"
          />
        </div>
      </div>

      {/* Customer Group Selection (only for create mode) */}
      {!isEdit && customerGroups.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={customerGroupId}>고객 그룹 (선택사항)</Label>
          <Select value={selectedGroup || undefined} onValueChange={onGroupChange}>
            <SelectTrigger id={customerGroupId}>
              <SelectValue placeholder="그룹을 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">그룹 없음</SelectItem>
              {customerGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor={descriptionId}>설명</Label>
        <Textarea
          id={descriptionId}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="회사 설명 입력..."
          rows={3}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor={notesId}>노트</Label>
        <Textarea
          id={notesId}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="추가 메모 입력..."
          rows={3}
        />
      </div>

      {/* Contacts Section */}
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">연락처</Label>
          <Button type="button" size="sm" variant="outline" onClick={addContact}>
            <Plus className="h-4 w-4 mr-1" />
            연락처 추가
          </Button>
        </div>
        {contacts.map((contact, index) => (
          <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-gray-50">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">타입</Label>
                <Select
                  value={contact.contactType || "email"}
                  onValueChange={(value) =>
                    updateContact(index, "contactType", value as ContactType)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">전화</SelectItem>
                    <SelectItem value="email">이메일</SelectItem>
                    <SelectItem value="fax">팩스</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">값</Label>
                <Input
                  className="h-9"
                  value={contact.contactValue || ""}
                  onChange={(e) => updateContact(index, "contactValue", e.target.value)}
                  placeholder="연락처 입력"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">라벨</Label>
                <Input
                  className="h-9"
                  value={contact.label || ""}
                  onChange={(e) => updateContact(index, "label", e.target.value)}
                  placeholder="예: 주연락처"
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeContact(index)}
              className="mt-6 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Social Media Section */}
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">소셜 미디어</Label>
          <Button type="button" size="sm" variant="outline" onClick={addSocialMedia}>
            <Plus className="h-4 w-4 mr-1" />
            SNS 추가
          </Button>
        </div>
        {socialMedia.map((social, index) => (
          <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-gray-50">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">플랫폼</Label>
                <Select
                  value={social.platform || "facebook"}
                  onValueChange={(value) =>
                    updateSocialMedia(index, "platform", value as SocialMediaPlatform)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL</Label>
                <Input
                  className="h-9"
                  value={social.url || ""}
                  onChange={(e) => updateSocialMedia(index, "url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">사용자명</Label>
                <Input
                  className="h-9"
                  value={social.username || ""}
                  onChange={(e) => updateSocialMedia(index, "username", e.target.value)}
                  placeholder="@username"
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeSocialMedia(index)}
              className="mt-6 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
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
