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

type WorkspaceFormProps = {
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
    <div className="flex h-full flex-col">
      <form className="flex-1 space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={nameId}>
              {t("settings.workspaces.form.workspaceName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id={nameId}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t("settings.workspaces.form.workspaceNamePlaceholder")}
              required
              value={formData.name}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyNameId}>{t("settings.workspaces.form.clientName")}</Label>
            <Input
              id={companyNameId}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder={t("settings.workspaces.form.clientNamePlaceholder")}
              value={formData.companyName}
            />
            <p className="text-muted-foreground text-sm">
              {t("settings.workspaces.form.clientNameHint")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={companyWebsiteId}>{t("settings.workspace.companyWebsite")}</Label>
              <Input
                id={companyWebsiteId}
                onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                placeholder={t("settings.workspace.companyWebsitePlaceholder")}
                type="url"
                value={formData.companyWebsite}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={companyPhoneId}>{t("settings.workspace.companyPhone")}</Label>
              <Input
                id={companyPhoneId}
                onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                placeholder={t("settings.workspace.companyPhonePlaceholder")}
                type="tel"
                value={formData.companyPhone}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={companySizeId}>{t("settings.workspace.companySize")}</Label>
              <Input
                id={companySizeId}
                onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                placeholder={t("settings.workspace.companySizePlaceholder")}
                value={formData.companySize}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={industryId}>{t("settings.workspace.industry")}</Label>
              <Input
                id={industryId}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder={t("settings.workspace.industryPlaceholder")}
                value={formData.industry}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyAddressId}>{t("settings.workspace.companyAddress")}</Label>
            <Input
              id={companyAddressId}
              onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
              placeholder={t("settings.workspace.companyAddressPlaceholder")}
              value={formData.companyAddress}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyDescriptionId}>
              {t("settings.workspace.companyDescription")}
            </Label>
            <Textarea
              id={companyDescriptionId}
              onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
              placeholder={t("settings.workspace.companyDescriptionPlaceholder")}
              rows={4}
              value={formData.companyDescription}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={descriptionId}>{t("settings.workspaces.form.description")}</Label>
            <Textarea
              className="min-h-[72px] resize-none overflow-hidden"
              id={descriptionId}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value })
                // Auto-expand textarea
                const target = e.target as HTMLTextAreaElement
                target.style.height = "auto"
                target.style.height = `${Math.max(72, target.scrollHeight)}px`
              }}
              placeholder={t("settings.workspaces.form.descriptionPlaceholder")}
              ref={(el) => {
                if (el && formData.description) {
                  el.style.height = "auto"
                  el.style.height = `${Math.max(72, el.scrollHeight)}px`
                }
              }}
              rows={3}
              style={{ height: "auto" }}
              value={formData.description}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner">
              {t("settings.workspaces.form.owner")} <span className="text-red-500">*</span>
            </Label>
            <Popover onOpenChange={setOwnerOpen} open={ownerOpen}>
              <PopoverTrigger asChild>
                <Button
                  aria-expanded={ownerOpen}
                  className="h-auto w-full justify-between py-2 font-normal"
                  role="combobox"
                  type="button"
                  variant="outline"
                >
                  {formData.ownerId ? (
                    <div className="flex flex-col items-start">
                      <span>{users.find((user) => user.id === formData.ownerId)?.username}</span>
                      <span className="text-muted-foreground text-xs">
                        {users.find((user) => user.id === formData.ownerId)?.email}
                      </span>
                    </div>
                  ) : (
                    t("settings.workspaces.form.selectOwner")
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command className="max-h-[300px]">
                  <CommandInput
                    onValueChange={setOwnerSearch}
                    placeholder={t("settings.workspaces.form.searchUsers")}
                    value={ownerSearch}
                  />
                  <CommandList>
                    <CommandEmpty>{t("settings.workspaces.form.noUsersFound")}</CommandEmpty>
                    <CommandGroup>
                      {filteredUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              ownerId: user.id,
                            })
                            setOwnerOpen(false)
                            setOwnerSearch("")
                          }}
                          value={`${user.username} ${user.email}`}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              formData.ownerId === user.id ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          <div className="flex flex-col">
                            <span>{user.username}</span>
                            <span className="text-gray-500 text-xs">{user.email}</span>
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
              checked={formData.isActive}
              id={isActiveId}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
            />
            <Label htmlFor={isActiveId}>{t("settings.workspaces.form.active")}</Label>
          </div>
        </div>

        {workspace?.id && (
          <>
            <div className="border-t pt-6">
              <WorkspaceMembersSection
                isEdit={isEdit}
                onAddMemberClick={onAddMemberClick || (() => {})}
                workspaceId={workspace.id}
              />
            </div>

            <div className="border-t pt-6">
              <WorkspaceEmailAccountsSection isEdit={isEdit} workspaceId={workspace.id} />
            </div>
          </>
        )}

        <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white pt-6">
          <Button onClick={onCancel} type="button" variant="outline">
            {t("settings.workspaces.form.cancel")}
          </Button>
          <Button
            className="min-w-[100px]"
            disabled={!(formData.name && formData.ownerId)}
            type="submit"
          >
            {isEdit ? t("settings.workspaces.form.save") : t("settings.workspaces.form.create")}
          </Button>
        </div>
      </form>
    </div>
  )
}
