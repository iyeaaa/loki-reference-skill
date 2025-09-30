import { Search, Share2, Tag, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
// Import API and types
import {
  useBulkDeleteEmailTemplates,
  useBulkUpdateEmailTemplateCategory,
  useBulkUpdateEmailTemplateShared,
  useUpdateEmailTemplate,
} from "@/lib/api/hooks/email-templates"
import { workspacesApi } from "@/lib/api/services/workspaces"
import type { EmailTemplate } from "@/lib/api/types/email-template"
import type { Workspace } from "@/lib/api/types/workspace"
import { BulkActionModal } from "./BulkActionModal"
import { EmailTemplateFilters } from "./EmailTemplateFilters"
import { EmailTemplateForm } from "./EmailTemplateForm"
import { EmailTemplatesTableWithPagination } from "./EmailTemplatesTableWithPagination"

export default function EmailTemplatesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSharedStatuses, setSelectedSharedStatuses] = useState<string[]>([])
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([])

  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<"category" | "shared" | null>(null)

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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleUpdateTemplate = async (templateData: unknown) => {
    if (!editingTemplate) return
    const data = templateData as Partial<EmailTemplate>
    updateTemplate.mutate(
      {
        templateId: editingTemplate.id,
        data: {
          name: data.name || editingTemplate.name,
          description: data.description,
          subject: data.subject || editingTemplate.subject,
          bodyText: data.bodyText,
          bodyHtml: data.bodyHtml,
          variables: data.variables,
          category: data.category,
          isShared: data.isShared ?? editingTemplate.isShared,
        },
      },
      {
        onSuccess: () => {
          setEditingTemplate(null)
        },
      }
    )
  }

  const handleBulkDelete = async () => {
    if (selectedTemplates.length === 0) return

    if (
      !confirm(
        `선택한 ${selectedTemplates.length}개의 템플릿을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`
      )
    )
      return

    bulkDelete.mutate(selectedTemplates, {
      onSuccess: () => {
        setSelectedTemplates([])
      },
    })
  }

  const handleBulkAction = async (actionType: string, value: string | string[]) => {
    if (selectedTemplates.length === 0) {
      toast.error("선택된 템플릿이 없습니다.")
      return
    }

    if (actionType === "category") {
      bulkUpdateCategory.mutate(
        { templateIds: selectedTemplates, category: value as string },
        {
          onSuccess: () => {
            setSelectedTemplates([])
          },
        }
      )
    } else if (actionType === "shared") {
      const isShared = value === "true"
      bulkUpdateShared.mutate(
        { templateIds: selectedTemplates, isShared },
        {
          onSuccess: () => {
            setSelectedTemplates([])
          },
        }
      )
    }
  }

  const openBulkActionModal = (type: "category" | "shared") => {
    if (selectedTemplates.length === 0) {
      toast.error("선택된 템플릿이 없습니다.")
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
      prev.includes(templateId) ? prev.filter((id) => id !== templateId) : [...prev, templateId]
    )
  }, [])

  const toggleAllTemplates = useCallback((templateIds: string[]) => {
    setSelectedTemplates((prev) => (prev.length === templateIds.length ? [] : templateIds))
  }, [])

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <EmailTemplateFilters
        selectedCategories={selectedCategories}
        selectedSharedStatuses={selectedSharedStatuses}
        selectedWorkspaces={selectedWorkspaces}
        workspaces={workspaces}
        onCategoryChange={setSelectedCategories}
        onSharedStatusChange={setSelectedSharedStatuses}
        onWorkspaceChange={setSelectedWorkspaces}
        onClearFilters={clearFilters}
      />

      {/* Email Templates Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">이메일 템플릿 관리</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search input - positioned below title */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="템플릿명, 제목으로 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-10 pr-10 w-full"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("")
                    setSearchQuery("")
                  }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedTemplates.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{selectedTemplates.length}개 선택됨</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openBulkActionModal("category")}>
                  <Tag className="h-4 w-4 mr-1" />
                  카테고리 변경
                </Button>
                <Button variant="outline" size="sm" onClick={() => openBulkActionModal("shared")}>
                  <Share2 className="h-4 w-4 mr-1" />
                  공유 상태 변경
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  선택 삭제
                </Button>
              </div>
            </div>
          )}

          {/* Email Templates Table with Pagination */}
          <EmailTemplatesTableWithPagination
            searchQuery={searchQuery}
            selectedCategories={selectedCategories}
            selectedSharedStatuses={selectedSharedStatuses}
            selectedWorkspaces={selectedWorkspaces}
            selectedTemplates={selectedTemplates}
            onToggleTemplate={toggleTemplateSelection}
            onToggleAll={toggleAllTemplates}
            onEditTemplate={setEditingTemplate}
          />
        </CardContent>
      </Card>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">템플릿 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {editingTemplate && (
              <EmailTemplateForm
                template={editingTemplate}
                isEdit={true}
                workspaces={workspaces}
                onSave={handleUpdateTemplate}
                onCancel={() => setEditingTemplate(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Modal */}
      <BulkActionModal
        isOpen={showBulkActionModal}
        onClose={() => {
          setShowBulkActionModal(false)
          setBulkActionType(null)
        }}
        onConfirm={handleBulkAction}
        templateCount={selectedTemplates.length}
        actionType={bulkActionType}
        workspaces={workspaces}
      />
    </div>
  )
}
