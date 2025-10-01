import { Search, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBulkAddGroupMembers, useCustomerGroupMembers } from "@/lib/api/hooks/customer-groups"
import { leadsApi } from "@/lib/api/services/leads"
import type { CustomerGroup } from "@/lib/api/types/customer-group"
import type { Lead } from "@/lib/api/types/lead"

interface AddMembersDialogProps {
  isOpen: boolean
  onClose: () => void
  customerGroup: CustomerGroup | null
  onSuccess?: () => void
}

export function AddMembersDialog({
  isOpen,
  onClose,
  customerGroup,
  onSuccess,
}: AddMembersDialogProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])

  const limit = 10
  const bulkAddMembers = useBulkAddGroupMembers()

  // 현재 그룹 멤버 조회 (이미 추가된 리드 제외용)
  const { data: membersData } = useCustomerGroupMembers(
    customerGroup?.id || "",
    1,
    1000, // 충분히 큰 수로 모든 멤버 조회
    !!customerGroup?.id && isOpen
  )
  const existingMemberLeadIds = new Set(membersData?.members.map((m) => m.leadId) || [])

  const loadLeads = useCallback(async () => {
    if (!customerGroup?.workspaceId) return

    setLoading(true)
    try {
      const response = await leadsApi.getByWorkspace(customerGroup.workspaceId, page, limit)
      setLeads(response.leads)
      setTotal(response.total)
    } catch (error) {
      console.error("Failed to load leads:", error)
      toast.error("고객 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }, [customerGroup?.workspaceId, page])

  useEffect(() => {
    if (isOpen && customerGroup) {
      loadLeads()
    }
  }, [isOpen, customerGroup, loadLeads])

  useEffect(() => {
    if (!isOpen) {
      setSelectedLeads([])
      setSearchInput("")
      setPage(1)
    }
  }, [isOpen])

  const handleToggleLead = (leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    )
  }

  const handleToggleAll = () => {
    const currentPageLeadIds = leads.map((lead) => lead.id)
    const allSelected = currentPageLeadIds.every((id) => selectedLeads.includes(id))

    if (allSelected) {
      setSelectedLeads((prev) => prev.filter((id) => !currentPageLeadIds.includes(id)))
    } else {
      setSelectedLeads((prev) => [...new Set([...prev, ...currentPageLeadIds])])
    }
  }

  const handleAddMembers = async () => {
    if (!customerGroup || selectedLeads.length === 0) return

    try {
      await bulkAddMembers.mutateAsync({
        groupId: customerGroup.id,
        leadIds: selectedLeads,
      })

      setSelectedLeads([])
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error("Failed to add members:", error)
      // 에러는 useBulkAddGroupMembers 훅에서 처리됨
    }
  }

  // 이미 그룹에 속한 리드 제외 & 검색 필터
  const filteredLeads = leads.filter((lead) => {
    // 이미 그룹 멤버인 경우 제외
    if (existingMemberLeadIds.has(lead.id)) {
      return false
    }

    // 검색 필터
    if (!searchInput) return true
    const searchLower = searchInput.toLowerCase()
    return (
      lead.companyName?.toLowerCase().includes(searchLower) ||
      lead.websiteUrl?.toLowerCase().includes(searchLower) ||
      lead.businessType?.toLowerCase().includes(searchLower)
    )
  })

  const totalPages = Math.ceil(total / limit)
  const currentPageLeadIds = filteredLeads.map((lead) => lead.id)
  const allCurrentPageSelected =
    currentPageLeadIds.length > 0 && currentPageLeadIds.every((id) => selectedLeads.includes(id))

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-semibold">
            그룹에 고객 추가 - {customerGroup?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-12rem)]">
          {/* Info & Search */}
          <div className="mb-4 space-y-3">
            {existingMemberLeadIds.size > 0 && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                💡 현재 그룹에 {existingMemberLeadIds.size}명의 고객이 이미 있습니다. 이미 추가된
                고객은 목록에서 제외됩니다.
              </div>
            )}
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="고객 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 pr-10 w-full"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Selection Info */}
          {selectedLeads.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-blue-700 font-medium">
                {selectedLeads.length}명 선택됨
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLeads([])}
                className="text-blue-700 hover:text-blue-800 hover:bg-blue-100"
              >
                선택 해제
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allCurrentPageSelected}
                      onCheckedChange={handleToggleAll}
                      aria-label="모두 선택"
                    />
                  </TableHead>
                  <TableHead>회사명</TableHead>
                  <TableHead>웹사이트</TableHead>
                  <TableHead>사업 유형</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchInput ? "검색 결과가 없습니다." : "고객이 없습니다."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLeads.includes(lead.id)}
                          onCheckedChange={() => handleToggleLead(lead.id)}
                          aria-label={`${lead.companyName} 선택`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {lead.companyName || lead.foundCompanyName || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.websiteUrl || "-"}
                      </TableCell>
                      <TableCell className="text-sm">{lead.businessType || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            lead.leadStatus === "new"
                              ? "bg-blue-100 text-blue-800"
                              : lead.leadStatus === "contacted"
                                ? "bg-yellow-100 text-yellow-800"
                                : lead.leadStatus === "qualified"
                                  ? "bg-green-100 text-green-800"
                                  : lead.leadStatus === "converted"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {lead.leadStatus === "new"
                            ? "신규"
                            : lead.leadStatus === "contacted"
                              ? "연락됨"
                              : lead.leadStatus === "qualified"
                                ? "적격"
                                : lead.leadStatus === "unqualified"
                                  ? "부적격"
                                  : lead.leadStatus === "converted"
                                    ? "전환됨"
                                    : lead.leadStatus === "lost"
                                      ? "손실"
                                      : "구독해지"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                총 {total}명 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}명 표시
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  이전
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {page} / {totalPages}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={bulkAddMembers.isPending}>
            취소
          </Button>
          <Button
            onClick={handleAddMembers}
            disabled={selectedLeads.length === 0 || bulkAddMembers.isPending}
          >
            {bulkAddMembers.isPending ? "추가 중..." : `${selectedLeads.length}명 추가`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
