import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import { AnimatePresence, motion } from "framer-motion"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCustomerGroupsByWorkspace } from "@/lib/api/hooks/customer-groups"
import { calculateFitScores, enrichLeads } from "@/lib/api/hooks/lead-discovery"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"
import {
  type Customer,
  customersAtom,
  enrichmentStateAtom,
  finishEnrichmentAtom,
  fitScoreStateAtom,
  removeCustomerAtom,
  selectedTargetAtom,
  setFitScoreLoadingAtom,
  startEnrichmentAtom,
  streamingStateAtom,
  updateCustomerAtom,
  updateFitScoreAtom,
} from "./store"

// 적합도 배지 컴포넌트
function FitScoreBadge({ score, isLoading }: { score?: number; isLoading?: boolean }) {
  // 로딩 중
  if (isLoading || score === undefined) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  let bgColor: string
  let textColor: string

  if (score >= 80) {
    bgColor = "bg-emerald-100 dark:bg-emerald-900/30"
    textColor = "text-emerald-700 dark:text-emerald-400"
  } else if (score >= 50) {
    bgColor = "bg-amber-100 dark:bg-amber-900/30"
    textColor = "text-amber-700 dark:text-amber-400"
  } else {
    bgColor = "bg-rose-100 dark:bg-rose-900/30"
    textColor = "text-rose-700 dark:text-rose-400"
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center w-8 h-6 rounded-full text-xs font-medium tabular-nums",
        bgColor,
        textColor,
      )}
    >
      {score}
    </div>
  )
}

// 행 번호 + 체크박스 셀 컴포넌트 (CSS group-hover 사용)
function RowIndexCell({
  rowIndex,
  isSelected,
  onToggle,
}: {
  rowIndex: number
  isSelected: boolean
  onToggle: (value: boolean) => void
}) {
  return (
    <div className="group/row flex items-center justify-center w-full h-full relative">
      {/* 행 번호 - 선택 안됨 & hover 아닐 때 표시 */}
      <span
        className={cn(
          "text-xs text-muted-foreground tabular-nums",
          "group-hover/row:hidden",
          isSelected && "hidden",
        )}
      >
        {rowIndex}
      </span>
      {/* 체크박스 - hover 또는 선택 시 표시 */}
      <div className={cn("hidden group-hover/row:block", isSelected && "!block")}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          aria-label={`Select row ${rowIndex}`}
        />
      </div>
    </div>
  )
}

