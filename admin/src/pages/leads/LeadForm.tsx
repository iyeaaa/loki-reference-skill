import { useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useId, useState } from "react"
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

    // 유효한 연락처 필터링 및 첫 번째 연락처에 isPrimary 설정
    const validContacts = contacts
      .filter((c) => c.contactValue && c.contactValue.trim() !== "" && c.contactType !== undefined)
      .map((c, index) => ({
        ...c,
        label: c.label && c.label.trim() !== "" ? c.label : undefined,
        contactName:
          (c as { contactName?: string }).contactName &&
          (c as { contactName?: string }).contactName?.trim() !== ""
            ? (c as { contactName?: string }).contactName
            : undefined,
        isPrimary: index === 0 ? true : c.isPrimary || false,
      })) as LeadContact[]

    const submitData: LeadFormData = {
      ...formData,
      leadScore: formData.leadScore ? parseInt(formData.leadScore, 10) : undefined,
      contacts: validContacts,
      socialMedia: socialMedia
        .filter((s) => s.url && s.url.trim() !== "" && s.platform !== undefined)
        .map((s) => ({
          ...s,
          username: s.username && s.username.trim() !== "" ? s.username : undefined,
        })) as LeadSocialMedia[],
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
    { value: "new", label: t("leads.form.status.new") },
    { value: "contacted", label: t("leads.form.status.contacted") },
    { value: "qualified", label: t("leads.form.status.qualified") },
    { value: "unqualified", label: t("leads.form.status.unqualified") },
    { value: "converted", label: t("leads.form.status.converted") },
    { value: "lost", label: t("leads.form.status.lost") },
    { value: "unsubscribed", label: t("leads.form.status.unsubscribed") },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor={companyNameId} className="flex items-center gap-1">
            {t("leads.form.companyName")}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id={companyNameId}
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            placeholder={t("leads.form.companyNameRequired")}
            required
          />
        </div>

        {/* Found Company Name */}
        <div className="space-y-2">
          <Label htmlFor={foundCompanyNameId}>{t("leads.form.foundCompanyName")}</Label>
          <Input
            id={foundCompanyNameId}
            value={formData.foundCompanyName}
            onChange={(e) => setFormData({ ...formData, foundCompanyName: e.target.value })}
            placeholder={t("leads.form.foundCompanyNamePlaceholder")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Contact Name */}
        <div className="space-y-2">
          <Label htmlFor={contactNameId}>{t("leads.form.contactName")}</Label>
          <Input
            id={contactNameId}
            value={formData.contactName}
            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            placeholder={t("leads.form.contactNamePlaceholder")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Website URL */}
        <div className="space-y-2">
          <Label htmlFor={websiteUrlId} className="flex items-center gap-1">
            {t("leads.form.websiteUrl")}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id={websiteUrlId}
            type="url"
            value={formData.websiteUrl}
            onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
            placeholder={t("leads.form.websiteUrlPlaceholder")}
            required
          />
        </div>

        {/* Final URL */}
        <div className="space-y-2">
          <Label htmlFor={finalUrlId}>{t("leads.form.finalUrl")}</Label>
          <Input
            id={finalUrlId}
            type="url"
            value={formData.finalUrl}
            onChange={(e) => setFormData({ ...formData, finalUrl: e.target.value })}
            placeholder={t("leads.form.finalUrlPlaceholder")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Business Type */}
        <div className="space-y-2">
          <Label htmlFor={businessTypeId}>{t("leads.form.businessType")}</Label>
          <Input
            id={businessTypeId}
            value={formData.businessType}
            onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
            placeholder={t("leads.form.businessTypePlaceholder")}
          />
        </div>

        {/* Lead Status */}
        <div className="space-y-2">
          <Label htmlFor="leadStatus">{t("leads.form.leadStatus")}</Label>
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
          <Label htmlFor={countryId}>{t("leads.form.country")}</Label>
          <Input
            id={countryId}
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            placeholder={t("leads.form.countryPlaceholder")}
          />
        </div>

        {/* City */}
        <div className="space-y-2">
          <Label htmlFor={cityId}>{t("leads.form.city")}</Label>
          <Input
            id={cityId}
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder={t("leads.form.cityPlaceholder")}
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor={addressId}>{t("leads.form.address")}</Label>
        <Input
          id={addressId}
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder={t("leads.form.addressPlaceholder")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Lead Score */}
        <div className="space-y-2">
          <Label htmlFor={leadScoreId}>{t("leads.form.leadScore")}</Label>
          <Input
            id={leadScoreId}
            type="number"
            min="0"
            max="100"
            value={formData.leadScore}
            onChange={(e) => setFormData({ ...formData, leadScore: e.target.value })}
            placeholder={t("leads.form.leadScorePlaceholder")}
          />
        </div>

        {/* Lead Source */}
        <div className="space-y-2">
          <Label htmlFor={leadSourceId}>{t("leads.form.leadSource")}</Label>
          <Input
            id={leadSourceId}
            value={formData.leadSource}
            onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
            placeholder={t("leads.form.leadSourcePlaceholder")}
          />
        </div>
      </div>

      {/* Customer Group Selection (only for create mode) */}
      {!isEdit && customerGroups.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={customerGroupId}>{t("leads.form.customerGroup")}</Label>
          <Select value={selectedGroup || undefined} onValueChange={onGroupChange}>
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
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={t("leads.form.descriptionPlaceholder")}
          rows={3}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor={notesId}>{t("leads.form.notes")}</Label>
        <Textarea
          id={notesId}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder={t("leads.form.notesPlaceholder")}
          rows={3}
        />
      </div>

      {/* Contacts Section */}
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">{t("leads.form.contacts")}</Label>
          <Button type="button" size="sm" variant="outline" onClick={addContact}>
            <Plus className="h-4 w-4 mr-1" />
            {t("leads.form.addContact")}
          </Button>
        </div>
        {contacts.map((contact, index) => (
          <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-gray-50">
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("leads.form.contactTypeLabel")}</Label>
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
                      <SelectItem value="phone">{t("leads.form.contactType.phone")}</SelectItem>
                      <SelectItem value="email">{t("leads.form.contactType.email")}</SelectItem>
                      <SelectItem value="fax">{t("leads.form.contactType.fax")}</SelectItem>
                      <SelectItem value="other">{t("leads.form.contactType.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    {t("leads.form.contactValue")}
                    {index === 0 && contact.contactType === "email" && (
                      <span className="text-red-500">*</span>
                    )}
                  </Label>
                  <Input
                    className="h-9"
                    value={contact.contactValue || ""}
                    onChange={(e) => updateContact(index, "contactValue", e.target.value)}
                    placeholder={
                      index === 0 && contact.contactType === "email"
                        ? t("leads.form.contactValueRequired")
                        : t("leads.form.contactValuePlaceholder")
                    }
                    required={index === 0 && contact.contactType === "email"}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("leads.form.contactLabel")}</Label>
                  <Input
                    className="h-9"
                    value={contact.label || ""}
                    onChange={(e) => updateContact(index, "label", e.target.value)}
                    placeholder={t("leads.form.contactLabelPlaceholder")}
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
                  value={(contact as { contactName?: string }).contactName || ""}
                  onChange={(e) =>
                    updateContact(index, "contactName" as keyof LeadContact, e.target.value)
                  }
                  placeholder={t("leads.form.contactNamePlaceholder")}
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
          <Label className="text-base font-semibold">{t("leads.form.socialMedia")}</Label>
          <Button type="button" size="sm" variant="outline" onClick={addSocialMedia}>
            <Plus className="h-4 w-4 mr-1" />
            {t("leads.form.addSocialMedia")}
          </Button>
        </div>
        {socialMedia.map((social, index) => (
          <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-gray-50">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("leads.form.platform")}</Label>
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
                  value={social.url || ""}
                  onChange={(e) => updateSocialMedia(index, "url", e.target.value)}
                  placeholder={t("leads.form.urlPlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("leads.form.username")}</Label>
                <Input
                  className="h-9"
                  value={social.username || ""}
                  onChange={(e) => updateSocialMedia(index, "username", e.target.value)}
                  placeholder={t("leads.form.usernamePlaceholder")}
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
          {t("leads.form.cancel")}
        </Button>
        <Button type="submit" className="min-w-[100px]">
          {isEdit ? t("leads.form.update") : t("leads.form.save")}
        </Button>
      </div>
    </form>
  )
}
