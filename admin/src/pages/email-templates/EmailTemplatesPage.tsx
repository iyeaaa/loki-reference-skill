import { Plus, Search, Share2, Tag, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useCurrentUser } from "@/lib/api/hooks/auth"
// Import API and types
import {
  useBulkDeleteEmailTemplates,
  useBulkUpdateEmailTemplateCategory,
  useBulkUpdateEmailTemplateShared,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
} from "@/lib/api/hooks/email-templates"
import { workspacesApi } from "@/lib/api/services/workspaces"
import type { EmailTemplate } from "@/lib/api/types/email-template"
import type { Workspace } from "@/lib/api/types/workspace"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { BulkActionModal } from "./BulkActionModal"
import { EmailTemplateFilters } from "./EmailTemplateFilters"
import { EmailTemplateForm } from "./EmailTemplateForm"
import { EmailTemplatesTableWithPagination } from "./EmailTemplatesTableWithPagination"

export default function EmailTemplatesPage() {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()
  const { data: currentUser } = useCurrentUser()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSharedStatuses, setSelectedSharedStatuses] = useState<string[]>([])
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
    () => localStorage.getItem("selectedWorkspace") || "all",
  )

  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<"category" | "shared" | null>(null)

  const createTemplate = useCreateEmailTemplate()
  const updateTemplate = useUpdateEmailTemplate()
  // const _deleteTemplate = useDeleteEmailTemplate()
  const bulkUpdateCategory = useBulkUpdateEmailTemplateCategory()
  const bulkUpdateShared = useBulkUpdateEmailTemplateShared()
  const bulkDelete = useBulkDeleteEmailTemplates()

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

  // localStorage의 selectedWorkspace 변경 감지
  useEffect(() => {
    const handleStorageChange = () => {
      const newWorkspaceId = localStorage.getItem("selectedWorkspace") || "all"
      setSelectedWorkspaceId(newWorkspaceId)
    }

    // storage 이벤트 리스너 추가
    window.addEventListener("storage", handleStorageChange)

    // 컴포넌트가 포커스를 받을 때마다 확인
    const intervalId = setInterval(() => {
      const currentWorkspaceId = localStorage.getItem("selectedWorkspace") || "all"
      if (currentWorkspaceId !== selectedWorkspaceId) {
        setSelectedWorkspaceId(currentWorkspaceId)
      }
    }, 500)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(intervalId)
    }
  }, [selectedWorkspaceId])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleCreateTemplate = async (templateData: unknown) => {
    if (!selectedWorkspace?.id) {
      toast.error("워크스페이스를 선택해주세요")
      return
    }

    const data = templateData as {
      name: string
      description?: string
      subject: string
      bodyText?: string
      bodyHtml?: string
      category?: string
      isShared?: boolean
    }

    createTemplate.mutate(
      {
        workspaceId: selectedWorkspace.id,
        name: data.name,
        description: data.description || null,
        subject: data.subject,
        bodyText: data.bodyText || null,
        bodyHtml: data.bodyHtml || null,
        category: data.category || null,
        isShared: data.isShared ?? false,
        createdBy: currentUser?.id,
      },
      {
        onSuccess: () => {
          setCreatingTemplate(false)
        },
      },
    )
  }

  const handleUpdateTemplate = async (templateData: unknown) => {
    if (!editingTemplate) {
      return
    }
    const data = templateData as Partial<EmailTemplate>
    updateTemplate.mutate(
      {
        templateId: editingTemplate.id,
        data: {
          name: data.name || editingTemplate.name,
          description:
            data.description !== undefined ? data.description || null : editingTemplate.description,
          subject: data.subject || editingTemplate.subject,
          bodyText: data.bodyText !== undefined ? data.bodyText : editingTemplate.bodyText,
          bodyHtml: data.bodyHtml !== undefined ? data.bodyHtml : editingTemplate.bodyHtml,
          variables:
            data.variables !== undefined ? data.variables || null : editingTemplate.variables,
          category: data.category !== undefined ? data.category || null : editingTemplate.category,
          isShared: data.isShared ?? editingTemplate.isShared,
        },
      },
      {
        onSuccess: () => {
          setEditingTemplate(null)
        },
      },
    )
  }

  const handleBulkDelete = async () => {
    if (selectedTemplates.length === 0) {
      return
    }

    if (
      !confirm(t("emailTemplates.confirm.deleteTemplates", { count: selectedTemplates.length }))
    ) {
      return
    }

    bulkDelete.mutate(selectedTemplates, {
      onSuccess: () => {
        setSelectedTemplates([])
      },
    })
  }

  const handleBulkAction = async (actionType: string, value: string | string[]) => {
    if (selectedTemplates.length === 0) {
      toast.error(t("emailTemplates.toast.noTemplatesSelected"))
      return
    }

    if (actionType === "category") {
      bulkUpdateCategory.mutate(
        { templateIds: selectedTemplates, category: value as string },
        {
          onSuccess: () => {
            setSelectedTemplates([])
          },
        },
      )
    } else if (actionType === "shared") {
      const isShared = value === "true"
      bulkUpdateShared.mutate(
        { templateIds: selectedTemplates, isShared },
        {
          onSuccess: () => {
            setSelectedTemplates([])
          },
        },
      )
    }
  }

  const openBulkActionModal = (type: "category" | "shared") => {
    if (selectedTemplates.length === 0) {
      toast.error(t("emailTemplates.toast.noTemplatesSelected"))
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
    setSelectedCategories([])
    setSelectedSharedStatuses([])
    setSelectedWorkspaces([])
    setSearchInput("")
    setSearchQuery("")
  }

  const toggleTemplateSelection = useCallback((templateId: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(templateId) ? prev.filter((id) => id !== templateId) : [...prev, templateId],
    )
  }, [])

  const toggleAllTemplates = useCallback((templateIds: string[]) => {
    setSelectedTemplates((prev) => (prev.length === templateIds.length ? [] : templateIds))
  }, [])

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Filters */}
      <EmailTemplateFilters
        onCategoryChange={setSelectedCategories}
        onClearFilters={clearFilters}
        onSharedStatusChange={setSelectedSharedStatuses}
        onWorkspaceChange={setSelectedWorkspaces}
        selectedCategories={selectedCategories}
        selectedSharedStatuses={selectedSharedStatuses}
        selectedWorkspaces={selectedWorkspaces}
        workspaces={workspaces}
      />

      {/* Email Templates Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {t("emailTemplates.title.templateManagement")}
            </CardTitle>
            <Button onClick={() => setCreatingTemplate(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              템플릿 추가
            </Button>
          </div>
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
                placeholder={t("emailTemplates.search.placeholder")}
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
          {selectedTemplates.length > 0 && (
            <div className="mb-6 flex items-center gap-4">
              <div className="text-muted-foreground text-sm">
                <span className="font-medium">
                  {selectedTemplates.length}
                  {t("emailTemplates.status.selectedCount")}
                </span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => openBulkActionModal("category")} size="sm" variant="outline">
                  <Tag className="mr-1 h-4 w-4" />
                  {t("emailTemplates.button.changeCategory")}
                </Button>
                <Button onClick={() => openBulkActionModal("shared")} size="sm" variant="outline">
                  <Share2 className="mr-1 h-4 w-4" />
                  {t("emailTemplates.button.changeSharedStatus")}
                </Button>
                <Button
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleBulkDelete}
                  size="sm"
                  variant="outline"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  {t("emailTemplates.button.deleteSelected")}
                </Button>
              </div>
            </div>
          )}

          {/* Email Templates Table with Pagination */}
          <EmailTemplatesTableWithPagination
            onEditTemplate={setEditingTemplate}
            onToggleAll={toggleAllTemplates}
            onToggleTemplate={toggleTemplateSelection}
            searchQuery={searchQuery}
            selectedCategories={selectedCategories}
            selectedSharedStatuses={selectedSharedStatuses}
            selectedTemplates={selectedTemplates}
            selectedWorkspaces={selectedWorkspaceId !== "all" ? [selectedWorkspaceId] : []}
          />
        </CardContent>
      </Card>

      {/* Create Template Dialog */}
      <Dialog onOpenChange={setCreatingTemplate} open={creatingTemplate}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">템플릿 추가</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            <EmailTemplateForm
              onCancel={() => setCreatingTemplate(false)}
              onSave={handleCreateTemplate}
              workspaces={workspaces}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog onOpenChange={() => setEditingTemplate(null)} open={!!editingTemplate}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">
              {t("emailTemplates.dialog.editTemplate")}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            {editingTemplate && (
              <EmailTemplateForm
                isEdit={true}
                onCancel={() => setEditingTemplate(null)}
                onSave={handleUpdateTemplate}
                template={editingTemplate}
                workspaces={workspaces}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Modal */}
      <BulkActionModal
        actionType={bulkActionType}
        isOpen={showBulkActionModal}
        onClose={() => {
          setShowBulkActionModal(false)
          setBulkActionType(null)
        }}
        onConfirm={handleBulkAction}
        templateCount={selectedTemplates.length}
        workspaces={workspaces}
      />
    </div>
  )
}
