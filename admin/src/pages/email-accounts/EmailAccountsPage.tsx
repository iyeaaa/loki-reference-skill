import { Mail, Search, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
// Import API and types
import {
  useBulkUpdateEmailAccountStatus,
  useDeleteEmailAccount,
  useUpdateEmailAccount,
} from "@/lib/api/hooks/email-accounts"
import { workspacesApi } from "@/lib/api/services/workspaces"
import type { EmailAccountStatus, UserEmailAccount } from "@/lib/api/types/email-account"
import type { Workspace } from "@/lib/api/types/workspace"
import { BulkActionModal } from "./BulkActionModal"
import { EmailAccountFilters } from "./EmailAccountFilters"
import { EmailAccountForm } from "./EmailAccountForm"
import { EmailAccountsTableWithPagination } from "./EmailAccountsTableWithPagination"

export default function EmailAccountsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([])
  const [selectedIsDefault, setSelectedIsDefault] = useState<string[]>([])

  const [editingAccount, setEditingAccount] = useState<UserEmailAccount | null>(null)
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<"status" | null>(null)

  const updateAccount = useUpdateEmailAccount()
  const deleteAccount = useDeleteEmailAccount()
  const bulkUpdateStatus = useBulkUpdateEmailAccountStatus()

  const loadWorkspaces = useCallback(async () => {
    try {
      const response = await workspacesApi.list({ limit: 1000 })
      setWorkspaces(response.workspaces || [])
    } catch (error) {
      console.error("Failed to load workspaces:", error)
    }
  }, [])

  // Load initial data
  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleUpdateAccount = async (accountData: unknown) => {
    if (!editingAccount) {
      return
    }
    const data = accountData as Partial<UserEmailAccount>
    updateAccount.mutate(
      {
        accountId: editingAccount.id,
        data: {
          emailAddress: data.emailAddress || editingAccount.emailAddress,
          displayName: data.displayName,
          apiKey: data.apiKey || editingAccount.apiKey,
          sendgridVerifiedSenderId: data.sendgridVerifiedSenderId,
          isVerified: data.isVerified ?? editingAccount.isVerified,
          isDefault: data.isDefault ?? editingAccount.isDefault,
          dailyLimit: data.dailyLimit,
          monthlyLimit: data.monthlyLimit,
          status: data.status || editingAccount.status,
        },
      },
      {
        onSuccess: () => {
          setEditingAccount(null)
        },
      },
    )
  }

  const handleBulkDelete = async () => {
    if (selectedAccounts.length === 0) {
      return
    }

    if (
      !confirm(
        `선택한 ${selectedAccounts.length}개의 이메일 계정을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`,
      )
    ) {
      return
    }

    for (const accountId of selectedAccounts) {
      await deleteAccount.mutateAsync(accountId)
    }
    setSelectedAccounts([])
  }

  const handleBulkAction = async (actionType: string, value: string | string[]) => {
    if (selectedAccounts.length === 0) {
      toast.error("선택된 이메일 계정이 없습니다.")
      return
    }

    if (actionType === "status") {
      bulkUpdateStatus.mutate(
        { accountIds: selectedAccounts, status: value as EmailAccountStatus },
        {
          onSuccess: () => {
            setSelectedAccounts([])
          },
        },
      )
    }
  }

  const openBulkActionModal = (type: "status") => {
    if (selectedAccounts.length === 0) {
      toast.error("선택된 이메일 계정이 없습니다.")
      return
    }
    setBulkActionType(type)
    setShowBulkActionModal(true)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearchQuery(searchInput)
    }
  }

  const clearFilters = () => {
    setSelectedStatuses([])
    setSelectedWorkspaces([])
    setSelectedIsDefault([])
    setSearchInput("")
    setSearchQuery("")
  }

  const toggleAccountSelection = useCallback((accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId],
    )
  }, [])

  const toggleAllAccounts = useCallback((accountIds: string[]) => {
    setSelectedAccounts((prev) => (prev.length === accountIds.length ? [] : accountIds))
  }, [])

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Filters */}
      <EmailAccountFilters
        onClearFilters={clearFilters}
        onIsDefaultChange={setSelectedIsDefault}
        onStatusChange={setSelectedStatuses}
        onWorkspaceChange={setSelectedWorkspaces}
        selectedIsDefault={selectedIsDefault}
        selectedStatuses={selectedStatuses}
        selectedWorkspaces={selectedWorkspaces}
        workspaces={workspaces}
      />

      {/* Email Accounts Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">이메일 계정 관리</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search input - positioned below title */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-full pr-10 pl-10"
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="이메일 주소로 검색..."
                value={searchInput}
              />
              {searchInput && (
                <button
                  className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    setSearchInput("")
                    setSearchQuery("")
                  }}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedAccounts.length > 0 && (
            <div className="mb-6 flex items-center gap-4">
              <div className="text-muted-foreground text-sm">
                <span className="font-medium">{selectedAccounts.length}개 선택됨</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => openBulkActionModal("status")} size="sm" variant="outline">
                  <Mail className="mr-1 h-4 w-4" />
                  상태 변경
                </Button>
                <Button
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleBulkDelete}
                  size="sm"
                  variant="outline"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  선택 삭제
                </Button>
              </div>
            </div>
          )}

          {/* Email Accounts Table with Pagination */}
          <EmailAccountsTableWithPagination
            onEditAccount={setEditingAccount}
            onToggleAccount={toggleAccountSelection}
            onToggleAll={toggleAllAccounts}
            searchQuery={searchQuery}
            selectedAccounts={selectedAccounts}
            selectedIsDefault={selectedIsDefault}
            selectedStatuses={selectedStatuses}
            selectedWorkspaces={selectedWorkspaces}
          />
        </CardContent>
      </Card>

      {/* Edit Account Dialog */}
      <Dialog onOpenChange={() => setEditingAccount(null)} open={!!editingAccount}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">이메일 계정 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            {editingAccount && (
              <EmailAccountForm
                account={editingAccount}
                isEdit={true}
                onCancel={() => setEditingAccount(null)}
                onSave={handleUpdateAccount}
                workspaces={workspaces}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Modal */}
      <BulkActionModal
        accountCount={selectedAccounts.length}
        actionType={bulkActionType}
        isOpen={showBulkActionModal}
        onClose={() => {
          setShowBulkActionModal(false)
          setBulkActionType(null)
        }}
        onConfirm={handleBulkAction}
      />
    </div>
  )
}
