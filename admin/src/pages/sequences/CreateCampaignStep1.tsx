import { AlertCircle, Check, CheckCircle, ChevronDown, ChevronUp, X } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

type CreateCampaignStep1Props = {
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
  const { t } = useTranslation()
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
  const [showRepliedSection, setShowRepliedSection] = useState(true)

  // Filter states
  const [selectedCountry, setSelectedCountry] = useState<string>("all")
  const [selectedCity, setSelectedCity] = useState<string>("all")
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>("all")
  const prevCustomerGroupId = useRef(customerGroupId)
  const prevDataRef = useRef({
    customerGroupId: data.customerGroupId,
    selectedLeadIds: data.selectedLeadIds,
  })

  // Update state when data prop changes (e.g., when loading existing campaign)
  useEffect(() => {
    const prevData = prevDataRef.current
    const hasCustomerGroupChanged = data.customerGroupId !== prevData.customerGroupId
    const hasSelectedLeadIdsChanged =
      JSON.stringify(data.selectedLeadIds) !== JSON.stringify(prevData.selectedLeadIds)

    if (hasCustomerGroupChanged || hasSelectedLeadIdsChanged) {
      console.log("📥 Step1 - Data prop changed:", {
        customerGroupId: data.customerGroupId,
        selectedLeadIds: data.selectedLeadIds,
      })

      if (hasCustomerGroupChanged && data.customerGroupId) {
        console.log("🔄 Step1 - Updating customerGroupId:", data.customerGroupId)
        setCustomerGroupId(data.customerGroupId)
        prevCustomerGroupId.current = data.customerGroupId
      }

      if (hasSelectedLeadIdsChanged) {
        console.log("🔄 Step1 - Updating selectedLeadIds:", data.selectedLeadIds)
        setSelectedLeadIds(data.selectedLeadIds)
      }

      // Update ref to prevent re-triggering
      prevDataRef.current = {
        customerGroupId: data.customerGroupId,
        selectedLeadIds: data.selectedLeadIds,
      }
    }
  }, [data.customerGroupId, data.selectedLeadIds])

  const { data: customerGroups } = useCustomerGroupsByWorkspace(workspaceId, Boolean(workspaceId))

  console.log("🔍 Step1 - Current state:", {
    workspaceId,
    customerGroupId,
    customerGroupsCount: customerGroups?.length || 0,
    customerGroupIds: customerGroups?.map((g) => g.id) || [],
  })

  const { data: members = [] } = useCustomerGroupMembersWithEmails(
    customerGroupId || "",
    Boolean(customerGroupId),
  )

  // Extract unique filter values
  const uniqueCountries = useMemo(() => {
    const countries = members.map((m) => m.country).filter((c): c is string => Boolean(c))
    return Array.from(new Set(countries)).sort()
  }, [members])

  const uniqueCities = useMemo(() => {
    const cities = members.map((m) => m.city).filter((c): c is string => Boolean(c))
    return Array.from(new Set(cities)).sort()
  }, [members])

  const uniqueBusinessTypes = useMemo(() => {
    const types = members.map((m) => m.businessType).filter((t): t is string => Boolean(t))
    return Array.from(new Set(types)).sort()
  }, [members])

  // Apply filters to members
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Country filter
      if (selectedCountry !== "all" && member.country !== selectedCountry) {
        return false
      }
      // City filter
      if (selectedCity !== "all" && member.city !== selectedCity) {
        return false
      }
      // Business type filter
      if (selectedBusinessType !== "all" && member.businessType !== selectedBusinessType) {
        return false
      }
      return true
    })
  }, [members, selectedCountry, selectedCity, selectedBusinessType])

  // Separate replied and non-replied leads with memoization to prevent infinite loops
  const repliedLeads = useMemo(() => filteredMembers.filter((m) => m.hasReplied), [filteredMembers])
  const nonRepliedLeads = useMemo(
    () => filteredMembers.filter((m) => !m.hasReplied),
    [filteredMembers],
  )

  const filteredRepliedLeads = repliedLeads
  const filteredNonRepliedLeads = nonRepliedLeads

  const repliedCount = repliedLeads.length
  const selectedRepliedCount = selectedLeadIds.filter((id) =>
    repliedLeads.find((m) => m.id === id),
  ).length

  // Update parent when data changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: adding onChange to dependencies will cause infinite loop
  useEffect(() => {
    const dataToSave = {
      workspaceId,
      customerGroupId,
      selectedLeadIds,
    }
    console.log("📤 Step1 - Sending data to parent:", dataToSave)
    onChange(dataToSave)
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

  // Reset filters function
  const handleResetFilters = () => {
    setSelectedCountry("all")
    setSelectedCity("all")
    setSelectedBusinessType("all")
  }

  // Apply filters automatically to selections
  useEffect(() => {
    if (selectedCountry !== "all" || selectedCity !== "all" || selectedBusinessType !== "all") {
      // When filters are applied, auto-select filtered non-replied leads
      const filteredNonRepliedIds = nonRepliedLeads.map((m) => m.id)
      setSelectedLeadIds(filteredNonRepliedIds)
    }
  }, [selectedCountry, selectedCity, selectedBusinessType, nonRepliedLeads])

  const hasActiveFilters =
    selectedCountry !== "all" || selectedCity !== "all" || selectedBusinessType !== "all"

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
    <div className="flex h-full flex-col gap-4">
      {/* Important Notice at Top */}
      {customerGroupId && totalLeadsCount > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900 text-sm dark:text-blue-200">
                {t("sequences.step1.recipientNotice", { count: effectiveRecipientCount })}
              </p>
              <p className="mt-1 text-blue-700 text-xs dark:text-blue-300">
                {selectedCount > 0
                  ? t("sequences.step1.selectedCount", { count: selectedCount }) +
                    (selectedRepliedCount > 0
                      ? t("sequences.step1.repliedLeadsIncluded", { count: selectedRepliedCount })
                      : "")
                  : t("sequences.step1.defaultAllLeads")}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-6 overflow-hidden">
        {/* Left Panel - Customer Group Selection */}
        <div className="space-y-4 overflow-y-auto border-r pr-6">
          <div>
            <h3 className="mb-4 font-semibold text-lg">
              {t("sequences.step1.selectCustomerGroup")}
            </h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("sequences.step1.customerGroupRequired")}</Label>
              <Select
                disabled={!workspaceId}
                onValueChange={setCustomerGroupId}
                value={customerGroupId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      workspaceId
                        ? t("sequences.step1.customerGroupPlaceholder")
                        : t("sequences.step1.selectWorkspaceFirst")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {customerGroups && customerGroups.length === 0 ? (
                    <SelectItem disabled value="none">
                      {t("sequences.step1.noCustomerGroups")}
                    </SelectItem>
                  ) : (
                    customerGroups?.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {t("sequences.step1.leadCountFormat", {
                          name: group.name,
                          count: group.leadCount || 0,
                        })}
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
                    <span className="font-medium text-sm">
                      {t("sequences.step1.selectedGroup")}
                    </span>
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="text-muted-foreground text-sm">
                    <div className="font-medium text-foreground">{selectedGroup.name}</div>
                    {selectedGroup.description && (
                      <div className="mt-1">{selectedGroup.description}</div>
                    )}
                    <div className="mt-2 text-xs">
                      {t("sequences.step1.totalLeads", { count: selectedGroup.leadCount || 0 })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Lead Selection */}
        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{t("sequences.step1.selectRecipients")}</h3>
            {members.length > 0 && (
              <div className="text-muted-foreground text-sm">
                {selectedLeadIds.length > 0
                  ? t("sequences.step1.selectedFormat", { count: selectedLeadIds.length })
                  : t("sequences.step1.selectAllDefault")}
              </div>
            )}
          </div>

          {customerGroupId ? (
            members.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed">
                <p className="text-muted-foreground text-sm">
                  {t("sequences.step1.noLeadsInGroup")}
                </p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-3 overflow-hidden">
                {/* Filter Panel - Always Visible */}
                <div className="flex-shrink-0 space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {t("sequences.step1.filterOptions")}
                    </span>
                    {hasActiveFilters && (
                      <Button onClick={handleResetFilters} size="sm" variant="ghost">
                        <X className="mr-1 h-3 w-3" />
                        {t("sequences.step1.resetFilters")}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Country Filter */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        {t("sequences.step1.country")}
                      </Label>
                      <Select onValueChange={setSelectedCountry} value={selectedCountry}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("sequences.step1.allCountries")}</SelectItem>
                          {uniqueCountries.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country} ({members.filter((m) => m.country === country).length})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* City Filter */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        {t("sequences.step1.city")}
                      </Label>
                      <Select onValueChange={setSelectedCity} value={selectedCity}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("sequences.step1.allCities")}</SelectItem>
                          {uniqueCities.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city} ({members.filter((m) => m.city === city).length})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Business Type Filter */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        {t("sequences.step1.businessType")}
                      </Label>
                      <Select onValueChange={setSelectedBusinessType} value={selectedBusinessType}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("sequences.step1.allBusinessTypes")}
                          </SelectItem>
                          {uniqueBusinessTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type} ({members.filter((m) => m.businessType === type).length})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Filter Summary */}
                  {hasActiveFilters && (
                    <div className="border-t pt-2 text-muted-foreground text-xs">
                      {t("sequences.step1.filterResults", {
                        count: filteredMembers.length,
                        total: members.length,
                      })}
                    </div>
                  )}
                </div>

                {selectedRepliedCount > 0 && (
                  <div className="flex-shrink-0 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                    <p className="text-amber-900 text-xs dark:text-amber-200">
                      {t("sequences.step1.repliedLeadsWarning", { count: selectedRepliedCount })}
                    </p>
                  </div>
                )}

                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                  {/* Replied Leads Section */}
                  {repliedCount > 0 && (
                    <div className="flex-shrink-0 overflow-hidden rounded-lg border border-amber-200 dark:border-amber-800">
                      <button
                        className="flex w-full items-center justify-between bg-amber-50 p-3 transition-colors hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
                        onClick={() => setShowRepliedSection(!showRepliedSection)}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                          <span className="font-medium text-amber-900 text-sm dark:text-amber-200">
                            {t("sequences.step1.repliedLeadsCount", {
                              selected: selectedRepliedCount,
                              total: repliedCount,
                            })}
                          </span>
                        </div>
                        {showRepliedSection ? (
                          <ChevronUp className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                        )}
                      </button>

                      {showRepliedSection && (
                        <div className="bg-white dark:bg-gray-950">
                          <div className="border-b bg-muted/30 p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={
                                    filteredRepliedLeads.length > 0 &&
                                    filteredRepliedLeads.every((m) =>
                                      selectedLeadIds.includes(m.id),
                                    )
                                  }
                                  id={selectAllRepliedId}
                                  onCheckedChange={handleToggleAllReplied}
                                />
                                <Label
                                  className="cursor-pointer text-xs"
                                  htmlFor={selectAllRepliedId}
                                >
                                  {t("sequences.step1.selectAll")}
                                </Label>
                              </div>
                              <span className="text-muted-foreground text-xs">
                                {t("sequences.step1.reEnrollWarning")}
                              </span>
                            </div>
                          </div>
                          <ScrollArea className="h-[150px]">
                            <div className="space-y-2 p-3">
                              {filteredRepliedLeads.map((member) => (
                                <div
                                  className="flex cursor-pointer items-center gap-2 rounded-sm bg-amber-50/30 p-2 transition-colors hover:bg-amber-50 dark:bg-amber-950/10 dark:hover:bg-amber-950/20"
                                  key={member.id}
                                >
                                  <Checkbox
                                    checked={selectedLeadIds.includes(member.id)}
                                    id={member.id}
                                    onCheckedChange={() => handleToggleLead(member.id)}
                                  />
                                  <Label
                                    className="flex-1 cursor-pointer text-sm"
                                    htmlFor={member.id}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{member.name}</span>
                                    </div>
                                    {member.email && (
                                      <span className="mt-0.5 block text-muted-foreground text-xs">
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
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                    <div className="flex-shrink-0 rounded-md bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={
                              filteredNonRepliedLeads.length > 0 &&
                              filteredNonRepliedLeads.every((m) => selectedLeadIds.includes(m.id))
                            }
                            id={selectAllId}
                            onCheckedChange={handleToggleAllNonReplied}
                          />
                          <Label className="cursor-pointer text-sm" htmlFor={selectAllId}>
                            {t("sequences.step1.normalLeadsSelectAll", {
                              selected: selectedLeadIds.filter((id) =>
                                nonRepliedLeads.find((m) => m.id === id),
                              ).length,
                              total: filteredNonRepliedLeads.length,
                            })}
                          </Label>
                        </div>
                        {selectedLeadIds.length > 0 && (
                          <Button onClick={() => setSelectedLeadIds([])} size="sm" variant="ghost">
                            {t("sequences.step1.deselectAll")}
                          </Button>
                        )}
                      </div>
                    </div>

                    <ScrollArea className="h-[400px] rounded-md border">
                      <div className="space-y-2 p-3">
                        {filteredNonRepliedLeads.map((member) => (
                          <div
                            className="flex cursor-pointer items-center gap-2 rounded-sm p-2 transition-colors hover:bg-muted/50"
                            key={member.id}
                          >
                            <Checkbox
                              checked={selectedLeadIds.includes(member.id)}
                              id={member.id}
                              onCheckedChange={() => handleToggleLead(member.id)}
                            />
                            <Label className="flex-1 cursor-pointer text-sm" htmlFor={member.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{member.name}</span>
                              </div>
                              {member.email && (
                                <span className="mt-0.5 block text-muted-foreground text-xs">
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
            )
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed">
              <p className="text-muted-foreground text-sm">
                {t("sequences.step1.selectGroupFromLeft")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
