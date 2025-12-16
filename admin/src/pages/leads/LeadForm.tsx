import { useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
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
import { customerGroupKeys } from "@/lib/api/hooks/customer-groups"
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
  customerGroupId?: string
}

type LeadFormProps = {
  lead?: Lead
  isEdit?: boolean
  workspaceId?: string
  customerGroups?: Array<{ id: string; name: string }>
  selectedGroup?: string
  onGroupChange?: (groupId: string) => void
  onSave: (leadData: LeadFormData) => Promise<void> | void
  onCancel: () => void
  submitButtonText?: string
  cancelButtonText?: string
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
  submitButtonText,
  cancelButtonText,
}: LeadFormProps) {
  const { t } = useTranslation()
  const companyNameId = useId()
  const foundCompanyNameId = useId()
  const contactNameId = useId()
  const websiteUrlId = useId()
  const businessTypeId = useId()
  const countryId = useId()
  const cityId = useId()
  const addressId = useId()
  const descriptionId = useId()
  const notesId = useId()
  const leadScoreId = useId()

  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    companyName: lead?.companyName || "",
    foundCompanyName: lead?.foundCompanyName || "",
    contactName: lead?.contactName || "",
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

  const [contacts, setContacts] = useState<(Partial<LeadContact> & { tempId: string })[]>(
    lead?.contacts && lead.contacts.length > 0
      ? lead.contacts.map((c) => ({ ...c, tempId: c.id || crypto.randomUUID() }))
      : [
          {
            contactType: "email" as ContactType,
            contactValue: "",
            isPrimary: true,
            tempId: crypto.randomUUID(),
          },
        ],
  )

  const [socialMedia, setSocialMedia] = useState<(Partial<LeadSocialMedia> & { tempId: string })[]>(
    lead?.socialMedia && lead.socialMedia.length > 0
      ? lead.socialMedia.map((s) => ({ ...s, tempId: s.id || crypto.randomUUID() }))
      : [],
  )

  const finalUrlId = useId()
  const leadSourceId = useId()
  const customerGroupId = useId()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 유효한 연락처 필터링 및 첫 번째 연락처에 isPrimary 설정
    const validContacts = contacts
      .filter((c) => c.contactValue && c.contactValue.trim() !== "" && c.contactType !== undefined)
      .map((c, index) => {
        const { tempId: _tempId, ...contactData } = c
        return {
          ...contactData,
          label:
            contactData.label && contactData.label.trim() !== "" ? contactData.label : undefined,
          contactName:
            (contactData as { contactName?: string }).contactName &&
            (contactData as { contactName?: string }).contactName?.trim() !== ""
              ? (contactData as { contactName?: string }).contactName
              : undefined,
          isPrimary: index === 0 ? true : contactData.isPrimary,
        }
      }) as LeadContact[]

    // 이메일 필수 검증
    const hasEmail = validContacts.some((c) => c.contactType === "email")
    if (!hasEmail) {
      toast.error("이메일 주소는 필수 입력 항목입니다. 최소 1개 이상의 이메일을 입력해주세요.")
      return
    }

    const submitData: LeadFormData = {
      ...formData,
      leadScore: formData.leadScore ? Number.parseInt(formData.leadScore, 10) : undefined,
      contacts: validContacts,
      socialMedia: socialMedia
        .filter((s) => s.url && s.url.trim() !== "" && s.platform !== undefined)
        .map((s) => {
          const { tempId: _tempId, ...socialData } = s
          return {
            ...socialData,
            username:
              socialData.username && socialData.username.trim() !== ""
                ? socialData.username
                : undefined,
          }
        }) as LeadSocialMedia[],
    }

    // Add workspaceId and customerGroupId for create mode
    if (!isEdit && workspaceId) {
      submitData.workspaceId = workspaceId
      if (selectedGroup) {
        submitData.customerGroupId = selectedGroup
      }
    }
    queryClient.invalidateQueries({
      queryKey: customerGroupKeys.workspace(workspaceId || ""),
    })

    onSave(submitData)
  }

  const addContact = () => {
    setContacts([
      ...contacts,
      {
        contactType: "email" as ContactType,
        contactValue: "",
        isPrimary: false,
        tempId: crypto.randomUUID(),
      },
    ])
  }

  const removeContact = (index: number) => {
    // 최소 1개의 이메일은 남아있어야 함
    const remainingContacts = contacts.filter((_, i) => i !== index)
    const hasEmail = remainingContacts.some((c) => c.contactType === "email")

    if (!hasEmail) {
      toast.error("최소 1개 이상의 이메일 연락처가 필요합니다.")
      return
    }

    setContacts(remainingContacts)
  }

  const updateContact = (index: number, field: keyof LeadContact, value: string | boolean) => {
    const updated = [...contacts]
    updated[index] = { ...updated[index], [field]: value }

    // contactType을 변경할 때, 이메일이 최소 1개는 남아있는지 확인
    if (field === "contactType" && value !== "email") {
      const hasOtherEmail = updated.some(
        (c, i) =>
          i !== index &&
          c.contactType === "email" &&
          c.contactValue &&
          c.contactValue.trim() !== "",
      )

      if (!hasOtherEmail) {
        toast.error("최소 1개 이상의 이메일 연락처가 필요합니다.")
        return
      }
    }

    setContacts(updated)
  }

  const addSocialMedia = () => {
    setSocialMedia([
      ...socialMedia,
      {
        platform: "facebook" as SocialMediaPlatform,
        url: "",
        username: "",
        tempId: crypto.randomUUID(),
      },
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
    { value: "new", label: t("leads.form.status.new") },
    { value: "contacted", label: t("leads.form.status.contacted") },
    { value: "qualified", label: t("leads.form.status.qualified") },
    { value: "unqualified", label: t("leads.form.status.unqualified") },
    { value: "converted", label: t("leads.form.status.converted") },
    { value: "lost", label: t("leads.form.status.lost") },
    { value: "unsubscribed", label: t("leads.form.status.unsubscribed") },
  ]

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4">
        {/* Company Name */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1" htmlFor={companyNameId}>
            {t("leads.form.companyName")}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id={companyNameId}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            placeholder={t("leads.form.companyNameRequired")}
            required
            value={formData.companyName}
          />
        </div>

        {/* Found Company Name */}
        <div className="space-y-2">
          <Label htmlFor={foundCompanyNameId}>{t("leads.form.foundCompanyName")}</Label>
          <Input
            id={foundCompanyNameId}
            onChange={(e) => setFormData({ ...formData, foundCompanyName: e.target.value })}
            placeholder={t("leads.form.foundCompanyNamePlaceholder")}
            value={formData.foundCompanyName}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Contact Name */}
        <div className="space-y-2">
          <Label htmlFor={contactNameId}>{t("leads.form.contactName")}</Label>
          <Input
            id={contactNameId}
            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            placeholder={t("leads.form.contactNamePlaceholder")}
            value={formData.contactName}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Website URL */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1" htmlFor={websiteUrlId}>
            {t("leads.form.websiteUrl")}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id={websiteUrlId}
            onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
            placeholder={t("leads.form.websiteUrlPlaceholder")}
            required
            type="url"
            value={formData.websiteUrl}
          />
        </div>

        {/* Final URL */}
        <div className="space-y-2">
          <Label htmlFor={finalUrlId}>{t("leads.form.finalUrl")}</Label>
          <Input
            id={finalUrlId}
            onChange={(e) => setFormData({ ...formData, finalUrl: e.target.value })}
            placeholder={t("leads.form.finalUrlPlaceholder")}
            type="url"
            value={formData.finalUrl}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Business Type */}
        <div className="space-y-2">
          <Label htmlFor={businessTypeId}>{t("leads.form.businessType")}</Label>
          <Input
            id={businessTypeId}
            onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
            placeholder={t("leads.form.businessTypePlaceholder")}
            value={formData.businessType}
          />
        </div>

        {/* Lead Status */}
        <div className="space-y-2">
          <Label htmlFor="leadStatus">{t("leads.form.leadStatus")}</Label>
          <Select
            onValueChange={(value) =>
              setFormData({
                ...formData,
                leadStatus: value as LeadStatus,
              })
            }
            value={formData.leadStatus}
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
          <Label htmlFor={countryId}>{t("leads.form.country")}</Label>
          <Input
            id={countryId}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            placeholder={t("leads.form.countryPlaceholder")}
            value={formData.country}
          />
        </div>

        {/* City */}
        <div className="space-y-2">
          <Label htmlFor={cityId}>{t("leads.form.city")}</Label>
          <Input
            id={cityId}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder={t("leads.form.cityPlaceholder")}
            value={formData.city}
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor={addressId}>{t("leads.form.address")}</Label>
        <Input
          id={addressId}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder={t("leads.form.addressPlaceholder")}
          value={formData.address}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Lead Score */}
        <div className="space-y-2">
          <Label htmlFor={leadScoreId}>{t("leads.form.leadScore")}</Label>
          <Input
            id={leadScoreId}
            max="100"
            min="0"
            onChange={(e) => setFormData({ ...formData, leadScore: e.target.value })}
            placeholder={t("leads.form.leadScorePlaceholder")}
            type="number"
            value={formData.leadScore}
          />
        </div>

        {/* Lead Source */}
        <div className="space-y-2">
          <Label htmlFor={leadSourceId}>{t("leads.form.leadSource")}</Label>
          <Input
            id={leadSourceId}
            onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
            placeholder={t("leads.form.leadSourcePlaceholder")}
            value={formData.leadSource}
          />
        </div>
      </div>

      {/* Customer Group Selection (only for create mode) */}
      {!isEdit && customerGroups.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={customerGroupId}>{t("leads.form.customerGroup")}</Label>
          <Select onValueChange={onGroupChange} value={selectedGroup || undefined}>
            <SelectTrigger id={customerGroupId}>
              <SelectValue placeholder={t("leads.form.customerGroupPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("leads.form.noGroup")}</SelectItem>
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
        <Label htmlFor={descriptionId}>{t("leads.form.description")}</Label>
        <Textarea
          id={descriptionId}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={t("leads.form.descriptionPlaceholder")}
          rows={3}
          value={formData.description}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor={notesId}>{t("leads.form.notes")}</Label>
        <Textarea
          id={notesId}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder={t("leads.form.notesPlaceholder")}
          rows={3}
          value={formData.notes}
        />
      </div>

      {/* Contacts Section */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="flex items-center gap-1 font-semibold text-base">
              {t("leads.form.contacts")}
            </Label>
            <p className="mt-1 text-muted-foreground text-xs">
              최소 1개 이상의 이메일 주소가 필요합니다 <span className="text-red-500">*</span>
            </p>
          </div>
          <Button onClick={addContact} size="sm" type="button" variant="outline">
            <Plus className="mr-1 h-4 w-4" />
            {t("leads.form.addContact")}
          </Button>
        </div>
        {contacts.map((contact, index) => (
          <div
            className="flex items-start gap-2 rounded-md border bg-gray-50 p-3"
            key={contact.tempId}
          >
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("leads.form.contactTypeLabel")}</Label>
                  <Select
                    onValueChange={(value) =>
                      updateContact(index, "contactType", value as ContactType)
                    }
                    value={contact.contactType || "email"}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">{t("leads.form.contactType.phone")}</SelectItem>
                      <SelectItem value="email">{t("leads.form.contactType.email")}</SelectItem>
                      <SelectItem value="fax">{t("leads.form.contactType.fax")}</SelectItem>
                      <SelectItem value="other">{t("leads.form.contactType.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs">
                    {t("leads.form.contactValue")}
                    {index === 0 && contact.contactType === "email" && (
                      <span className="text-red-500">*</span>
                    )}
                  </Label>
                  <Input
                    className="h-9"
                    onChange={(e) => updateContact(index, "contactValue", e.target.value)}
                    placeholder={
                      index === 0 && contact.contactType === "email"
                        ? t("leads.form.contactValueRequired")
                        : t("leads.form.contactValuePlaceholder")
                    }
                    required={index === 0 && contact.contactType === "email"}
                    value={contact.contactValue || ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("leads.form.contactLabel")}</Label>
                  <Input
                    className="h-9"
                    onChange={(e) => updateContact(index, "label", e.target.value)}
                    placeholder={t("leads.form.contactLabelPlaceholder")}
                    value={contact.label || ""}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {t("leads.form.contactName")}
                  <span className="ml-1 text-muted-foreground">
                    {t("leads.form.contactNameOptional")}
                  </span>
                </Label>
                <Input
                  className="h-9"
                  onChange={(e) =>
                    updateContact(index, "contactName" as keyof LeadContact, e.target.value)
                  }
                  placeholder={t("leads.form.contactNamePlaceholder")}
                  value={(contact as { contactName?: string }).contactName || ""}
                />
              </div>
            </div>
            <Button
              className="mt-6 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => removeContact(index)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Social Media Section */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-base">{t("leads.form.socialMedia")}</Label>
          <Button onClick={addSocialMedia} size="sm" type="button" variant="outline">
            <Plus className="mr-1 h-4 w-4" />
            {t("leads.form.addSocialMedia")}
          </Button>
        </div>
        {socialMedia.map((social, index) => (
          <div
            className="flex items-start gap-2 rounded-md border bg-gray-50 p-3"
            key={social.tempId}
          >
            <div className="grid flex-1 grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("leads.form.platform")}</Label>
                <Select
                  onValueChange={(value) =>
                    updateSocialMedia(index, "platform", value as SocialMediaPlatform)
                  }
                  value={social.platform || "facebook"}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">
                      {t("leads.form.socialPlatform.facebook")}
                    </SelectItem>
                    <SelectItem value="instagram">
                      {t("leads.form.socialPlatform.instagram")}
                    </SelectItem>
                    <SelectItem value="twitter">
                      {t("leads.form.socialPlatform.twitter")}
                    </SelectItem>
                    <SelectItem value="linkedin">
                      {t("leads.form.socialPlatform.linkedin")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("leads.form.url")}</Label>
                <Input
                  className="h-9"
                  onChange={(e) => updateSocialMedia(index, "url", e.target.value)}
                  placeholder={t("leads.form.urlPlaceholder")}
                  value={social.url || ""}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("leads.form.username")}</Label>
                <Input
                  className="h-9"
                  onChange={(e) => updateSocialMedia(index, "username", e.target.value)}
                  placeholder={t("leads.form.usernamePlaceholder")}
                  value={social.username || ""}
                />
              </div>
            </div>
            <Button
              className="mt-6 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => removeSocialMedia(index)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button onClick={onCancel} type="button" variant="outline">
          {cancelButtonText || t("leads.form.cancel")}
        </Button>
        <Button className="min-w-[100px]" type="submit">
          {submitButtonText || (isEdit ? t("leads.form.update") : t("leads.form.save"))}
        </Button>
      </div>
    </form>
  )
}
