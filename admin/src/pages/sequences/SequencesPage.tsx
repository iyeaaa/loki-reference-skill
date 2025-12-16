import { LayoutGrid, LayoutList, Plus, Search, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useBulkDeleteSequences, useBulkUpdateSequenceStatus } from "@/lib/api/hooks/sequences"
import type { Sequence } from "@/lib/api/types/sequence"
import { CampaignCardView } from "./CampaignCardView"
import { SequencesDashboard } from "./SequencesDashboard"
import { SequencesTableWithPagination } from "./SequencesTableWithPagination"

export default function SequencesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"list" | "card">(() => {
    const savedViewMode = localStorage.getItem("sequences-view-mode")
    return (savedViewMode as "list" | "card") || "card"
  })

  const [selectedSequences, setSelectedSequences] = useState<string[]>([])

  const bulkUpdateStatus = useBulkUpdateSequenceStatus()
  const bulkDeleteSequences = useBulkDeleteSequences()

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem("sequences-view-mode", viewMode)
  }, [viewMode])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleCreateCampaign = () => {
    navigate("/sequences/create")
  }

  const handleEditSequence = (sequence: Sequence) => {
    // 초안 상태면 Create 페이지로, 아니면 Edit 페이지로
    if (sequence.status === "draft") {
      navigate(`/sequences/create?id=${sequence.id}`)
    } else {
      navigate(`/sequences/edit?id=${sequence.id}`)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedSequences.length === 0) {
      return
    }

    if (!confirm(t("sequences.confirm.deleteSequences", { count: selectedSequences.length }))) {
      return
    }

    bulkDeleteSequences.mutate(selectedSequences, {
      onSuccess: () => {
        setSelectedSequences([])
      },
    })
  }

  const handleBulkStart = async () => {
    if (selectedSequences.length === 0) {
      toast.error(t("sequences.toast.noSequencesSelected"))
      return
    }

    bulkUpdateStatus.mutate(
      { sequenceIds: selectedSequences, status: "active" },
      {
        onSuccess: () => {
          setSelectedSequences([])
        },
      },
    )
  }

  const handleBulkPause = async () => {
    if (selectedSequences.length === 0) {
      toast.error(t("sequences.toast.noSequencesSelected"))
      return
    }

    bulkUpdateStatus.mutate(
      { sequenceIds: selectedSequences, status: "paused" },
      {
        onSuccess: () => {
          setSelectedSequences([])
        },
      },
    )
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearchQuery(searchInput)
    }
  }

  const toggleSequenceSelection = useCallback((sequenceId: string) => {
    setSelectedSequences((prev) =>
      prev.includes(sequenceId) ? prev.filter((id) => id !== sequenceId) : [...prev, sequenceId],
    )
  }, [])

  const toggleAllSequences = useCallback((sequenceIds: string[]) => {
    setSelectedSequences((prev) => (prev.length === sequenceIds.length ? [] : sequenceIds))
  }, [])

  const selectedStatuses = selectedStatus === "all" ? [] : [selectedStatus]

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Dashboard */}
      <SequencesDashboard />

      {/* Sequences Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex flex-col">
            {/* Status Filter Tabs */}
            <div className="mb-4">
              <Tabs onValueChange={setSelectedStatus} value={selectedStatus}>
                <TabsList>
                  <TabsTrigger value="all">{t("sequences.filter.all")}</TabsTrigger>
                  <TabsTrigger value="draft">{t("sequences.table.status.draft")}</TabsTrigger>
                  <TabsTrigger value="active">{t("sequences.table.status.active")}</TabsTrigger>
                  <TabsTrigger value="paused">{t("sequences.table.status.paused")}</TabsTrigger>
                  <TabsTrigger value="completed">
                    {t("sequences.table.status.completed")}
                  </TabsTrigger>
                  <TabsTrigger value="archived">{t("sequences.table.status.archived")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              onValueChange={(value) => {
                if (value) {
                  setViewMode(value as "list" | "card")
                }
              }}
              type="single"
              value={viewMode}
            >
              <ToggleGroupItem aria-label="카드 뷰" value="card">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem aria-label="리스트 뷰" value="list">
                <LayoutList className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={handleCreateCampaign} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              {t("sequences.button.newSequence")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search input */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-full pr-10 pl-10"
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("sequences.search.placeholder")}
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
          {selectedSequences.length > 0 && (
            <div className="mb-6 flex items-center gap-4">
              <div className="text-muted-foreground text-sm">
                <span className="font-medium">
                  {selectedSequences.length}
                  {t("sequences.status.selectedCount")}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  className="text-green-600 hover:bg-green-50 hover:text-green-700"
                  onClick={handleBulkStart}
                  size="sm"
                  variant="outline"
                >
                  {t("sequences.button.bulkStart")}
                </Button>
                <Button
                  className="text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700"
                  onClick={handleBulkPause}
                  size="sm"
                  variant="outline"
                >
                  {t("sequences.button.bulkPause")}
                </Button>
                <Button
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleBulkDelete}
                  size="sm"
                  variant="outline"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  {t("sequences.button.deleteSelected")}
                </Button>
              </div>
            </div>
          )}

          {/* Sequences View */}
          {viewMode === "list" ? (
            <SequencesTableWithPagination
              onEditSequence={handleEditSequence}
              onToggleAll={toggleAllSequences}
              onToggleSequence={toggleSequenceSelection}
              searchQuery={searchQuery}
              selectedSequences={selectedSequences}
              selectedStatuses={selectedStatuses}
            />
          ) : (
            <CampaignCardView
              onEditSequence={handleEditSequence}
              onToggleSequence={toggleSequenceSelection}
              searchQuery={searchQuery}
              selectedSequences={selectedSequences}
              selectedStatuses={selectedStatuses}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
