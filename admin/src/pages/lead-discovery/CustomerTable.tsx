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
import { calculateFitScores, enrichLeads, loadMoreResults } from "@/lib/api/hooks/lead-discovery"
import { API_BASE_URL } from "@/lib/env"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"
import {
  addCustomersAtom,
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
  updateStreamingStateAtom,
} from "./store"

// 적합도 배지 컴포넌트
function FitScoreBadge({ score, isLoading }: { score?: number; isLoading?: boolean }) {
  // 로딩 중
  if (isLoading || score === undefined) {
    return (
      <div className="inline-flex h-6 w-8 items-center justify-center">
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
        "inline-flex h-6 w-8 items-center justify-center rounded-full font-medium text-xs tabular-nums",
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
    <div className="group/row relative flex h-full w-full items-center justify-center">
      {/* 행 번호 - 선택 안됨 & hover 아닐 때 표시 */}
      <span
        className={cn(
          "text-muted-foreground text-xs tabular-nums",
          "group-hover/row:hidden",
          isSelected && "hidden",
        )}
      >
        {rowIndex}
      </span>
      {/* 체크박스 - hover 또는 선택 시 표시 */}
      <div className={cn("hidden group-hover/row:block", isSelected && "!block")}>
        <Checkbox
          aria-label={`Select row ${rowIndex}`}
          checked={isSelected}
          onCheckedChange={onToggle}
        />
      </div>
    </div>
  )
}

type CustomerTableProps = {
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

export function CustomerTable({ isFullscreen, onToggleFullscreen }: CustomerTableProps) {
  const [customers] = useAtom(customersAtom)
  const removeCustomer = useSetAtom(removeCustomerAtom)
  const addCustomers = useSetAtom(addCustomersAtom)
  const streamingState = useAtomValue(streamingStateAtom)
  const updateStreamingState = useSetAtom(updateStreamingStateAtom)

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

  // 더 가져오기 상태
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // API 호출 중 여부 추적
  const isCalculatingRef = useRef(false)

  // 더 가져오기 핸들러
  const handleLoadMore = useCallback(async () => {
    if (!streamingState.sessionId || isLoadingMore) {
      return
    }

    setIsLoadingMore(true)
    try {
      const offset = streamingState.loadedOffset || customers.length
      const result = await loadMoreResults(streamingState.sessionId, offset, 100)

      if (result.success && result.results) {
        // 새 고객 추가
        const newCustomers: Customer[] = result.results.map((r) => ({
          id: crypto.randomUUID(),
          company_name: r.companyName,
          web_address: r.webAddress || r.website,
          email: r.email,
          country: r.country,
          industry: r.mainIndustry,
          sub_industry: r.subIndustry,
          category: r.category,
          employee: r.employee,
          revenue: r.revenue,
          source: r.source || "bigquery",
          createdAt: new Date(),
        }))
        addCustomers(newCustomers)

        // 상태 업데이트
        updateStreamingState({
          hasMore: result.hasMore,
          loadedOffset: result.offset,
        })

        toast.success(`${result.results.length}개 리드를 추가로 가져왔습니다`)
      } else {
        toast.error(result.error || "추가 데이터를 가져오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Load more error:", error)
      toast.error("추가 데이터를 가져오는데 실패했습니다")
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    streamingState.sessionId,
    streamingState.loadedOffset,
    customers.length,
    isLoadingMore,
    addCustomers,
    updateStreamingState,
  ])

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
    // "원하는 조건으로 찾기" 모드에서는 selectedTarget 정보를 판매자 정보로 사용
    const hasWebsiteAnalysis = !!streamingState.analysisSummary
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
      })),
      {
        companyName: hasWebsiteAnalysis ? "분석된 회사" : "타겟 조건 기반 검색",
        description: hasWebsiteAnalysis
          ? streamingState.analysisSummary
          : `${selectedTarget.industry} 산업의 ${selectedTarget.country} 지역 바이어를 찾고 있습니다.`,
        industry: selectedTarget.industry,
        targetMarkets: [selectedTarget.country],
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
      streamingState.userQuery, // 사용자 검색 쿼리 전달
    )
  }, [
    customers,
    selectedTarget,
    fitScoreState.scores,
    streamingState.analysisSummary,
    streamingState.userQuery,
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
            companyName: customer.company_name,
            phone: customer.phone,
            country: customer.country,
            industry: customer.industry,
            webAddress: customer.web_address,
            category: customer.category,
            description: customer.description,
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
      workspaceId,
      {
        onProgress: (completed, total, name) => {
          // completed는 현재까지 완료된 수, 처리 중인 항목은 completed + 1번째
          setEnrichProgress({ current: completed, total, name })
        },
        onResult: (leadId, result) => {
          // 웹데추에서 추출한 모든 필드로 고객 정보 업데이트
          updateCustomer(leadId, {
            // Enrichment 완료 표시
            verified: true,
            // 기본 정보
            description: result.description,
            // 업체 유형 (제조업체, 브랜드사, 유통업체 등)
            ...(result.companyType && { companyType: result.companyType }),
            // 연락처 (기존 값이 없을 때만 업데이트)
            ...(result.email && { email: result.email }),
            ...(result.phoneNumber && { phone: result.phoneNumber }),
            // 위치 정보
            ...(result.address && { address: result.address }),
            ...(result.city && { city: result.city }),
            ...(result.state && { state: result.state }),
            ...(result.country &&
              !customers.find((c) => c.id === leadId)?.country && {
                country: result.country,
              }),
            // 회사 정보
            ...(result.foundedYear && { foundedYear: result.foundedYear }),
            ...(result.employeeCount && { employee: result.employeeCount }),
            // 소셜 미디어
            ...(result.linkedinUrl && { linkedinUrl: result.linkedinUrl }),
            ...(result.facebookUrl && { facebookUrl: result.facebookUrl }),
            ...(result.instagramUrl && { instagramUrl: result.instagramUrl }),
            ...(result.twitterUrl && { twitterUrl: result.twitterUrl }),
            // 비즈니스 정보
            ...(result.products && { products: result.products }),
            ...(result.businessSectors && { businessSectors: result.businessSectors }),
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
  }, [rowSelection, customers, startEnrichment, finishEnrichment, updateCustomer, workspaceId])

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
      !(hasSortedRef.current || fitScoreState.isLoading) &&
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
            aria-label="Select all"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          />
        ),
        cell: ({ row, table }) => {
          // 정렬된 순서의 인덱스 계산
          const sortedIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id) + 1
          return (
            <RowIndexCell
              isSelected={row.getIsSelected()}
              onToggle={(value) => row.toggleSelected(!!value)}
              rowIndex={sortedIndex}
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
            className="-ml-2 h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            variant="ghost"
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
        cell: ({ row }) => {
          const isVerified = row.original.verified
          return (
            <div className="flex max-w-[200px] items-center gap-1.5">
              <span className="truncate font-medium">{row.getValue("company_name") || "-"}</span>
              {isVerified && (
                <div
                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm"
                  title="Enrichment 완료"
                >
                  <svg
                    aria-label="Verified"
                    className="h-2.5 w-2.5 text-white"
                    fill="currentColor"
                    role="img"
                    viewBox="0 0 20 20"
                  >
                    <title>Verified</title>
                    <path
                      clipRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      fillRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "web_address",
        header: "Website",
        cell: ({ row }) => {
          const webAddress = row.getValue("web_address") as string | undefined
          if (!webAddress) {
            return <span className="text-muted-foreground text-xs">-</span>
          }
          return (
            <a
              className="inline-flex items-center gap-1 text-blue-600 text-xs hover:text-blue-800 hover:underline"
              href={webAddress.startsWith("http") ? webAddress : `https://${webAddress}`}
              rel="noopener noreferrer"
              target="_blank"
              title={webAddress}
            >
              <span className="max-w-[140px] truncate">
                {webAddress.replace(/^https?:\/\//, "")}
              </span>
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          )
        },
      },
      // Description
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
                <span className="text-muted-foreground text-xs">분석 중...</span>
              </div>
            )
          }

          if (!description || description === "-") {
            return <span className="text-muted-foreground text-xs">-</span>
          }

          return (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="line-clamp-2 max-w-[200px] cursor-pointer text-left text-xs transition-colors hover:text-primary"
                  type="button"
                >
                  {description}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="max-h-[300px] w-[400px] overflow-y-auto">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Company Description</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
                </div>
              </PopoverContent>
            </Popover>
          )
        },
        size: 200,
      },
      // Fit Score
      {
        id: "fitScore",
        accessorFn: (row) => fitScoreState.scores[row.id] ?? row.fit_score ?? -1,
        header: ({ column }) => (
          <Button
            className="-ml-2 h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            variant="ghost"
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
          const score = fitScoreState.scores[row.original.id] ?? row.original.fit_score
          const isLoading = fitScoreState.isLoading && score === undefined
          return <FitScoreBadge isLoading={isLoading} score={score} />
        },
        size: 70,
      },
      // Country
      {
        accessorKey: "country",
        header: "Country",
        cell: ({ row }) => <span className="text-xs">{row.getValue("country") || "-"}</span>,
      },
      // Category (BigQuery 원본)
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => <span className="text-xs">{row.getValue("category") || "-"}</span>,
      },
      // 업체 유형 (Enrichment로 추출)
      {
        accessorKey: "companyType",
        header: "Business Type",
        cell: ({ row }) => {
          const companyType = row.getValue("companyType") as string | undefined
          if (!companyType) {
            return <span className="text-muted-foreground text-xs">-</span>
          }

          // 업체 유형별 배지 색상
          const typeColors: Record<string, string> = {
            제조업체: "bg-blue-100 text-blue-800",
            브랜드사: "bg-purple-100 text-purple-800",
            유통업체: "bg-green-100 text-green-800",
            도매업체: "bg-teal-100 text-teal-800",
            소매업체: "bg-orange-100 text-orange-800",
            수입업체: "bg-cyan-100 text-cyan-800",
            대리점: "bg-amber-100 text-amber-800",
            서비스업체: "bg-pink-100 text-pink-800",
            플랫폼: "bg-indigo-100 text-indigo-800",
          }

          const colorClass = typeColors[companyType] || "bg-gray-100 text-gray-800"

          return (
            <span className={`rounded-full px-2 py-0.5 font-medium text-xs ${colorClass}`}>
              {companyType}
            </span>
          )
        },
      },
      // Main Industry
      {
        accessorKey: "industry",
        header: ({ column }) => (
          <Button
            className="-ml-2 h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            variant="ghost"
          >
            Main Industry
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
          return (
            <Popover>
              <PopoverTrigger asChild>
                <span className="block max-w-[150px] cursor-pointer truncate text-xs hover:text-primary">
                  {industry || "-"}
                </span>
              </PopoverTrigger>
              {industry && (
                <PopoverContent align="start" className="max-h-[200px] w-[300px] overflow-y-auto">
                  <p className="text-sm">{industry}</p>
                </PopoverContent>
              )}
            </Popover>
          )
        },
      },
      // Sub Industry
      {
        accessorKey: "sub_industry",
        header: "Sub Industry",
        cell: ({ row }) => {
          const subIndustry = row.getValue("sub_industry") as string | undefined
          return (
            <Popover>
              <PopoverTrigger asChild>
                <span className="block max-w-[150px] cursor-pointer truncate text-muted-foreground text-xs hover:text-primary">
                  {subIndustry || "-"}
                </span>
              </PopoverTrigger>
              {subIndustry && (
                <PopoverContent align="start" className="max-h-[200px] w-[300px] overflow-y-auto">
                  <p className="text-sm">{subIndustry}</p>
                </PopoverContent>
              )}
            </Popover>
          )
        },
      },
      // Company Email
      {
        accessorKey: "email",
        header: ({ column }) => (
          <Button
            className="-ml-2 h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            variant="ghost"
          >
            Company Email
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
          <span className="block max-w-[200px] truncate font-mono text-xs">
            {row.getValue("email") || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          const customer = row.original

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-8 w-8 p-0" variant="ghost">
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

  // 정렬된 데이터: 1순위 verified (체크 표시), 2순위 fit_score
  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => {
      // 1순위: verified (체크 표시된 것이 위로)
      if (a.verified && !b.verified) {
        return -1
      }
      if (!a.verified && b.verified) {
        return 1
      }

      // 2순위: fit_score (높은 것이 위로) - fitScoreState.scores에서 가져옴
      const scoreA = fitScoreState.scores[a.id] ?? a.fit_score ?? 0
      const scoreB = fitScoreState.scores[b.id] ?? b.fit_score ?? 0
      return scoreB - scoreA
    })
  }, [customers, fitScoreState.scores])

  const table = useReactTable({
    data: sortedCustomers,
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
      if (!draggedColumn || draggedColumn === targetColumnId) {
        return
      }

      const currentOrder = columnOrder.length > 0 ? columnOrder : columns.map((c) => c.id as string)
      const draggedIndex = currentOrder.indexOf(draggedColumn)
      const targetIndex = currentOrder.indexOf(targetColumnId)

      if (draggedIndex === -1 || targetIndex === -1) {
        return
      }

      const newOrder = [...currentOrder]
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, draggedColumn)

      setColumnOrder(newOrder)
      setDraggedColumn(null)
    },
    [draggedColumn, columnOrder, columns],
  )

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 툴바 */}
      <div className="flex items-center justify-between gap-2 border-b px-2 py-2">
        <div className="flex flex-1 items-center gap-1">
          {/* 전체화면 토글 버튼 */}
          <Button
            className="h-8 w-8 shrink-0"
            onClick={onToggleFullscreen}
            size="icon"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            variant="ghost"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* 고객그룹 선택 및 추가 - 리드 선택 시 표시 */}
          {Object.keys(rowSelection).length > 0 && (
            <>
              <span className="font-medium text-primary text-sm">
                {Object.keys(rowSelection).length}개 선택
              </span>
              <Select onValueChange={setSelectedGroupId} value={selectedGroupId}>
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
                    <div className="px-2 py-1.5 text-muted-foreground text-sm">
                      고객그룹이 없습니다
                    </div>
                  )}
                </SelectContent>
              </Select>
              <Button
                className="h-8 gap-1"
                disabled={isAddingToGroup || !selectedGroupId || customerGroups.length === 0}
                onClick={handleAddToGroup}
                size="sm"
              >
                {isAddingToGroup ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                추가
              </Button>
              <Button
                className="h-8 gap-1"
                disabled={isEnriching}
                onClick={handleEnrichment}
                size="sm"
                variant="outline"
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

          <span className="text-muted-foreground text-sm">
            {table.getFilteredRowModel().rows.length} results
          </span>
        </div>
      </div>

      {/* 테이블 */}
      <div className="min-h-0 flex-1 overflow-scroll rounded-md border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-muted/30 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar]:w-3">
        <Table className="border-collapse">
          <TableHeader className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                className="border-border/50 border-b hover:bg-transparent"
                key={headerGroup.id}
              >
                {headerGroup.headers.map((header, index) => {
                  const canDrag = header.column.id !== "select" && header.column.id !== "actions"
                  const isFirstColumn = index === 0
                  return (
                    <TableHead
                      className={cn(
                        "border-border/30 border-r bg-zinc-50 dark:bg-zinc-900",
                        isFirstColumn && "sticky left-0 z-20",
                        canDrag && "cursor-grab",
                        draggedColumn === header.column.id && "opacity-50",
                      )}
                      draggable={canDrag}
                      key={header.id}
                      onDragOver={handleDragOver}
                      onDragStart={() => canDrag && handleDragStart(header.column.id)}
                      onDrop={() => canDrag && handleDrop(header.column.id)}
                      style={{ width: header.getSize() }}
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
                    animate={{ opacity: 1, y: 0 }}
                    className="border-border/30 border-b hover:bg-muted/40 data-[state=selected]:bg-muted"
                    data-state={row.getIsSelected() && "selected"}
                    exit={{ opacity: 0, y: -20 }}
                    initial={{ opacity: 0, y: 20 }}
                    key={row.original.id}
                    layout
                    transition={{
                      layout: { type: "spring", stiffness: 350, damping: 30 },
                      opacity: { duration: 0.2 },
                    }}
                  >
                    {row.getVisibleCells().map((cell, index) => {
                      const isFirstColumn = index === 0
                      return (
                        <TableCell
                          className={cn(
                            "border-border/20 border-r",
                            isFirstColumn && "sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900",
                          )}
                          key={cell.id}
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
                    className="h-[400px] text-center align-middle"
                    colSpan={columns.length}
                  >
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <p className="font-medium text-base">아직 발견된 고객이 없습니다</p>
                      <p className="mt-2 text-sm">채팅으로 새로운 잠재 고객을 찾아보세요</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* 더 가져오기 버튼 */}
      {streamingState.hasMore && streamingState.sessionId && (
        <div className="flex items-center justify-center border-t bg-muted/30 p-4">
          <Button
            className="gap-2"
            disabled={isLoadingMore}
            onClick={handleLoadMore}
            size="sm"
            variant="outline"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                가져오는 중...
              </>
            ) : (
              <>
                데이터 더 가져오기
                <span className="text-muted-foreground">
                  ({customers.length} / {streamingState.totalAvailable || 0})
                </span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* 푸터 - 선택 정보 */}
      {Object.keys(rowSelection).length > 0 && (
        <div className="flex items-center justify-between border-t bg-muted/50 p-4">
          <span className="text-muted-foreground text-sm">
            {Object.keys(rowSelection).length} of {table.getFilteredRowModel().rows.length} row(s)
            selected.
          </span>
          <Button onClick={() => setRowSelection({})} size="sm" variant="outline">
            Clear selection
          </Button>
        </div>
      )}
    </div>
  )
}
