/**
 * Visitor Analytics Page (Settings)
 *
 * IP Intelligence 기반 방문자 분석 페이지
 * - 워크스페이스별 방문자 목록 조회
 * - 방문자 통계 (국가별, 회사별)
 * - 다중 필터, 검색, 페이지네이션
 *
 * 경로: /settings?tab=visitor-analytics
 */

import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Code2,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Globe,
  GraduationCap,
  Landmark,
  Loader2,
  MapPin,
  Search,
  Server,
  Users,
  Wifi,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  useAddExcludedCompany,
  useBulkUpdateExcludedCompanies,
  useCompaniesForExclusion,
  useExcludedCompanies,
  useVisitorCountries,
  useVisitorSessions,
  useVisitorStats,
  type VisitorFilters,
  type VisitorSession,
  type VisitorType,
} from "@/lib/api/hooks/visitor-analytics"
import { useAuth } from "@/lib/auth-provider"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"
import { IntegrationGuideSheet } from "./components/IntegrationGuideSheet"

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 50

const VISITOR_TYPES = [
  { id: "business" as VisitorType, label: "기업", icon: Building2, color: "bg-blue-500" },
  { id: "education" as VisitorType, label: "교육", icon: GraduationCap, color: "bg-green-500" },
  { id: "government" as VisitorType, label: "정부", icon: Landmark, color: "bg-purple-500" },
  { id: "hosting" as VisitorType, label: "호스팅", icon: Server, color: "bg-orange-500" },
  { id: "isp" as VisitorType, label: "ISP", icon: Wifi, color: "bg-gray-400" },
  { id: "residential" as VisitorType, label: "개인", icon: Users, color: "bg-gray-400" },
  { id: "unknown" as VisitorType, label: "미분류", icon: Globe, color: "bg-gray-300" },
] as const

// ============================================================================
// Components
// ============================================================================

function SecurityBadge({
  label,
  active,
  variant = "default",
}: {
  label: string
  active: boolean
  variant?: "default" | "destructive" | "secondary" | "outline"
}) {
  if (!active) {
    return null
  }
  return (
    <Badge className="text-xs" variant={variant}>
      {label}
    </Badge>
  )
}

function VisitorTypeBadge({ type }: { type: VisitorType | null }) {
  const typeInfo = VISITOR_TYPES.find((t) => t.id === type) || VISITOR_TYPES[6] // unknown
  const Icon = typeInfo.icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          className={cn(
            "gap-1 text-white text-xs",
            type === "business" && "bg-blue-500 hover:bg-blue-600",
            type === "education" && "bg-green-500 hover:bg-green-600",
            type === "government" && "bg-purple-500 hover:bg-purple-600",
            type === "hosting" && "bg-orange-500 hover:bg-orange-600",
            (type === "isp" || type === "residential") && "bg-gray-400 hover:bg-gray-500",
            (!type || type === "unknown") && "bg-gray-300 hover:bg-gray-400",
          )}
        >
          <Icon className="h-3 w-3" />
          {typeInfo.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>방문자 유형: {typeInfo.label}</TooltipContent>
    </Tooltip>
  )
}

function StatCard({
  title,
  value,
  color,
  description,
  isLoading,
}: {
  title: string
  value: string | number
  color: string
  description?: string
  isLoading?: boolean
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      {isLoading ? (
        <div className="flex h-[60px] items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground text-sm">{title}</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-3xl tabular-nums">{value}</span>
            </div>
            {description && <p className="mt-0.5 text-muted-foreground text-sm">{description}</p>}
          </div>
        </>
      )}
    </div>
  )
}

