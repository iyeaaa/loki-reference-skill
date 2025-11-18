import { Check, ChevronsUpDown } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
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
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { User } from "@/lib/api/types/user"
import type { Workspace } from "@/lib/api/types/workspace"
import { WorkspaceEmailAccountsSection } from "./WorkspaceEmailAccountsSection"
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
  const { t } = useTranslation()
  const nameId = useId()
  const companyNameId = useId()
  const companyWebsiteId = useId()
  const companyPhoneId = useId()
  const companySizeId = useId()
  const industryId = useId()
  const companyAddressId = useId()
  const companyDescriptionId = useId()
  const descriptionId = useId()
  const isActiveId = useId()

  const [formData, setFormData] = useState({
    name: workspace?.name || "",
    companyName: workspace?.companyName || "",
    companyWebsite: workspace?.companyWebsite || "",
    companyPhone: workspace?.companyPhone || "",
    companySize: workspace?.companySize || "",
    industry: workspace?.industry || "",
    companyAddress: workspace?.companyAddress || "",
    companyDescription: workspace?.companyDescription || "",
    description: workspace?.description || "",
    ownerId: workspace?.ownerId || "",
    isActive: workspace?.isActive ?? true,
  })
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState("")

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(ownerSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(ownerSearch.toLowerCase()),
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
              {t("settings.workspaces.form.workspaceName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id={nameId}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder={t("settings.workspaces.form.workspaceNamePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyNameId}>{t("settings.workspaces.form.clientName")}</Label>
            <Input
              id={companyNameId}
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder={t("settings.workspaces.form.clientNamePlaceholder")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={companyWebsiteId}>{t("settings.workspace.companyWebsite")}</Label>
              <Input
                id={companyWebsiteId}
                type="url"
                value={formData.companyWebsite}
                onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                placeholder={t("settings.workspace.companyWebsitePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={companyPhoneId}>{t("settings.workspace.companyPhone")}</Label>
              <Input
                id={companyPhoneId}
                type="tel"
                value={formData.companyPhone}
                onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                placeholder={t("settings.workspace.companyPhonePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={companySizeId}>{t("settings.workspace.companySize")}</Label>
              <Input
                id={companySizeId}
                value={formData.companySize}
                onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                placeholder={t("settings.workspace.companySizePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={industryId}>{t("settings.workspace.industry")}</Label>
              <Input
                id={industryId}
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder={t("settings.workspace.industryPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyAddressId}>{t("settings.workspace.companyAddress")}</Label>
            <Input
              id={companyAddressId}
              value={formData.companyAddress}
              onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
              placeholder={t("settings.workspace.companyAddressPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyDescriptionId}>
              {t("settings.workspace.companyDescription")}
            </Label>
            <Textarea
              id={companyDescriptionId}
              value={formData.companyDescription}
              onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
              placeholder={t("settings.workspace.companyDescriptionPlaceholder")}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={descriptionId}>
              {t("settings.workspaces.form.description")} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id={descriptionId}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              placeholder={t("settings.workspaces.form.descriptionPlaceholder")}
              rows={15}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner">
              {t("settings.workspaces.form.owner")} <span className="text-red-500">*</span>
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
                    : t("settings.workspaces.form.selectOwner")}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command className="max-h-[300px]">
                  <CommandInput
                    placeholder={t("settings.workspaces.form.searchUsers")}
                    value={ownerSearch}
                    onValueChange={setOwnerSearch}
                  />
                  <CommandList>
                    <CommandEmpty>{t("settings.workspaces.form.noUsersFound")}</CommandEmpty>
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
            <Label htmlFor={isActiveId}>{t("settings.workspaces.form.active")}</Label>
          </div>
        </div>

        {workspace?.id && (
          <>
            <div className="pt-6 border-t">
              <WorkspaceMembersSection
                workspaceId={workspace.id}
                isEdit={isEdit}
                onAddMemberClick={onAddMemberClick || (() => {})}
              />
            </div>

            <div className="pt-6 border-t">
              <WorkspaceEmailAccountsSection workspaceId={workspace.id} isEdit={isEdit} />
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t sticky bottom-0 bg-white">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("settings.workspaces.form.cancel")}
          </Button>
          <Button
            type="submit"
            className="min-w-[100px]"
            disabled={!formData.name || !formData.ownerId}
          >
            {isEdit ? t("settings.workspaces.form.save") : t("settings.workspaces.form.create")}
          </Button>
        </div>
      </form>
    </div>
  )
}
