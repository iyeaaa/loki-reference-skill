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
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ExternalLink,
  Filter,
  GripVertical,
  LayoutGrid,
  Loader2,
  Maximize2,
  Menu,
  Minimize2,
  MoreHorizontal,
  Plus,
  SortAsc,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { calculateFitScores } from "@/lib/api/hooks/lead-discovery"
import { cn } from "@/lib/utils"
import {
  type Customer,
  customersAtom,
  fitScoreStateAtom,
  removeCustomerAtom,
  selectedTargetAtom,
  setFitScoreLoadingAtom,
  streamingStateAtom,
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
        cell: ({ row }) => (
          <RowIndexCell
            rowIndex={row.index + 1}
            isSelected={row.getIsSelected()}
            onToggle={(value) => row.toggleSelected(!!value)}
          />
        ),
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
        id: "fitScore",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 -ml-2"
          >
            적합도
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
        sortingFn: (rowA, rowB) => {
          const scoreA = fitScoreState.scores[rowA.original.id] ?? 0
          const scoreB = fitScoreState.scores[rowB.original.id] ?? 0
          return scoreA - scoreB
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
    [removeCustomer, fitScoreState],
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

          {/* Filter 메뉴 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 hover:bg-accent hover:text-accent-foreground"
              >
                <Filter className="h-4 w-4" />
                Filter
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              <DropdownMenuLabel>Filter by industry</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked>All</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Software & Internet</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Business Services</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Manufacturing</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Financial Services</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Healthcare</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort 메뉴 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 hover:bg-accent hover:text-accent-foreground"
              >
                <SortAsc className="h-4 w-4" />
                Sort
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSorting([{ id: "company_name", desc: false }])}>
                Company (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSorting([{ id: "company_name", desc: true }])}>
                Company (Z-A)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSorting([{ id: "industry", desc: false }])}>
                Industry (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSorting([{ id: "industry", desc: true }])}>
                Industry (Z-A)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSorting([])}>Clear sort</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Layout 메뉴 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 hover:bg-accent hover:text-accent-foreground"
              >
                <LayoutGrid className="h-4 w-4" />
                Layout
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hamburger 메뉴 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 hover:bg-accent hover:text-accent-foreground"
              >
                <Menu className="h-4 w-4" />
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Export CSV</DropdownMenuItem>
              <DropdownMenuItem>Export Excel</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Select all</DropdownMenuItem>
              <DropdownMenuItem>Clear selection</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Insert 메뉴 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="h-4 w-4" />
                Insert
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              <DropdownMenuLabel>Add new</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Add customer</DropdownMenuItem>
              <DropdownMenuItem>Import from CSV</DropdownMenuItem>
              <DropdownMenuItem>Bulk import</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b border-border/30 hover:bg-muted/40"
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
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-[400px] text-center align-middle">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <p className="text-base font-medium">아직 발견된 고객이 없습니다</p>
                    <p className="text-sm mt-2">채팅으로 새로운 잠재 고객을 찾아보세요</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
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
