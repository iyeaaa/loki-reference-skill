import { ExternalLink } from "lucide-react"
import { useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
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
import {
  useCustomerGroupMembers,
  useCustomerGroupsByWorkspace,
} from "@/lib/api/hooks/customer-groups"
import { useSequenceEnrollments } from "@/lib/api/hooks/sequences"
import { useSuspenseUserWorkspaces } from "@/lib/api/hooks/workspaces"
import type { CustomerGroupMember } from "@/lib/api/types/customer-group"
import type { Sequence, SequenceStatus } from "@/lib/api/types/sequence"
import { useAuth } from "@/lib/auth-provider"
import { useWorkspace } from "@/lib/hooks/useWorkspace"

// Extended type to include joined lead data
interface CustomerGroupMemberWithLead extends CustomerGroupMember {
  leadCompanyName?: string
  leadBusinessType?: string
}

type SequenceFormProps = {
  sequence?: Sequence
  isEdit?: boolean
  onSave: (sequenceData: unknown) => Promise<void> | void
  onCancel: () => void
  stepsCount?: number
}

export function SequenceForm({
  sequence,
  isEdit = false,
  onSave,
  onCancel,
  stepsCount = 0,
}: SequenceFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedWorkspace } = useWorkspace()

  // Fetch user's workspaces only (owned or member)
  // Use a dummy UUID if user is not available to satisfy the hook call rules
  const { data: allWorkspaces = [] } = useSuspenseUserWorkspaces(
    user?.id || "00000000-0000-0000-0000-000000000000",
  )

  // Only use workspaces if user exists
  const workspaces = user?.id ? allWorkspaces : []

  // Parse selectedLeadIds from JSON string with error handling
  const initialSelectedLeadIds = (() => {
    if (!sequence?.selectedLeadIds) {
      return []
    }
    try {
      const parsed = JSON.parse(sequence.selectedLeadIds)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error("Failed to parse selectedLeadIds:", error)
      return []
    }
  })()

  // Get initial workspace ID - use selected workspace if not editing and not "all"
  const initialWorkspaceId =
    sequence?.workspaceId ||
    (!isEdit && selectedWorkspace?.id && selectedWorkspace.id !== "all" ? selectedWorkspace.id : "")

  const [formData, setFormData] = useState({
    name: sequence?.name || "",
    description: sequence?.description || "",
    workspaceId: initialWorkspaceId,
    status: (sequence?.status || "draft") as SequenceStatus,
    customerGroupId: sequence?.customerGroupId || "",
  })

  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>(initialSelectedLeadIds)
  const [showLeadSelection, setShowLeadSelection] = useState(false)

  const { data: customerGroups } = useCustomerGroupsByWorkspace(
    formData.workspaceId,
    Boolean(formData.workspaceId),
  )

  // Check if sequence has any enrollments (to disable customer group change)
  const { data: enrollmentsData } = useSequenceEnrollments(
    sequence?.id || "",
    1,
    1,
    Boolean(isEdit && sequence?.id),
  )
  const hasEnrollments = (enrollmentsData?.total || 0) > 0

  // Fetch customer group members when group is selected and lead selection is shown
  const { data: membersData } = useCustomerGroupMembers(
    formData.customerGroupId || "",
    1,
    1000,
    Boolean(formData.customerGroupId) && showLeadSelection,
  )

  const members = (membersData?.members || []) as CustomerGroupMemberWithLead[]

  const nameId = useId()
  const descriptionId = useId()
  const selectAllId = useId()

  const customerGroupId = formData.customerGroupId

  // Reset selectedLeadIds when customer group changes (only in create mode)
  // biome-ignore lint/correctness/useExhaustiveDependencies: isEdit doesn't change during component lifecycle
  useEffect(() => {
    if (!isEdit) {
      setSelectedLeadIds([])
    }
  }, [customerGroupId])

  const handleToggleAllLeads = () => {
    if (selectedLeadIds.length === members.length) {
      setSelectedLeadIds([])
    } else {
      setSelectedLeadIds(members.map((m) => m.leadId))
    }
  }

  const handleToggleLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 고객그룹 필수 검증
    if (!formData.customerGroupId) {
      toast.error(t("sequences.toast.selectCustomerGroup"))
      return
    }

    onSave({
      ...formData,
      selectedLeadIds: selectedLeadIds.length > 0 ? selectedLeadIds : undefined,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor={nameId}>{t("sequences.form.sequenceName")}</Label>
        <Input
          id={nameId}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t("sequences.form.sequenceNamePlaceholder")}
          required
          value={formData.name}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={descriptionId}>{t("sequences.form.description")}</Label>
        <Textarea
          id={descriptionId}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={t("sequences.form.descriptionPlaceholder")}
          rows={4}
          value={formData.description}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerGroup">{t("sequences.form.workspace")}</Label>
        <Combobox
          emptyText={t("sequences.form.workspaceEmptyText")}
          onValueChange={(value) => setFormData({ ...formData, workspaceId: value })}
          options={workspaces.map((workspace) => ({
            value: workspace.id,
            label: workspace.name,
            sublabel: workspace.description || undefined,
          }))}
          placeholder={t("sequences.form.workspacePlaceholder")}
          searchPlaceholder={t("sequences.form.workspaceSearchPlaceholder")}
          value={formData.workspaceId}
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2" htmlFor="customerGroup">
          {t("sequences.form.customerGroup")}
          <span className="text-red-500">*</span>
        </Label>
        <Select
          disabled={!formData.workspaceId || hasEnrollments}
          onValueChange={(value) => setFormData({ ...formData, customerGroupId: value })}
          required
          value={formData.customerGroupId}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                formData.workspaceId
                  ? t("sequences.form.customerGroupSelect")
                  : t("sequences.form.selectWorkspaceFirst")
              }
            />
          </SelectTrigger>
          {customerGroups && customerGroups.length === 0 && (
            <SelectContent>
              <SelectItem disabled value="none">
                {t("sequences.form.noCustomerGroups")}
              </SelectItem>
            </SelectContent>
          )}
          {customerGroups && customerGroups.length > 0 && (
            <SelectContent>
              {customerGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {t("sequences.form.leadCount", { name: group.name, count: group.leadCount || 0 })}
                </SelectItem>
              ))}
            </SelectContent>
          )}
        </Select>
        {customerGroups && customerGroups.length === 0 && formData.workspaceId && (
          <div className="mt-2 rounded-lg border-2 border-amber-500 bg-amber-50 p-3 dark:bg-amber-950/20">
            <p className="mb-2 font-semibold text-amber-900 text-xs dark:text-amber-200">
              {t("sequences.form.warning.noCustomerGroupsInWorkspace")}
            </p>
            <p className="mb-2 text-amber-800 text-xs dark:text-amber-300">
              {t("sequences.form.warning.createCustomerGroupFirst")}
            </p>
            <Button
              className="h-8 text-xs"
              onClick={() => window.open("/customer-groups", "_blank")}
              size="sm"
              type="button"
              variant="outline"
            >
              <ExternalLink className="mr-1 h-3 w-3" />
              {t("sequences.form.button.goToCreateCustomerGroup")}
            </Button>
          </div>
        )}
        {hasEnrollments ? (
          <p className="text-amber-600 text-xs">
            {t("sequences.form.warning.cannotChangeCustomerGroup")}
          </p>
        ) : customerGroups && customerGroups.length > 0 ? (
          <p className="text-gray-500 text-xs">{t("sequences.form.info.customerGroupRequired")}</p>
        ) : null}
      </div>

      {/* 리드 선택 섹션 */}
      {formData.customerGroupId && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <Label className="font-medium text-sm">{t("sequences.form.leadSelection.title")}</Label>
            <Button
              onClick={() => setShowLeadSelection(!showLeadSelection)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {showLeadSelection
                ? t("sequences.form.leadSelection.collapse")
                : t("sequences.form.leadSelection.selectSpecific")}
            </Button>
          </div>

          {!showLeadSelection && (
            <p className="text-muted-foreground text-xs">
              {t("sequences.form.leadSelection.defaultNote")}
              {selectedLeadIds.length > 0 &&
                ` ${t("sequences.form.leadSelection.currentlySelected", { count: selectedLeadIds.length })}`}
            </p>
          )}

          {showLeadSelection && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-background p-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={members.length > 0 && selectedLeadIds.length === members.length}
                    id={selectAllId}
                    onCheckedChange={handleToggleAllLeads}
                  />
                  <Label className="cursor-pointer font-medium text-sm" htmlFor={selectAllId}>
                    {t("sequences.form.leadSelection.selectAll", {
                      selected: selectedLeadIds.length,
                      total: members.length,
                    })}
                  </Label>
                </div>
                {selectedLeadIds.length > 0 && (
                  <Button
                    onClick={() => setSelectedLeadIds([])}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {t("sequences.form.leadSelection.deselectAll")}
                  </Button>
                )}
              </div>

              <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border bg-background p-3">
                {members.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm">
                    {t("sequences.form.leadSelection.noLeads")}
                  </p>
                ) : (
                  members.map((member) => (
                    <div
                      className="flex items-center gap-2 rounded-sm p-2 transition-colors hover:bg-muted/50"
                      key={member.leadId}
                    >
                      <Checkbox
                        checked={selectedLeadIds.includes(member.leadId)}
                        id={member.leadId}
                        onCheckedChange={() => handleToggleLead(member.leadId)}
                      />
                      <Label className="flex-1 cursor-pointer text-sm" htmlFor={member.leadId}>
                        <span className="font-medium">{member.leadCompanyName}</span>
                        {member.leadBusinessType && (
                          <span className="ml-2 text-muted-foreground text-xs">
                            ({member.leadBusinessType})
                          </span>
                        )}
                      </Label>
                    </div>
                  ))
                )}
              </div>

              <p className="text-muted-foreground text-xs">
                {selectedLeadIds.length > 0
                  ? t("sequences.form.leadSelection.selectedNote", {
                      count: selectedLeadIds.length,
                    })
                  : t("sequences.form.leadSelection.defaultNote2")}
              </p>
            </div>
          )}
        </div>
      )}

      {isEdit && (
        <div className="space-y-2">
          <Label htmlFor="status">{t("sequences.form.status.label")}</Label>
          <Select
            onValueChange={(value) =>
              setFormData({
                ...formData,
                status: value as SequenceStatus,
              })
            }
            value={formData.status}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t("sequences.form.status.draft")}</SelectItem>
              <SelectItem disabled={stepsCount > 0} value="active">
                {t("sequences.form.status.active")}{" "}
                {stepsCount > 0 && t("sequences.form.status.stepBasedNote")}
              </SelectItem>
              <SelectItem value="paused">{t("sequences.form.status.paused")}</SelectItem>
              <SelectItem value="archived">{t("sequences.form.status.archived")}</SelectItem>
              <SelectItem value="completed">{t("sequences.form.status.completed")}</SelectItem>
              <SelectItem value="no_response">{t("sequences.table.status.noResponse")}</SelectItem>
            </SelectContent>
          </Select>
          {stepsCount > 0 && formData.status !== "active" && (
            <p className="text-amber-600 text-xs">{t("sequences.form.info.useToggleButton")}</p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button onClick={onCancel} type="button" variant="outline">
          {t("sequences.form.button.cancel")}
        </Button>
        <Button className="min-w-[100px]" type="submit">
          {isEdit ? t("sequences.form.button.editComplete") : t("sequences.form.button.create")}
        </Button>
      </div>
    </form>
  )
}
