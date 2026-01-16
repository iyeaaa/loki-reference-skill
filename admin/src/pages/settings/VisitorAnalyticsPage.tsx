/**
 * Visitor Analytics Page (Settings)
 *
 * IP Intelligence 기반 방문자 분석 페이지
 * - 워크스페이스별 방문자 목록 조회
 * - 방문자 통계 (국가별, 회사별)
 * - 보안 플래그 (VPN, Proxy, Tor 등)
 *
 * 경로: /app/settings/visitor-analytics
 */

import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Globe,
  Loader2,
  MapPin,
  Network,
  RefreshCw,
  Search,
  Server,
  Shield,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  useCleanupVisitorSessions,
  useVisitorSessions,
  useVisitorStats,
  type VisitorSession,
} from "@/lib/api/hooks/visitor-analytics"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

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

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  description?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="font-bold text-2xl">{value}</div>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </CardContent>
    </Card>
  )
}

function VisitorDetailModal({
  visitor,
  open,
  onClose,
}: {
  visitor: VisitorSession | null
  open: boolean
  onClose: () => void
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
              <h4 className="mb-2 font-semibold text-sm">회사 정보</h4>
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

type SortField = "lastVisitAt" | "visitCount" | "country"

function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField
  sortField: SortField
  sortDirection: "asc" | "desc"
}) {
  if (sortField !== field) {
    return null
  }
  return sortDirection === "asc" ? (
    <ChevronUp className="ml-1 inline h-4 w-4" />
  ) : (
    <ChevronDown className="ml-1 inline h-4 w-4" />
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function VisitorAnalyticsPage() {
  // State
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorSession | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize] = useState(50)
  const [sortField, setSortField] = useState<SortField>("lastVisitAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [statsDays, setStatsDays] = useState(30)

  // Data fetching
  const { data: userWorkspaces } = useUserWorkspaces()
  const workspaceId = userWorkspaces?.[0]?.id

  const {
    data: sessionsData,
    isLoading: isLoadingSessions,
    refetch: refetchSessions,
  } = useVisitorSessions(workspaceId, {
    limit: pageSize,
    offset: page * pageSize,
  })

  const {
    data: statsData,
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useVisitorStats(workspaceId, { days: statsDays })

  const cleanupMutation = useCleanupVisitorSessions(workspaceId)

  // Filtered and sorted data
  const filteredSessions = useMemo(() => {
    if (!sessionsData?.sessions) {
      return []
    }

    let filtered = sessionsData.sessions

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.ipAddress.toLowerCase().includes(query) ||
          s.country?.toLowerCase().includes(query) ||
          s.city?.toLowerCase().includes(query) ||
          s.companyName?.toLowerCase().includes(query),
      )
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal: string | number | null
      let bVal: string | number | null

      switch (sortField) {
        case "visitCount":
          aVal = a.visitCount
          bVal = b.visitCount
          break
        case "country":
          aVal = a.country
          bVal = b.country
          break
        default:
          aVal = a.lastVisitAt
          bVal = b.lastVisitAt
      }

      if (aVal === null) {
        return 1
      }
      if (bVal === null) {
        return -1
      }
      if (aVal < bVal) {
        return sortDirection === "asc" ? -1 : 1
      }
      if (aVal > bVal) {
        return sortDirection === "asc" ? 1 : -1
      }
      return 0
    })

    return filtered
  }, [sessionsData?.sessions, searchQuery, sortField, sortDirection])

  // Handlers
  const handleRefresh = () => {
    refetchSessions()
    refetchStats()
  }

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const handleViewDetails = (visitor: VisitorSession) => {
    setSelectedVisitor(visitor)
    setIsDetailOpen(true)
  }

  const handleCleanup = async () => {
    if (window.confirm("90일 이상 된 방문자 데이터를 삭제하시겠습니까?")) {
      await cleanupMutation.mutateAsync(90)
    }
  }

  // No workspace selected
  if (!workspaceId) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>워크스페이스를 선택해주세요.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl">방문자 분석</h1>
            <p className="text-muted-foreground">IP Intelligence 기반 방문자 추적 및 분석</p>
          </div>
          <div className="flex items-center gap-2">
            <Select onValueChange={(v) => setStatsDays(Number(v))} value={String(statsDays)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">최근 7일</SelectItem>
                <SelectItem value="30">최근 30일</SelectItem>
                <SelectItem value="90">최근 90일</SelectItem>
                <SelectItem value="365">최근 1년</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleRefresh} size="icon" variant="outline">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button disabled={cleanupMutation.isPending} onClick={handleCleanup} variant="outline">
              <Trash2 className="mr-2 h-4 w-4" />
              정리
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            description={`최근 ${statsDays}일`}
            icon={Users}
            title="총 방문자"
            value={isLoadingStats ? "-" : statsData?.totalVisitors || 0}
          />
          <StatCard
            description="고유 국가 수"
            icon={Globe}
            title="국가"
            value={isLoadingStats ? "-" : statsData?.uniqueCountries || 0}
          />
          <StatCard
            description="회사 식별됨"
            icon={Building2}
            title="회사 방문자"
            value={isLoadingStats ? "-" : statsData?.companyVisitors || 0}
          />
          <StatCard
            description="VPN/Proxy 감지"
            icon={Shield}
            title="VPN 사용자"
            value={isLoadingStats ? "-" : statsData?.vpnVisitors || 0}
          />
        </div>

        {/* Top Countries & Companies */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
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
            <CardHeader>
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>방문자 목록</CardTitle>
                <CardDescription>총 {sessionsData?.total || 0}명의 방문자</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="IP, 국가, 도시, 회사 검색..."
                  value={searchQuery}
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
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">IP 주소</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("country")}>
                          위치
                          <SortIcon
                            field="country"
                            sortDirection={sortDirection}
                            sortField={sortField}
                          />
                        </TableHead>
                        <TableHead>회사</TableHead>
                        <TableHead>보안</TableHead>
                        <TableHead
                          className="cursor-pointer text-right"
                          onClick={() => handleSort("visitCount")}
                        >
                          방문
                          <SortIcon
                            field="visitCount"
                            sortDirection={sortDirection}
                            sortField={sortField}
                          />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer"
                          onClick={() => handleSort("lastVisitAt")}
                        >
                          마지막 방문
                          <SortIcon
                            field="lastVisitAt"
                            sortDirection={sortDirection}
                            sortField={sortField}
                          />
                        </TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.length === 0 ? (
                        <TableRow>
                          <TableCell className="py-8 text-center text-muted-foreground" colSpan={7}>
                            방문자 데이터가 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSessions.map((visitor) => (
                          <TableRow key={visitor.id}>
                            <TableCell className="font-mono text-sm">{visitor.ipAddress}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {visitor.countryCode ? (
                                  <span className="text-lg">
                                    {getFlagEmoji(visitor.countryCode)}
                                  </span>
                                ) : null}
                                <span>{visitor.city || visitor.country || "-"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {visitor.companyName ? (
                                <Tooltip>
                                  <TooltipTrigger className="flex items-center gap-1">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="max-w-[150px] truncate">
                                      {visitor.companyName}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {visitor.companyName}
                                    {visitor.companyDomain ? ` (${visitor.companyDomain})` : ""}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {visitor.isVpn && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Shield className="h-4 w-4 text-yellow-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>VPN</TooltipContent>
                                  </Tooltip>
                                )}
                                {visitor.isProxy && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Server className="h-4 w-4 text-yellow-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>Proxy</TooltipContent>
                                  </Tooltip>
                                )}
                                {visitor.isTor && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Network className="h-4 w-4 text-red-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>Tor</TooltipContent>
                                  </Tooltip>
                                )}
                                {visitor.isDatacenter && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Server className="h-4 w-4 text-blue-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>Datacenter</TooltipContent>
                                  </Tooltip>
                                )}
                                {visitor.isMobile && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Smartphone className="h-4 w-4 text-gray-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>Mobile</TooltipContent>
                                  </Tooltip>
                                )}
                                {!(
                                  visitor.isVpn ||
                                  visitor.isProxy ||
                                  visitor.isTor ||
                                  visitor.isDatacenter ||
                                  visitor.isCrawler
                                ) && <span className="text-muted-foreground">-</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{visitor.visitCount}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                                <Clock className="h-3 w-3" />
                                {new Date(visitor.lastVisitAt).toLocaleDateString("ko-KR")}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
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
                {sessionsData && sessionsData.total > pageSize && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                      {page * pageSize + 1} - {Math.min((page + 1) * pageSize, sessionsData.total)}{" "}
                      of {sessionsData.total}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                        size="sm"
                        variant="outline"
                      >
                        이전
                      </Button>
                      <Button
                        disabled={(page + 1) * pageSize >= sessionsData.total}
                        onClick={() => setPage((p) => p + 1)}
                        size="sm"
                        variant="outline"
                      >
                        다음
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <VisitorDetailModal
          onClose={() => setIsDetailOpen(false)}
          open={isDetailOpen}
          visitor={selectedVisitor}
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
