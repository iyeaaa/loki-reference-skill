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
    if (selectedSequences.length === 0) return

    if (!confirm(t("sequences.confirm.deleteSequences", { count: selectedSequences.length })))
      return

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
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Dashboard */}
      <SequencesDashboard />

      {/* Sequences Table */}
      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
          <div className="flex flex-col">
            {/* Status Filter Tabs */}
            <div className="mb-4">
              <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
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
              type="single"
              value={viewMode}
              onValueChange={(value) => {
                if (value) setViewMode(value as "list" | "card")
              }}
            >
              <ToggleGroupItem value="card" aria-label="카드 뷰">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="리스트 뷰">
                <LayoutList className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={handleCreateCampaign} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t("sequences.button.newSequence")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search input */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("sequences.search.placeholder")}
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
          {selectedSequences.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">
                  {selectedSequences.length}
                  {t("sequences.status.selectedCount")}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkStart}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  {t("sequences.button.bulkStart")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkPause}
                  className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                >
                  {t("sequences.button.bulkPause")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t("sequences.button.deleteSelected")}
                </Button>
              </div>
            </div>
          )}

          {/* Sequences View */}
          {viewMode === "list" ? (
            <SequencesTableWithPagination
              searchQuery={searchQuery}
              selectedStatuses={selectedStatuses}
              selectedSequences={selectedSequences}
              onToggleSequence={toggleSequenceSelection}
              onToggleAll={toggleAllSequences}
              onEditSequence={handleEditSequence}
            />
          ) : (
            <CampaignCardView
              searchQuery={searchQuery}
              selectedStatuses={selectedStatuses}
              selectedSequences={selectedSequences}
              onToggleSequence={toggleSequenceSelection}
              onEditSequence={handleEditSequence}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
