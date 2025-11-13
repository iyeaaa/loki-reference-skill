import { AlertCircle, Check, CheckCircle, ChevronDown, ChevronUp } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  useCustomerGroupMembersWithEmails,
  useCustomerGroupsByWorkspace,
} from "@/lib/api/hooks/customer-groups"
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

export function CreateCampaignStep1({ data, onChange }: CreateCampaignStep1Props) {
  const { selectedWorkspace } = useWorkspace()
  const selectAllId = useId()
  const selectAllRepliedId = useId()

  // Use current workspace automatically
  const workspaceId =
    !selectedWorkspace || selectedWorkspace.id === "all" ? "" : selectedWorkspace.id

  const [customerGroupId, setCustomerGroupId] = useState(data.customerGroupId)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>(
    data.selectedLeadIds.length > 0 ? data.selectedLeadIds : [],
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [showRepliedSection, setShowRepliedSection] = useState(true)
  const prevCustomerGroupId = useRef(customerGroupId)

  const { data: customerGroups } = useCustomerGroupsByWorkspace(workspaceId, Boolean(workspaceId))

  const { data: members = [] } = useCustomerGroupMembersWithEmails(
    customerGroupId || "",
    Boolean(customerGroupId),
  )

  // Separate replied and non-replied leads
  const repliedLeads = members.filter((m) => m.hasReplied)
  const nonRepliedLeads = members.filter((m) => !m.hasReplied)

  const filteredRepliedLeads = repliedLeads.filter(
    (member) =>
      !searchQuery ||
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredNonRepliedLeads = nonRepliedLeads.filter(
    (member) =>
      !searchQuery ||
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const repliedCount = repliedLeads.length
  const selectedRepliedCount = selectedLeadIds.filter((id) =>
    repliedLeads.find((m) => m.id === id),
  ).length

  // Update parent when data changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: adding onChange to dependencies will cause infinite loop
  useEffect(() => {
    onChange({
      workspaceId,
      customerGroupId,
      selectedLeadIds,
    })
  }, [workspaceId, customerGroupId, selectedLeadIds])

  // Reset lead selections when customer group changes and select all by default
  useEffect(() => {
    if (prevCustomerGroupId.current !== customerGroupId && customerGroupId) {
      // Default to selecting all non-replied leads
      const allNonRepliedIds = nonRepliedLeads.map((m) => m.id)
      setSelectedLeadIds(allNonRepliedIds)
      prevCustomerGroupId.current = customerGroupId
    }
  }, [customerGroupId, nonRepliedLeads])

  const handleToggleAllNonReplied = () => {
    const nonRepliedIds = filteredNonRepliedLeads.map((m) => m.id)
    const repliedIds = selectedLeadIds.filter((id) => repliedLeads.find((m) => m.id === id))

    // Check if all non-replied are selected
    const allNonRepliedSelected = nonRepliedIds.every((id) => selectedLeadIds.includes(id))

    if (allNonRepliedSelected) {
      // Deselect all non-replied, keep replied selections
      setSelectedLeadIds(repliedIds)
    } else {
      // Select all non-replied, keep replied selections
      setSelectedLeadIds([...new Set([...repliedIds, ...nonRepliedIds])])
    }
  }

  const handleToggleAllReplied = () => {
    const repliedIds = filteredRepliedLeads.map((m) => m.id)
    const nonRepliedIds = selectedLeadIds.filter((id) => nonRepliedLeads.find((m) => m.id === id))

    // Check if all replied are selected
    const allRepliedSelected = repliedIds.every((id) => selectedLeadIds.includes(id))

    if (allRepliedSelected) {
      // Deselect all replied, keep non-replied selections
      setSelectedLeadIds(nonRepliedIds)
    } else {
      // Select all replied, keep non-replied selections
      setSelectedLeadIds([...new Set([...nonRepliedIds, ...repliedIds])])
    }
  }

  const handleToggleLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
    )
  }

  const selectedGroup = customerGroups?.find((g) => g.id === customerGroupId)
  const totalLeadsCount = members.length
  const selectedCount = selectedLeadIds.length
  const effectiveRecipientCount = selectedCount > 0 ? selectedCount : totalLeadsCount

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Important Notice at Top */}
      {customerGroupId && totalLeadsCount > 0 && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                {effectiveRecipientCount}명의 고객에게 이메일이 발송됩니다
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {selectedCount > 0
                  ? `${selectedCount}명이 선택되었습니다${selectedRepliedCount > 0 ? ` (답장한 리드 ${selectedRepliedCount}명 포함)` : ""}`
                  : "고객을 선택하지 않으면 고객 그룹의 모든 리드에게 발송됩니다"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
        {/* Left Panel - Customer Group Selection */}
        <div className="space-y-4 border-r pr-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">고객그룹 선택</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>고객그룹 *</Label>
              <Select
                value={customerGroupId}
                onValueChange={setCustomerGroupId}
                disabled={!workspaceId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={workspaceId ? "고객그룹 선택" : "워크스페이스를 선택하세요"}
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
                        {group.name} ({group.leadCount || 0}명)
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
        <div className="flex flex-col gap-4 overflow-hidden">
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
            <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed">
              <p className="text-sm text-muted-foreground">좌측에서 고객그룹을 선택하세요</p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed">
              <p className="text-sm text-muted-foreground">고객그룹에 리드가 없습니다</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="리드 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>

              {selectedRepliedCount > 0 && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 p-3 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    ⚠️ 선택한 리드 중 {selectedRepliedCount}명은 이미 답장했습니다. 재등록 시
                    주의하세요.
                  </p>
                </div>
              )}

              <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                {/* Replied Leads Section */}
                {repliedCount > 0 && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowRepliedSection(!showRepliedSection)}
                      className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                        <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                          답장한 리드 ({selectedRepliedCount}/{repliedCount})
                        </span>
                      </div>
                      {showRepliedSection ? (
                        <ChevronUp className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      )}
                    </button>

                    {showRepliedSection && (
                      <div className="bg-white dark:bg-gray-950">
                        <div className="p-3 bg-muted/30 border-b">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={selectAllRepliedId}
                                checked={
                                  filteredRepliedLeads.length > 0 &&
                                  filteredRepliedLeads.every((m) => selectedLeadIds.includes(m.id))
                                }
                                onCheckedChange={handleToggleAllReplied}
                              />
                              <Label
                                htmlFor={selectAllRepliedId}
                                className="text-xs cursor-pointer"
                              >
                                전체 선택
                              </Label>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              재등록 시 주의 필요
                            </span>
                          </div>
                        </div>
                        <ScrollArea className="h-[120px]">
                          <div className="p-3 space-y-2">
                            {filteredRepliedLeads.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-2 rounded-sm p-2 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer"
                              >
                                <Checkbox
                                  id={member.id}
                                  checked={selectedLeadIds.includes(member.id)}
                                  onCheckedChange={() => handleToggleLead(member.id)}
                                />
                                <Label
                                  htmlFor={member.id}
                                  className="flex-1 text-sm cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{member.name}</span>
                                  </div>
                                  {member.email && (
                                    <span className="text-xs text-muted-foreground block mt-0.5">
                                      {member.email}
                                    </span>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                )}

                {/* Non-Replied Leads Section */}
                <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                  <div className="rounded-md bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={selectAllId}
                          checked={
                            filteredNonRepliedLeads.length > 0 &&
                            filteredNonRepliedLeads.every((m) => selectedLeadIds.includes(m.id))
                          }
                          onCheckedChange={handleToggleAllNonReplied}
                        />
                        <Label htmlFor={selectAllId} className="text-sm cursor-pointer">
                          일반 리드 전체 선택 (
                          {
                            selectedLeadIds.filter((id) => nonRepliedLeads.find((m) => m.id === id))
                              .length
                          }
                          /{filteredNonRepliedLeads.length})
                        </Label>
                      </div>
                      {selectedLeadIds.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLeadIds([])}>
                          선택 해제
                        </Button>
                      )}
                    </div>
                  </div>

                  <ScrollArea className="flex-1 rounded-md border">
                    <div className="p-3 space-y-2">
                      {filteredNonRepliedLeads.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 rounded-sm p-2 hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          <Checkbox
                            id={member.id}
                            checked={selectedLeadIds.includes(member.id)}
                            onCheckedChange={() => handleToggleLead(member.id)}
                          />
                          <Label htmlFor={member.id} className="flex-1 text-sm cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{member.name}</span>
                            </div>
                            {member.email && (
                              <span className="text-xs text-muted-foreground block mt-0.5">
                                {member.email}
                              </span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