interface CustomerTableProps {
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

export function CustomerTable({ isFullscreen, onToggleFullscreen }: CustomerTableProps) {
  const [customers] = useAtom(customersAtom)
  const removeCustomer = useSetAtom(removeCustomerAtom)
  const streamingState = useAtomValue(streamingStateAtom)

  // 적합도 점수 상태
  const fitScoreState = useAtomValue(fitScoreStateAtom)
  const updateFitScore = useSetAtom(updateFitScoreAtom)
  const setFitScoreLoading = useSetAtom(setFitScoreLoadingAtom)

  // 선택된 바이어 타겟 (스트리밍 완료 후에도 유지)
  const selectedTarget = useAtomValue(selectedTargetAtom)

  // 고객그룹 추가 관련 상태
  const { selectedWorkspace } = useWorkspace()
  const workspaceId = selectedWorkspace?.id || ""
  const { data: customerGroups = [] } = useCustomerGroupsByWorkspace(
    workspaceId,
    !!workspaceId && workspaceId !== "all",
  )
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [isAddingToGroup, setIsAddingToGroup] = useState(false)

  // Enrichment 관련 상태
  const enrichmentState = useAtomValue(enrichmentStateAtom)
  const startEnrichment = useSetAtom(startEnrichmentAtom)
  const finishEnrichment = useSetAtom(finishEnrichmentAtom)
  const updateCustomer = useSetAtom(updateCustomerAtom)
  const [isEnriching, setIsEnriching] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0, name: "" })

  // API 호출 중 여부 추적
  const isCalculatingRef = useRef(false)

  // 고객이 있고 선택된 추천이 있으면 적합도 계산 API 호출
  useEffect(() => {
    console.log("[FitScore] useEffect 실행", {
      customersLength: customers.length,
      selectedTarget: selectedTarget
        ? `${selectedTarget.country}/${selectedTarget.industry}`
        : null,
      isCalculating: isCalculatingRef.current,
      scoresCount: Object.keys(fitScoreState.scores).length,
    })

    // 조건: 고객이 있고, 선택된 타겟이 있고, API 호출 중이 아닐 때
    if (customers.length === 0) {
      console.log("[FitScore] 조건 실패: 고객이 없음")
      return
    }
    if (!selectedTarget) {
      console.log("[FitScore] 조건 실패: 선택된 타겟이 없음")
      return
    }
    if (isCalculatingRef.current) {
      console.log("[FitScore] 조건 실패: 이미 계산 중")
      return
    }

    // 점수가 없는 고객 찾기
    const customersToScore = customers.filter((c) => fitScoreState.scores[c.id] === undefined)

    if (customersToScore.length === 0) {
      console.log("[FitScore] 조건 실패: 점수 계산할 고객이 없음")
      return
    }

    console.log(`[FitScore] 적합도 계산 시작: ${customersToScore.length}개 리드`)
    isCalculatingRef.current = true

    // 로딩 상태 설정
    setFitScoreLoading({ isLoading: true, progress: 0 })

    // API 호출
    calculateFitScores(
      customersToScore.map((c) => ({
        id: c.id,
        company_name: c.company_name,
        email: c.email,
        phone: c.phone,
        web_address: c.web_address,
        country: c.country,
        industry: c.industry,
        sub_industry: c.sub_industry,
        employee: c.employee,
        revenue: c.revenue,
        title: c.title,
      })),
      {
        companyName: streamingState.analysisSummary ? "분석된 회사" : undefined,
        description: streamingState.analysisSummary,
      },
      {
        country: selectedTarget.country,
        industry: selectedTarget.industry,
      },
      {
        onScore: (leadId, score) => {
          updateFitScore({ leadId, score })
        },
        onProgress: (progress) => {
          setFitScoreLoading({ isLoading: true, progress })
        },
        onComplete: () => {
          console.log("[FitScore] 적합도 계산 완료")
          setFitScoreLoading({ isLoading: false, progress: 100 })
          isCalculatingRef.current = false
        },
        onError: (error) => {
          console.error("[FitScore] 적합도 계산 에러:", error)
          setFitScoreLoading({ isLoading: false, progress: 0 })
          isCalculatingRef.current = false
        },
      },
    )
  }, [
    customers,
    selectedTarget,
    fitScoreState.scores,
    streamingState.analysisSummary,
    updateFitScore,
    setFitScoreLoading,
  ])

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  // 드래그 상태
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)

  // 고객그룹에 추가
  const handleAddToGroup = useCallback(async () => {
    if (!selectedGroupId) {
      toast.error("고객그룹을 선택해주세요")
      return
    }

    const selectedRowIds = Object.keys(rowSelection).filter(
      (key) => rowSelection[key as keyof typeof rowSelection],
    )

    if (selectedRowIds.length === 0) {
      toast.error("추가할 리드를 선택해주세요")
      return
    }

    // 선택된 고객 데이터 가져오기
    const selectedCustomers = customers.filter((_, index) =>
      selectedRowIds.includes(index.toString()),
    )

    if (selectedCustomers.length === 0) {
      toast.error("추가할 리드를 선택해주세요")
      return
    }

    setIsAddingToGroup(true)

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || ""
      const response = await fetch(`${API_BASE_URL}/api/v1/bigquery/add-to-group`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          groupId: selectedGroupId,
          leads: selectedCustomers.map((customer) => ({
            email: customer.email,
            firstName: customer.first_name,
            lastName: customer.last_name,
            companyName: customer.company_name,
            phone: customer.phone,
            country: customer.country,
            city: customer.primary_city,
            industry: customer.industry,
            webAddress: customer.web_address,
          })),
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to add leads")
      }

      toast.success(`${result.addedCount}개의 리드가 고객그룹에 추가되었습니다`)
      setRowSelection({})
    } catch (error) {
      console.error("Error adding to group:", error)
      toast.error("고객그룹 추가에 실패했습니다")
    } finally {
      setIsAddingToGroup(false)
    }
  }, [selectedGroupId, rowSelection, customers])

  // 선택된 리드 enrichment
  const handleEnrichment = useCallback(async () => {
    const selectedRowIds = Object.keys(rowSelection).filter(
      (key) => rowSelection[key as keyof typeof rowSelection],
    )

    if (selectedRowIds.length === 0) {
      toast.error("Enrichment할 리드를 선택해주세요")
      return
    }

    // 선택된 고객 데이터 가져오기 (웹사이트가 있는 것만)
    const selectedCustomers = customers
      .filter((_, index) => selectedRowIds.includes(index.toString()))
      .filter((c) => c.web_address)

    if (selectedCustomers.length === 0) {
      toast.error("웹사이트 정보가 있는 리드만 Enrichment 가능합니다")
      return
    }

    setIsEnriching(true)
    const customerIds = selectedCustomers.map((c) => c.id)
    startEnrichment(customerIds)

    await enrichLeads(
      selectedCustomers.map((c) => ({
        id: c.id,
        webAddress: c.web_address || "",
        companyName: c.company_name || "",
      })),
      {
        onProgress: (completed, total, name) => {
          setEnrichProgress({ current: completed + 1, total, name })
        },
        onResult: (leadId, result) => {
          // 고객 정보 업데이트
          updateCustomer(leadId, {
            description: result.companyInfo.description,
          })
          finishEnrichment(leadId)
        },
        onError: (leadId, error) => {
          console.error(`Enrichment failed for ${leadId}:`, error)
          finishEnrichment(leadId, error)
        },
        onComplete: () => {
          setIsEnriching(false)
          setEnrichProgress({ current: 0, total: 0, name: "" })
          toast.success(`${selectedCustomers.length}개 리드의 Enrichment가 완료되었습니다`)
          setRowSelection({})
        },
      },
    )
  }, [rowSelection, customers, startEnrichment, finishEnrichment, updateCustomer])

  // 적합도 계산 완료 시 자동 정렬
  const hasSortedRef = useRef(false)
  const prevScoresCountRef = useRef(0)

  useEffect(() => {
    const scoresCount = Object.keys(fitScoreState.scores).length
    const customersCount = customers.length

    // 점수가 새로 계산되기 시작하면 정렬 플래그 리셋
    if (scoresCount < prevScoresCountRef.current) {
      hasSortedRef.current = false
    }
    prevScoresCountRef.current = scoresCount

    // 모든 고객의 점수가 계산 완료되고, 아직 정렬하지 않았으면 정렬
    if (
      !hasSortedRef.current &&
      !fitScoreState.isLoading &&
      scoresCount > 0 &&
      scoresCount >= customersCount
    ) {
      console.log("[FitScore] 자동 정렬 실행:", scoresCount, "scores")
      // 정렬 상태를 클리어했다가 다시 설정 (캐싱 방지)
      setSorting([])
      requestAnimationFrame(() => {
        setSorting([{ id: "fitScore", desc: true }])
      })
      hasSortedRef.current = true
    }
  }, [fitScoreState.isLoading, fitScoreState.scores, customers.length])

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row, table }) => {
          // 정렬된 순서의 인덱스 계산
          const sortedIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id) + 1
          return (
            <RowIndexCell
              rowIndex={sortedIndex}
              isSelected={row.getIsSelected()}
              onToggle={(value) => row.toggleSelected(!!value)}
            />
          )
        },
        enableSorting: false,
        enableHiding: false,
        size: 50,
      },
      {
        accessorKey: "company_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 -ml-2"
          >
            Company
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-medium max-w-[200px] truncate block">
            {row.getValue("company_name") || "-"}
          </span>
        ),
      },
      {
        accessorKey: "web_address",
        header: "Website",
        cell: ({ row }) => {
          const webAddress = row.getValue("web_address") as string | undefined
          if (!webAddress) return <span className="text-xs text-muted-foreground">-</span>
          return (
            <a
              href={webAddress.startsWith("http") ? webAddress : `https://${webAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              title={webAddress}
            >
              <span className="truncate max-w-[140px]">
                {webAddress.replace(/^https?:\/\//, "")}
              </span>
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          )
        },
      },
      {
        id: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 -ml-2"
          >
            Name
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const firstName = row.original.first_name
          const lastName = row.original.last_name
          const fullName = [firstName, lastName].filter(Boolean).join(" ")
          return <span>{fullName || "-"}</span>
        },
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 -ml-2"
          >
            Email
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate font-mono text-xs block">
            {row.getValue("email") || "-"}
          </span>
        ),
      },
      {
        accessorKey: "industry",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 -ml-2"
          >
            Industry
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const industry = row.getValue("industry") as string | undefined
          const subIndustry = row.original.sub_industry
          return (
            <div className="flex flex-col">
              <span className="text-xs">{industry || "-"}</span>
              {subIndustry && (
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {subIndustry}
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: "location",
        header: "Location",
        cell: ({ row }) => {
          const country = row.original.country
          const city = row.original.primary_city
          const state = row.original.primary_state
          return (
            <div className="flex flex-col text-xs">
              <span>{country || "-"}</span>
              <span className="text-muted-foreground">
                {city}
                {state && `, ${state}`}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: "employee",
        header: "Employees",
        cell: ({ row }) => {
          const employee = row.getValue("employee") as string | undefined
          return (
            <Badge variant="outline" className="text-xs font-normal">
              {employee || "-"}
            </Badge>
          )
        },
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.getValue("phone") || "-"}</span>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const description = row.getValue("description") as string | undefined
          const isLoading = enrichmentState.loadingIds.has(row.original.id)

          if (isLoading) {
            return (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">분석 중...</span>
              </div>
            )
          }

          if (!description) {
            return <span className="text-muted-foreground text-xs">-</span>
          }

          return (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-xs line-clamp-2 max-w-[200px] text-left hover:text-primary cursor-pointer transition-colors"
                >
                  {description}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] max-h-[300px] overflow-y-auto" align="start">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Company Description</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </div>
              </PopoverContent>
            </Popover>
          )
        },
        size: 200,
      },
      {
        id: "fitScore",
        accessorFn: (row) => fitScoreState.scores[row.id] ?? -1,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 -ml-2"
          >
            Fit Score
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const score = fitScoreState.scores[row.original.id]
          const isLoading = fitScoreState.isLoading && score === undefined
          return <FitScoreBadge score={score} isLoading={isLoading} />
        },
        size: 70,
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          const customer = row.original

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(customer.email || "")}
                >
                  Copy email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => removeCustomer(customer.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [removeCustomer, fitScoreState, enrichmentState],
  )

  const table = useReactTable({
    data: customers,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnOrder,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  })

  // 컬럼 드래그 핸들러
  const handleDragStart = useCallback((columnId: string) => {
    setDraggedColumn(columnId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (targetColumnId: string) => {
      if (!draggedColumn || draggedColumn === targetColumnId) return

      const currentOrder = columnOrder.length > 0 ? columnOrder : columns.map((c) => c.id as string)
      const draggedIndex = currentOrder.indexOf(draggedColumn)
      const targetIndex = currentOrder.indexOf(targetColumnId)

      if (draggedIndex === -1 || targetIndex === -1) return

      const newOrder = [...currentOrder]
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, draggedColumn)

      setColumnOrder(newOrder)
      setDraggedColumn(null)
    },
    [draggedColumn, columnOrder, columns],
  )

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 툴바 */}
      <div className="flex items-center justify-between px-2 py-2 border-b gap-2">
        <div className="flex items-center gap-1 flex-1">
          {/* 전체화면 토글 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="shrink-0 h-8 w-8"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* 고객그룹 선택 및 추가 - 리드 선택 시 표시 */}
          {Object.keys(rowSelection).length > 0 && (
            <>
              <span className="text-sm font-medium text-primary">
                {Object.keys(rowSelection).length}개 선택
              </span>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="h-8 w-[160px] text-sm">
                  <SelectValue placeholder="고객그룹 선택" />
                </SelectTrigger>
                <SelectContent>
                  {customerGroups.length > 0 ? (
                    customerGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      고객그룹이 없습니다
                    </div>
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 gap-1"
                onClick={handleAddToGroup}
                disabled={isAddingToGroup || !selectedGroupId || customerGroups.length === 0}
              >
                {isAddingToGroup ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                추가
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={handleEnrichment}
                disabled={isEnriching}
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {enrichProgress.total > 0
                      ? `${enrichProgress.current}/${enrichProgress.total}`
                      : "..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Enrich
                  </>
                )}
              </Button>
            </>
          )}

          <span className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} results
          </span>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 min-h-0 overflow-scroll border rounded-md [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-muted/30">
        <Table className="border-collapse">
          <TableHeader className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border/50 hover:bg-transparent"
              >
                {headerGroup.headers.map((header, index) => {
                  const canDrag = header.column.id !== "select" && header.column.id !== "actions"
                  const isFirstColumn = index === 0
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      draggable={canDrag}
                      onDragStart={() => canDrag && handleDragStart(header.column.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => canDrag && handleDrop(header.column.id)}
                      className={cn(
                        "border-r border-border/30 bg-zinc-50 dark:bg-zinc-900",
                        isFirstColumn && "sticky left-0 z-20",
                        canDrag && "cursor-grab",
                        draggedColumn === header.column.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {canDrag && <GripVertical className="h-3 w-3 text-muted-foreground/50" />}
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <motion.tr
                    key={row.original.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{
                      layout: { type: "spring", stiffness: 350, damping: 30 },
                      opacity: { duration: 0.2 },
                    }}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-b border-border/30 hover:bg-muted/40 data-[state=selected]:bg-muted"
                  >
                    {row.getVisibleCells().map((cell, index) => {
                      const isFirstColumn = index === 0
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "border-r border-border/20",
                            isFirstColumn && "bg-zinc-50 dark:bg-zinc-900 sticky left-0 z-10",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </motion.tr>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="h-[400px] text-center align-middle"
                  >
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <p className="text-base font-medium">아직 발견된 고객이 없습니다</p>
                      <p className="text-sm mt-2">채팅으로 새로운 잠재 고객을 찾아보세요</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* 푸터 - 선택 정보 */}
      {Object.keys(rowSelection).length > 0 && (
        <div className="flex items-center justify-between p-4 border-t bg-muted/50">
          <span className="text-sm text-muted-foreground">
            {Object.keys(rowSelection).length} of {table.getFilteredRowModel().rows.length} row(s)
            selected.
          </span>
          <Button variant="outline" size="sm" onClick={() => setRowSelection({})}>
            Clear selection
          </Button>
        </div>
      )}
    </div>
  )
}