function VisitorDetailModal({
  visitor,
  open,
  onClose,
  onExcludeCompany,
  isExcluding,
}: {
  visitor: VisitorSession | null
  open: boolean
  onClose: () => void
  onExcludeCompany?: (domain: string, name: string | null) => void
  isExcluding?: boolean
}) {
  if (!visitor) {
    return null
  }

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {visitor.ipAddress}
          </DialogTitle>
          <DialogDescription>
            방문자 상세 정보 - {new Date(visitor.lastVisitAt).toLocaleString("ko-KR")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Security Flags */}
          <div>
            <h4 className="mb-2 font-semibold text-sm">보안 플래그</h4>
            <div className="flex flex-wrap gap-2">
              <SecurityBadge active={visitor.isVpn} label="VPN" />
              <SecurityBadge active={visitor.isProxy} label="Proxy" />
              <SecurityBadge active={visitor.isTor} label="Tor" variant="destructive" />
              <SecurityBadge active={visitor.isDatacenter} label="Datacenter" />
              <SecurityBadge active={visitor.isCrawler} label="Crawler" />
              <SecurityBadge active={visitor.isMobile} label="Mobile" variant="secondary" />
              <SecurityBadge active={visitor.isAbuser} label="Abuser" variant="destructive" />
              {!(
                visitor.isVpn ||
                visitor.isProxy ||
                visitor.isTor ||
                visitor.isDatacenter ||
                visitor.isCrawler ||
                visitor.isAbuser
              ) && (
                <Badge className="text-xs" variant="outline">
                  정상
                </Badge>
              )}
            </div>
          </div>

          {/* Location Info */}
          <div>
            <h4 className="mb-2 font-semibold text-sm">위치 정보</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">국가:</span> {visitor.country || "-"} (
                {visitor.countryCode || "-"})
              </div>
              <div>
                <span className="text-muted-foreground">도시:</span> {visitor.city || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">지역:</span> {visitor.region || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">대륙:</span> {visitor.continent || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">좌표:</span>{" "}
                {visitor.latitude && visitor.longitude
                  ? `${visitor.latitude}, ${visitor.longitude}`
                  : "-"}
              </div>
              <div>
                <span className="text-muted-foreground">시간대:</span> {visitor.timezone || "-"}
              </div>
            </div>
          </div>

          {/* Company Info */}
          {visitor.companyName ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold text-sm">회사 정보</h4>
                {visitor.companyDomain && onExcludeCompany && (
                  <Button
                    disabled={isExcluding}
                    onClick={() =>
                      onExcludeCompany(visitor.companyDomain ?? "", visitor.companyName)
                    }
                    size="sm"
                    variant="outline"
                  >
                    {isExcluding ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <EyeOff className="mr-1.5 h-3 w-3" />
                    )}
                    이 회사 제외
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">회사명:</span> {visitor.companyName}
                </div>
                <div>
                  <span className="text-muted-foreground">도메인:</span>{" "}
                  {visitor.companyDomain || "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">유형:</span> {visitor.companyType || "-"}
                </div>
              </div>
            </div>
          ) : null}

          {/* ASN Info */}
          {visitor.asnNumber ? (
            <div>
              <h4 className="mb-2 font-semibold text-sm">ASN 정보</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">ASN:</span> {visitor.asnNumber}
                </div>
                <div>
                  <span className="text-muted-foreground">조직:</span> {visitor.asnOrg || "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">유형:</span> {visitor.asnType || "-"}
                </div>
              </div>
            </div>
          ) : null}

          {/* Visit Info */}
          <div>
            <h4 className="mb-2 font-semibold text-sm">방문 정보</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">방문 횟수:</span> {visitor.visitCount}회
              </div>
              <div>
                <span className="text-muted-foreground">첫 방문:</span>{" "}
                {new Date(visitor.firstVisitAt).toLocaleString("ko-KR")}
              </div>
              <div>
                <span className="text-muted-foreground">마지막 방문:</span>{" "}
                {new Date(visitor.lastVisitAt).toLocaleString("ko-KR")}
              </div>
              <div>
                <span className="text-muted-foreground">랜딩 페이지:</span>{" "}
                {visitor.landingPage || "-"}
              </div>
            </div>
          </div>

          {/* User Agent */}
          {visitor.userAgent ? (
            <div>
              <h4 className="mb-2 font-semibold text-sm">User Agent</h4>
              <p className="break-all rounded bg-muted p-2 text-xs">{visitor.userAgent}</p>
            </div>
          ) : null}

          {/* Raw ipapi.is Response */}
          {visitor.ipapiData ? (
            <div>
              <h4 className="mb-2 font-semibold text-sm">ipapi.is 원본 응답</h4>
              <pre className="max-h-[300px] overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(visitor.ipapiData, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CountryMultiSelect({
  selectedCountries,
  onChange,
  countries,
  isLoading,
}: {
  selectedCountries: string[]
  onChange: (countries: string[]) => void
  countries: { countryCode: string; country: string; count: number }[]
  isLoading: boolean
}) {
  const [open, setOpen] = useState(false)

  const toggleCountry = (countryCode: string) => {
    if (selectedCountries.includes(countryCode)) {
      onChange(selectedCountries.filter((c) => c !== countryCode))
    } else {
      onChange([...selectedCountries, countryCode])
    }
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-9 justify-between"
          disabled={isLoading}
          role="combobox"
          variant="outline"
        >
          {selectedCountries.length > 0
            ? `${selectedCountries.length}개 국가 선택`
            : "국가 선택..."}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="국가 검색..." />
          <CommandList>
            <CommandEmpty>국가를 찾을 수 없습니다.</CommandEmpty>
            <CommandGroup>
              {countries.map((c) => (
                <CommandItem
                  key={c.countryCode}
                  onSelect={() => toggleCountry(c.countryCode)}
                  value={c.country}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedCountries.includes(c.countryCode) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="mr-2">{getFlagEmoji(c.countryCode)}</span>
                  <span className="flex-1 truncate">{c.country}</span>
                  <Badge className="ml-2" variant="secondary">
                    {c.count}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function Pagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  onPageChange,
  isLoading,
}: {
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  isLoading: boolean
}) {
  const [pageInputValue, setPageInputValue] = useState(String(currentPage))

  useEffect(() => {
    setPageInputValue(String(currentPage))
  }, [currentPage])

  const getPageNumbers = useCallback(() => {
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    const pages = []
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }, [currentPage, totalPages])

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const page = Number.parseInt(pageInputValue, 10)
      if (page >= 1 && page <= totalPages) {
        onPageChange(page)
      } else {
        setPageInputValue(String(currentPage))
      }
    }
  }

  const handlePageInputBlur = () => {
    const page = Number.parseInt(pageInputValue, 10)
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    } else {
      setPageInputValue(String(currentPage))
    }
  }

  if (totalPages <= 1) {
    return null
  }

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, total)

  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <p className="text-muted-foreground text-sm">
        {startItem} - {endItem} / {total}명
      </p>

      <div className="flex items-center gap-1">
        <Button
          disabled={currentPage === 1 || isLoading}
          onClick={() => onPageChange(1)}
          size="icon"
          variant="outline"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          disabled={currentPage === 1 || isLoading}
          onClick={() => onPageChange(currentPage - 1)}
          size="icon"
          variant="outline"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageNumbers().map((page) => (
          <Button
            disabled={isLoading}
            key={page}
            onClick={() => onPageChange(page)}
            size="icon"
            variant={page === currentPage ? "default" : "outline"}
          >
            {page}
          </Button>
        ))}

        <Button
          disabled={currentPage === totalPages || isLoading}
          onClick={() => onPageChange(currentPage + 1)}
          size="icon"
          variant="outline"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          disabled={currentPage === totalPages || isLoading}
          onClick={() => onPageChange(totalPages)}
          size="icon"
          variant="outline"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>

        <div className="ml-2 flex items-center gap-2">
          <span className="text-muted-foreground text-sm">페이지</span>
          <Input
            className="h-8 w-16 text-center text-sm"
            max={totalPages || 1}
            min="1"
            onBlur={handlePageInputBlur}
            onChange={(e) => setPageInputValue(e.target.value)}
            onKeyDown={handlePageInputKeyDown}
            type="number"
            value={pageInputValue}
          />
          <span className="text-muted-foreground text-sm">/ {totalPages}</span>
        </div>
      </div>
    </div>
  )
}

function ActiveFilters({
  filters,
  countries,
  onRemoveFilter,
  onClearAll,
}: {
  filters: VisitorFilters
  countries: { countryCode: string; country: string }[]
  onRemoveFilter: (key: keyof VisitorFilters, value?: string) => void
  onClearAll: () => void
}) {
  const hasFilters =
    filters.search ||
    (filters.countries && filters.countries.length > 0) ||
    filters.hasCompany !== undefined ||
    (filters.securityFlags && filters.securityFlags.length > 0) ||
    filters.dateFrom ||
    filters.dateTo

  if (!hasFilters) {
    return null
  }

  const getCountryName = (code: string) =>
    countries.find((c) => c.countryCode === code)?.country || code

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-sm">필터:</span>

      {filters.search && (
        <Badge className="gap-1" variant="secondary">
          검색: {filters.search}
          <X className="h-3 w-3 cursor-pointer" onClick={() => onRemoveFilter("search")} />
        </Badge>
      )}

      {filters.countries?.map((code) => (
        <Badge className="gap-1" key={code} variant="secondary">
          {getFlagEmoji(code)} {getCountryName(code)}
          <X className="h-3 w-3 cursor-pointer" onClick={() => onRemoveFilter("countries", code)} />
        </Badge>
      ))}

      {(filters.dateFrom || filters.dateTo) && (
        <Badge className="gap-1" variant="secondary">
          기간: {filters.dateFrom || "~"} ~ {filters.dateTo || "~"}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => {
              onRemoveFilter("dateFrom")
              onRemoveFilter("dateTo")
            }}
          />
        </Badge>
      )}

      <Button className="h-6 px-2 text-xs" onClick={onClearAll} variant="ghost">
        모두 지우기
      </Button>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function VisitorAnalyticsPage() {
  // State
  const [currentPage, setCurrentPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filters, setFilters] = useState<VisitorFilters>({})
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorSession | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [statsDays, setStatsDays] = useState(30)
  const [showFilters, setShowFilters] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  // Noise exclusion filters (all default to true)
  const [excludeIsp, setExcludeIsp] = useState(true)
  const [excludeHosting, setExcludeHosting] = useState(true)
  const [excludeDatacenter, setExcludeDatacenter] = useState(true)
  const [excludeSuspicious, setExcludeSuspicious] = useState(true)
  const [isExclusionDialogOpen, setIsExclusionDialogOpen] = useState(false)
  const [excludeSearchTerm, setExcludeSearchTerm] = useState("")
  const [debouncedExcludeSearch, setDebouncedExcludeSearch] = useState("")
  const [pendingExclusions, setPendingExclusions] = useState<Set<string>>(new Set())

  // Auth
  const { user } = useAuth()

  // Get workspace from sidebar selection (localStorage)
  const { selectedWorkspace } = useWorkspace()
  const workspaceId = selectedWorkspace?.id || ""
  const isValidWorkspace = !!(workspaceId && workspaceId !== "all")

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setCurrentPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Merged filters with search and noise exclusions
  const mergedFilters = useMemo<VisitorFilters>(
    () => ({
      ...filters,
      search: debouncedSearch || undefined,
      excludeIsp,
      excludeHosting,
      excludeDatacenter,
      excludeSuspicious,
    }),
    [filters, debouncedSearch, excludeIsp, excludeHosting, excludeDatacenter, excludeSuspicious],
  )

  const {
    data: sessionsData,
    isLoading: isLoadingSessions,
    isFetching: isFetchingSessions,
  } = useVisitorSessions(workspaceId, {
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    filters: mergedFilters,
  })

  const { data: statsData, isLoading: isLoadingStats } = useVisitorStats(workspaceId, {
    days: statsDays,
  })

  const { data: countriesData, isLoading: isLoadingCountries } = useVisitorCountries(workspaceId)

  const { data: excludedCompanies } = useExcludedCompanies(workspaceId)

  // Companies for exclusion dropdown
  const { data: companiesForExclusion, isLoading: isLoadingCompaniesForExclusion } =
    useCompaniesForExclusion(workspaceId, {
      search: debouncedExcludeSearch || undefined,
      enabled: isExclusionDialogOpen,
    })

  const addExclusionMutation = useAddExcludedCompany(workspaceId)
  const bulkUpdateExclusionsMutation = useBulkUpdateExcludedCompanies(workspaceId)

  // Debounce exclude search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedExcludeSearch(excludeSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [excludeSearchTerm])

  // Initialize pending exclusions when dialog opens
  useEffect(() => {
    if (isExclusionDialogOpen && companiesForExclusion) {
      const excluded = new Set(
        companiesForExclusion.filter((c) => c.isExcluded).map((c) => c.companyDomain),
      )
      setPendingExclusions(excluded)
    }
  }, [isExclusionDialogOpen, companiesForExclusion])

  // Handlers
  const handleViewDetails = (visitor: VisitorSession) => {
    setSelectedVisitor(visitor)
    setIsDetailOpen(true)
  }

  const handleExcludeCompany = async (domain: string, name: string | null) => {
    if (!user?.id) {
      return
    }

    if (window.confirm(`"${name || domain}" 회사를 분석에서 제외하시겠습니까?`)) {
      try {
        await addExclusionMutation.mutateAsync({
          companyDomain: domain,
          companyName: name || undefined,
          excludedBy: user.id,
        })
        setIsDetailOpen(false)
      } catch (error) {
        console.error("Failed to exclude company:", error)
      }
    }
  }

  const togglePendingExclusion = (domain: string) => {
    setPendingExclusions((prev) => {
      const next = new Set(prev)
      if (next.has(domain)) {
        next.delete(domain)
      } else {
        next.add(domain)
      }
      return next
    })
  }

  const handleApplyExclusions = async () => {
    if (!(user?.id && companiesForExclusion)) {
      return
    }

    // Find what to add and remove
    const currentlyExcluded = new Set(
      companiesForExclusion.filter((c) => c.isExcluded).map((c) => c.companyDomain),
    )

    const toAdd = companiesForExclusion
      .filter(
        (c) => pendingExclusions.has(c.companyDomain) && !currentlyExcluded.has(c.companyDomain),
      )
      .map((c) => ({ domain: c.companyDomain, name: c.companyName || undefined }))

    const toRemove = companiesForExclusion
      .filter(
        (c) => !pendingExclusions.has(c.companyDomain) && currentlyExcluded.has(c.companyDomain),
      )
      .map((c) => c.companyDomain)

    if (toAdd.length === 0 && toRemove.length === 0) {
      setIsExclusionDialogOpen(false)
      return
    }

    try {
      await bulkUpdateExclusionsMutation.mutateAsync({
        toAdd: toAdd.length > 0 ? toAdd : undefined,
        toRemove: toRemove.length > 0 ? toRemove : undefined,
        excludedBy: user.id,
      })
      setIsExclusionDialogOpen(false)
      setExcludeSearchTerm("")
    } catch (error) {
      console.error("Failed to update exclusions:", error)
    }
  }

  const handleRemoveFilter = (key: keyof VisitorFilters, value?: string) => {
    setFilters((prev) => {
      const updated = { ...prev }
      if (key === "countries" && value) {
        updated.countries = prev.countries?.filter((c) => c !== value)
        if (updated.countries?.length === 0) {
          delete updated.countries
        }
      } else if (key === "securityFlags" && value) {
        updated.securityFlags = prev.securityFlags?.filter(
          (f) => f !== value,
        ) as typeof prev.securityFlags
        if (updated.securityFlags?.length === 0) {
          delete updated.securityFlags
        }
      } else {
        delete updated[key]
      }
      return updated
    })
    setCurrentPage(1)
  }

  const handleClearAllFilters = () => {
    setFilters({})
    setSearchInput("")
    setCurrentPage(1)
  }

  const handleSortChange = (sortBy: VisitorFilters["sortBy"]) => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === "desc" ? "asc" : "desc",
    }))
    setCurrentPage(1)
  }

  // No workspace selected
  if (!isValidWorkspace) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">IP Intelligence 기반 방문자 추적 및 분석</p>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            사이드바에서 워크스페이스를 선택해주세요. 방문자 분석은 워크스페이스별로 제공됩니다.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const sessions = sessionsData?.sessions || []
  const total = sessionsData?.total || 0
  const totalPages = sessionsData?.totalPages || 1

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-semibold text-lg">{selectedWorkspace?.name}</h2>
            <p className="text-muted-foreground text-sm">
              IP Intelligence 기반 방문자 추적 및 분석
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setIsGuideOpen(true)} size="sm" variant="outline">
              <Code2 className="mr-1.5 h-4 w-4" />
              연동 가이드
            </Button>
            <Select onValueChange={(v) => setStatsDays(Number(v))} value={String(statsDays)}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">최근 7일</SelectItem>
                <SelectItem value="30">최근 30일</SelectItem>
                <SelectItem value="90">최근 90일</SelectItem>
                <SelectItem value="365">최근 1년</SelectItem>
              </SelectContent>
            </Select>
            {/* Noise Exclusion Filters */}
            <Popover>
              <PopoverTrigger asChild>
                <Button className="h-8" size="sm" variant="outline">
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  노이즈 트래픽 필터
                  <Badge className="ml-1.5" variant="secondary">
                    {
                      [excludeIsp, excludeHosting, excludeDatacenter, excludeSuspicious].filter(
                        Boolean,
                      ).length
                    }
                    /4
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72">
                <div className="space-y-3">
                  <div className="font-medium text-sm">노이즈 트래픽 제외</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="cursor-pointer text-sm" htmlFor="exclude-isp">
                        ISP 트래픽
                      </Label>
                      <Switch
                        checked={excludeIsp}
                        id="exclude-isp"
                        onCheckedChange={setExcludeIsp}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">KT, SKT, LG U+ 등 일반 사용자</p>

                    <div className="flex items-center justify-between">
                      <Label className="cursor-pointer text-sm" htmlFor="exclude-hosting">
                        호스팅/클라우드
                      </Label>
                      <Switch
                        checked={excludeHosting}
                        id="exclude-hosting"
                        onCheckedChange={setExcludeHosting}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      AWS, GCP, 네이버 클라우드 등 봇 가능성
                    </p>

                    <div className="flex items-center justify-between">
                      <Label className="cursor-pointer text-sm" htmlFor="exclude-datacenter">
                        데이터센터
                      </Label>
                      <Switch
                        checked={excludeDatacenter}
                        id="exclude-datacenter"
                        onCheckedChange={setExcludeDatacenter}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">데이터센터 IP (크롤러, 자동화)</p>

                    <div className="flex items-center justify-between">
                      <Label className="cursor-pointer text-sm" htmlFor="exclude-suspicious">
                        의심 트래픽
                      </Label>
                      <Switch
                        checked={excludeSuspicious}
                        id="exclude-suspicious"
                        onCheckedChange={setExcludeSuspicious}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Proxy, Tor, Abuser 플래그 트래픽
                    </p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-8"
                  onClick={() => setIsExclusionDialogOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  <EyeOff className="mr-1.5 h-4 w-4" />
                  제외 회사
                  {excludedCompanies && excludedCompanies.length > 0 && (
                    <Badge className="ml-1.5" variant="secondary">
                      {excludedCompanies.length}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>분석에서 제외된 회사 관리</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            color="#64748b"
            description={`최근 ${statsDays}일`}
            isLoading={isLoadingStats}
            title="총 방문자"
            value={statsData?.totalVisitors || 0}
          />
          <StatCard
            color="#22c55e"
            description="잠재 고객"
            isLoading={isLoadingStats}
            title="B2B 리드"
            value={statsData?.b2bLeads || 0}
          />
          <StatCard
            color="#0ea5e9"
            description="회사 식별됨"
            isLoading={isLoadingStats}
            title="회사 방문자"
            value={statsData?.companyVisitors || 0}
          />
          <StatCard
            color="#8b5cf6"
            description="고유 국가 수"
            isLoading={isLoadingStats}
            title="국가"
            value={statsData?.uniqueCountries || 0}
          />
        </div>

        {/* Top Countries & Companies */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">상위 국가</CardTitle>
              <CardDescription>방문자가 많은 국가</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {statsData?.topCountries.slice(0, 5).map((item, i) => (
                    <div className="flex items-center justify-between" key={i}>
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {item.country}
                      </span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                  {!statsData?.topCountries.length && (
                    <p className="text-center text-muted-foreground text-sm">데이터 없음</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">상위 회사</CardTitle>
              <CardDescription>방문자가 많은 회사</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {statsData?.topCompanies.slice(0, 5).map((item, i) => (
                    <div className="flex items-center justify-between" key={i}>
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {item.company}
                      </span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                  {!statsData?.topCompanies.length && (
                    <p className="text-center text-muted-foreground text-sm">데이터 없음</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Visitors Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>방문자 목록</CardTitle>
                  <CardDescription>총 {total}명의 방문자</CardDescription>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Search */}
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="h-9 pl-8"
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="IP, 회사, 도시 검색..."
                      value={searchInput}
                    />
                  </div>

                  {/* Filter Toggle */}
                  <Button
                    onClick={() => setShowFilters(!showFilters)}
                    size="sm"
                    variant={showFilters ? "secondary" : "outline"}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    필터
                    {Object.keys(filters).length > 0 && (
                      <Badge className="ml-2" variant="default">
                        {Object.keys(filters).length}
                      </Badge>
                    )}
                  </Button>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                  <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/50 p-3">
                    <div className="space-y-1">
                      <Label className="text-xs">국가</Label>
                      <CountryMultiSelect
                        countries={countriesData || []}
                        isLoading={isLoadingCountries}
                        onChange={(countries) => {
                          setFilters((prev) => ({
                            ...prev,
                            countries: countries.length > 0 ? countries : undefined,
                          }))
                          setCurrentPage(1)
                        }}
                        selectedCountries={filters.countries || []}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">시작일</Label>
                      <Input
                        className="h-9 w-[140px]"
                        onChange={(e) => {
                          setFilters((prev) => ({
                            ...prev,
                            dateFrom: e.target.value || undefined,
                          }))
                          setCurrentPage(1)
                        }}
                        type="date"
                        value={filters.dateFrom || ""}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">종료일</Label>
                      <Input
                        className="h-9 w-[140px]"
                        onChange={(e) => {
                          setFilters((prev) => ({
                            ...prev,
                            dateTo: e.target.value || undefined,
                          }))
                          setCurrentPage(1)
                        }}
                        type="date"
                        value={filters.dateTo || ""}
                      />
                    </div>
                  </div>
                )}

                {/* Active Filters */}
                <ActiveFilters
                  countries={countriesData || []}
                  filters={mergedFilters}
                  onClearAll={handleClearAllFilters}
                  onRemoveFilter={handleRemoveFilter}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingSessions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <Table className="min-w-[1100px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[130px]">IP 주소</TableHead>
                        <TableHead className="w-[80px]">유형</TableHead>
                        <TableHead
                          className="w-[100px] cursor-pointer"
                          onClick={() => handleSortChange("country")}
                        >
                          위치
                          {filters.sortBy === "country" && (
                            <span className="ml-1">{filters.sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </TableHead>
                        <TableHead
                          className="w-[180px] cursor-pointer"
                          onClick={() => handleSortChange("companyName")}
                        >
                          회사/조직
                          {filters.sortBy === "companyName" && (
                            <span className="ml-1">{filters.sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </TableHead>
                        <TableHead className="w-[150px]">웹사이트</TableHead>
                        <TableHead
                          className="w-[50px] cursor-pointer text-center"
                          onClick={() => handleSortChange("visitCount")}
                        >
                          방문
                          {filters.sortBy === "visitCount" && (
                            <span className="ml-1">{filters.sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </TableHead>
                        <TableHead
                          className="w-[90px] cursor-pointer"
                          onClick={() => handleSortChange("lastVisitAt")}
                        >
                          마지막
                          {(filters.sortBy === "lastVisitAt" || !filters.sortBy) && (
                            <span className="ml-1">{filters.sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </TableHead>
                        <TableHead className="w-[40px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            className="py-8 text-center text-muted-foreground"
                            colSpan={10}
                          >
                            방문자 데이터가 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sessions.map((visitor) => (
                          <TableRow key={visitor.id}>
                            <TableCell className="font-mono text-xs">{visitor.ipAddress}</TableCell>
                            <TableCell>
                              <VisitorTypeBadge type={visitor.visitorType} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {visitor.countryCode && (
                                  <span className="text-base">
                                    {getFlagEmoji(visitor.countryCode)}
                                  </span>
                                )}
                                <span className="truncate text-sm">
                                  {visitor.city || visitor.country || "-"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {visitor.companyName || visitor.asnOrg ? (
                                <Tooltip>
                                  <TooltipTrigger className="flex items-center gap-1.5 text-left">
                                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate text-sm">
                                      {visitor.companyName || visitor.asnOrg}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      {visitor.companyName && (
                                        <div>회사: {visitor.companyName}</div>
                                      )}
                                      {visitor.asnOrg && <div>ASN: {visitor.asnOrg}</div>}
                                      {visitor.companyDomain && (
                                        <div>도메인: {visitor.companyDomain}</div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {visitor.companyDomain || visitor.asnDomain ? (
                                <a
                                  className="inline-flex items-center gap-1 text-blue-600 text-sm hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                  href={`https://${visitor.companyDomain || visitor.asnDomain}`}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  <span className="truncate">
                                    {visitor.companyDomain || visitor.asnDomain}
                                  </span>
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{visitor.visitCount}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="whitespace-nowrap text-muted-foreground text-xs">
                                {new Date(visitor.lastVisitAt).toLocaleDateString("ko-KR")}
                              </span>
                            </TableCell>
                            <TableCell className="p-1">
                              <Button
                                className="h-7 w-7"
                                onClick={() => handleViewDetails(visitor)}
                                size="icon"
                                variant="ghost"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="mt-4">
                  <Pagination
                    currentPage={currentPage}
                    isLoading={isFetchingSessions}
                    onPageChange={setCurrentPage}
                    pageSize={PAGE_SIZE}
                    total={total}
                    totalPages={totalPages}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <VisitorDetailModal
          isExcluding={addExclusionMutation.isPending}
          onClose={() => setIsDetailOpen(false)}
          onExcludeCompany={handleExcludeCompany}
          open={isDetailOpen}
          visitor={selectedVisitor}
        />

        {/* Excluded Companies Management Dialog - Improved UI */}
        <Dialog onOpenChange={setIsExclusionDialogOpen} open={isExclusionDialogOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <EyeOff className="h-5 w-5" />
                방문자 분석 제외 설정
              </DialogTitle>
              <DialogDescription>
                선택한 회사는 방문자 분석 통계에서 제외됩니다. 테스트 트래픽이나 내부 방문자를
                제외할 때 유용합니다.
              </DialogDescription>
            </DialogHeader>

            {/* Search */}
            <div className="py-2">
              <div className="relative">
                <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  onChange={(e) => setExcludeSearchTerm(e.target.value)}
                  placeholder="회사명, 도메인으로 검색..."
                  value={excludeSearchTerm}
                />
              </div>
            </div>

            {/* Company List with Checkboxes */}
            <div className="max-h-[50vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-[50px]">제외</TableHead>
                    <TableHead>회사명</TableHead>
                    <TableHead className="w-[100px] text-center">방문자</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCompaniesForExclusion ? (
                    <TableRow>
                      <TableCell className="py-8 text-center" colSpan={3}>
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : companiesForExclusion && companiesForExclusion.length > 0 ? (
                    companiesForExclusion.map((company) => (
                      <TableRow
                        className={cn(
                          "cursor-pointer hover:bg-muted/50",
                          company.isExcluded && "bg-muted/30",
                        )}
                        key={company.companyDomain}
                        onClick={() => togglePendingExclusion(company.companyDomain)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={pendingExclusions.has(company.companyDomain)}
                            onCheckedChange={() => togglePendingExclusion(company.companyDomain)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">
                                  {company.companyName || company.companyDomain}
                                </span>
                                {company.isExcluded && (
                                  <Badge className="shrink-0" variant="secondary">
                                    기존 제외
                                  </Badge>
                                )}
                              </div>
                              {company.companyName && (
                                <div className="truncate text-muted-foreground text-xs">
                                  {company.companyDomain}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{company.visitorCount}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="py-8 text-center text-muted-foreground" colSpan={3}>
                        {excludeSearchTerm
                          ? "검색 결과가 없습니다"
                          : "방문자 데이터에서 식별된 회사가 없습니다"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Selected Count */}
            <div className="text-muted-foreground text-sm">
              {pendingExclusions.size}개 선택됨
              {excludedCompanies && pendingExclusions.size !== excludedCompanies.length && (
                <span className="ml-2 text-amber-600">
                  (현재 저장된 제외 목록: {excludedCompanies.length}개)
                </span>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={() => {
                  setIsExclusionDialogOpen(false)
                  setExcludeSearchTerm("")
                }}
                variant="outline"
              >
                취소
              </Button>
              <Button
                disabled={bulkUpdateExclusionsMutation.isPending}
                onClick={handleApplyExclusions}
              >
                {bulkUpdateExclusionsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  "적용하기"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Integration Guide Sheet */}
        <IntegrationGuideSheet
          apiBaseUrl="https://api.rinda.ai"
          onOpenChange={setIsGuideOpen}
          open={isGuideOpen}
          workspaceId={workspaceId}
          workspaceName={selectedWorkspace?.name || ""}
        />
      </div>
    </TooltipProvider>
  )
}

// ============================================================================
// Utilities
// ============================================================================

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) {
    return ""
  }
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127_397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export default VisitorAnalyticsPage
