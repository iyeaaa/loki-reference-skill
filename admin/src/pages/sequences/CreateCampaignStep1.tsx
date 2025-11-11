import { Check } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCustomerGroupMembers,
  useCustomerGroupsByWorkspace,
} from "@/lib/api/hooks/customer-groups"
import { useSuspenseUserWorkspaces } from "@/lib/api/hooks/workspaces"
import type { CustomerGroupMember } from "@/lib/api/types/customer-group"
import { useAuth } from "@/lib/auth-provider"
import { useWorkspace } from "@/lib/hooks/useWorkspace"

interface CreateCampaignStep1Props {
  data: {
    workspaceId: string
    customerGroupId: string
    selectedLeadIds: string[]
  }
  onChange: (data: {
    workspaceId: string
    customerGroupId: string
    selectedLeadIds: string[]
  }) => void
}

interface CustomerGroupMemberWithLead extends CustomerGroupMember {
  leadCompanyName?: string
  leadBusinessType?: string
}

export function CreateCampaignStep1({ data, onChange }: CreateCampaignStep1Props) {
  const { user } = useAuth()
  const { selectedWorkspace } = useWorkspace()
  const selectAllId = useId()

  const { data: allWorkspaces = [] } = useSuspenseUserWorkspaces(
    user?.id || "00000000-0000-0000-0000-000000000000",
  )
  const workspaces = user?.id ? allWorkspaces : []

  const [workspaceId, setWorkspaceId] = useState(
    data.workspaceId ||
      (!selectedWorkspace || selectedWorkspace.id === "all" ? "" : selectedWorkspace.id),
  )
  const [customerGroupId, setCustomerGroupId] = useState(data.customerGroupId)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>(data.selectedLeadIds)
  const [searchQuery, setSearchQuery] = useState("")
  const prevWorkspaceId = useRef(workspaceId)
  const prevCustomerGroupId = useRef(customerGroupId)

  const { data: customerGroups } = useCustomerGroupsByWorkspace(workspaceId, Boolean(workspaceId))

  const { data: membersData } = useCustomerGroupMembers(
    customerGroupId || "",
    1,
    1000,
    Boolean(customerGroupId),
  )

  const members = (membersData?.members || []) as CustomerGroupMemberWithLead[]

  const filteredMembers = members.filter(
    (member) =>
      !searchQuery ||
      member.leadCompanyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.leadBusinessType?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Update parent when data changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: adding onChange to dependencies will cause infinite loop
    useEffect(() => {
    onChange({
      workspaceId,
      customerGroupId,
      selectedLeadIds,
    })
  }, [workspaceId, customerGroupId, selectedLeadIds])

  // Reset selections when workspace changes
  useEffect(() => {
    if (prevWorkspaceId.current !== workspaceId) {
      setCustomerGroupId("")
      setSelectedLeadIds([])
      prevWorkspaceId.current = workspaceId
    }
  })

  // Reset lead selections when customer group changes
  useEffect(() => {
    if (prevCustomerGroupId.current !== customerGroupId) {
      setSelectedLeadIds([])
      prevCustomerGroupId.current = customerGroupId
    }
  })

  const handleToggleAllLeads = () => {
    if (selectedLeadIds.length === filteredMembers.length) {
      setSelectedLeadIds([])
    } else {
      setSelectedLeadIds(filteredMembers.map((m) => m.leadId))
    }
  }

  const handleToggleLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
    )
  }

  const selectedGroup = customerGroups?.find((g) => g.id === customerGroupId)

  return (
    <div className="grid grid-cols-2 gap-6 h-[450px]">
      {/* Left Panel - Workspace & Customer Group Selection */}
      <div className="space-y-4 border-r pr-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">워크스페이스 및 고객그룹</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>워크스페이스 *</Label>
            <Combobox
              options={workspaces.map((workspace) => ({
                value: workspace.id,
                label: workspace.name,
                sublabel: workspace.description || undefined,
              }))}
              value={workspaceId}
              onValueChange={setWorkspaceId}
              placeholder="워크스페이스 선택"
              searchPlaceholder="워크스페이스 검색..."
              emptyText="워크스페이스가 없습니다"
            />
          </div>

          <div className="space-y-2">
            <Label>고객그룹 *</Label>
            <Select
              value={customerGroupId}
              onValueChange={setCustomerGroupId}
              disabled={!workspaceId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={workspaceId ? "고객그룹 선택" : "먼저 워크스페이스를 선택하세요"}
                />
              </SelectTrigger>
              <SelectContent>
                {customerGroups && customerGroups.length === 0 ? (
                  <SelectItem disabled value="none">
                    고객그룹이 없습니다
                  </SelectItem>
                ) : (
                  customerGroups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.leadCount || 0}개 리드)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedGroup && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">선택된 고객그룹</span>
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">{selectedGroup.name}</div>
                  {selectedGroup.description && (
                    <div className="mt-1">{selectedGroup.description}</div>
                  )}
                  <div className="mt-2 text-xs">총 {selectedGroup.leadCount || 0}명의 리드</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Lead Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">수신자 선택</h3>
          {members.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedLeadIds.length > 0
                ? `${selectedLeadIds.length}명 선택됨`
                : "전체 선택 (기본)"}
            </div>
          )}
        </div>

        {!customerGroupId ? (
          <div className="flex h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
            <p className="text-sm text-muted-foreground">좌측에서 고객그룹을 선택하세요</p>
          </div>
        ) : members.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
            <p className="text-sm text-muted-foreground">고객그룹에 리드가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="리드 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>

            <div className="rounded-md bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={selectAllId}
                    checked={
                      filteredMembers.length > 0 &&
                      selectedLeadIds.length === filteredMembers.length
                    }
                    onCheckedChange={handleToggleAllLeads}
                  />
                  <Label htmlFor={selectAllId} className="text-sm cursor-pointer">
                    전체 선택 ({selectedLeadIds.length}/{filteredMembers.length})
                  </Label>
                </div>
                {selectedLeadIds.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLeadIds([])}>
                    선택 해제
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="h-[320px] rounded-md border">
              <div className="p-3 space-y-2">
                {filteredMembers.map((member) => (
                  <div
                    key={member.leadId}
                    className="flex items-center gap-2 rounded-sm p-2 hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={member.leadId}
                      checked={selectedLeadIds.includes(member.leadId)}
                      onCheckedChange={() => handleToggleLead(member.leadId)}
                    />
                    <Label htmlFor={member.leadId} className="flex-1 text-sm cursor-pointer">
                      <span className="font-medium">{member.leadCompanyName}</span>
                      {member.leadBusinessType && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({member.leadBusinessType})
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3">
              <p className="text-xs text-blue-900 dark:text-blue-200">
                {selectedLeadIds.length > 0
                  ? `선택된 ${selectedLeadIds.length}명의 고객에게만 이메일이 발송됩니다`
                  : "고객을 선택하지 않으면 고객 그룹의 모든 리드에게 발송됩니다"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
