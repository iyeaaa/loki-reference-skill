import { motion } from "framer-motion"
import { AlertCircle, Database, Download, Plus, Search, Sparkles, Upload } from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import * as XLSX from "xlsx"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface LeadResult {
  // 기존 필드 (레거시)
  companyName?: string
  website?: string
  email?: string
  phone?: string
  address?: string
  country?: string
  city?: string
  description?: string
  vertical?: string
  products?: string
  matchReason?: string
  confidenceScore?: number
  // 동적 CSV 컬럼 (공백 포함 가능)
  [key: string]: string | number | boolean | undefined
}

interface UploadedStore {
  name: string
  displayName: string
  fileCount: number
  createTime: string
  updateTime: string
}

export default function GeminiSearchPage() {
  const { t, i18n } = useTranslation()
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<LeadResult[]>([])
  const [searchExplanation, setSearchExplanation] = useState("")
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set())
  const [customerGroups, setCustomerGroups] = useState<Array<{ id: string; name: string }>>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [isAddingToCampaign, setIsAddingToCampaign] = useState(false)

  const [uploadedStores, setUploadedStores] = useState<UploadedStore[]>([])
  const [isLoadingStores, setIsLoadingStores] = useState(false)

  // Drive 관련 상태
  const [driveUrl, setDriveUrl] = useState("")
  const [isImportingFromDrive, setIsImportingFromDrive] = useState(false)

  const [filters, setFilters] = useState({
    country: "",
    region: "",
    vertical: "",
  })

  const [metadata, setMetadata] = useState({
    country: "",
    region: "",
    vertical: "",
    source: "",
    dbVersion: "",
  })

  // Generate unique IDs for form fields
  const searchQueryId = useId()
  const filterCountryId = useId()
  const filterRegionId = useId()
  const filterVerticalId = useId()
  const driveUrlId = useId()
  const driveMetaCountryId = useId()
  const driveMetaRegionId = useId()
  const driveMetaVerticalId = useId()
  const driveMetaSourceId = useId()

  const workspaceId = localStorage.getItem("selectedWorkspace") || ""
  // 배포 환경: nginx가 /api/를 프록시하므로 빈 문자열 사용 (상대 경로)
  // 로컬 개발: VITE_API_URL=http://localhost:3001
  const API_BASE_URL = import.meta.env.VITE_API_URL || ""

  // 고객 그룹 목록 가져오기
  const fetchCustomerGroups = useCallback(async () => {
    if (!workspaceId || workspaceId === "all") return

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/customer-groups/workspace/${workspaceId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      )

      if (!response.ok) throw new Error("Failed to fetch customer groups")

      const result = await response.json()

      // API 응답이 배열인지 확인하고 설정
      if (Array.isArray(result)) {
        setCustomerGroups(result)
      } else if (result.data && Array.isArray(result.data)) {
        setCustomerGroups(result.data)
      } else {
        console.warn("Unexpected customer groups response format:", result)
        setCustomerGroups([])
      }
    } catch (error) {
      console.error("Failed to fetch customer groups:", error)
      setCustomerGroups([]) // 에러 시 빈 배열로 설정
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  useEffect(() => {
    fetchCustomerGroups()
  }, [fetchCustomerGroups])

  // biome-ignore lint/correctness/useExhaustiveDependencies: i18n.language triggers update on language change, t is stable
  const fetchStores = useCallback(async () => {
    try {
      setIsLoadingStores(true)
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/gemini-search/stores`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      })

      if (!response.ok) throw new Error("Failed to fetch stores")

      const result = await response.json()
      if (result.success) {
        setUploadedStores(result.data.stores)
      }
    } catch (error) {
      console.error("Failed to fetch stores:", error)
      toast.error(t("gemini-search.toast.storeLoadFailed"))
    } finally {
      setIsLoadingStores(false)
    }
  }, [i18n.language])

  // 업로드된 파일 목록 불러오기
  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  // 리드 검색
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error(t("gemini-search.toast.enterQuery"))
      return
    }

    if (!workspaceId || workspaceId === "all") {
      toast.error(t("gemini-search.toast.selectWorkspace"))
      return
    }

    try {
      setIsSearching(true)
      setSearchResults([])

      const requestBody = {
        workspaceId,
        query: searchQuery,
        filters: {
          ...(filters.country && { country: filters.country }),
          ...(filters.region && { region: filters.region }),
          ...(filters.vertical && { vertical: filters.vertical }),
        },
        limit: 50,
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/admin/gemini-search/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (result.success) {
        setSearchResults(result.data.results)
        setSearchExplanation(result.data.explanation || "")
        toast.success(
          t("gemini-search.toast.searchSuccess", {
            count: result.data.totalResults,
            time: result.data.processingTime.toFixed(2),
          }),
        )
      } else {
        throw new Error(result.message || t("gemini-search.toast.searchFailed"))
      }
    } catch (error) {
      console.error("Search error:", error)
      toast.error(error instanceof Error ? error.message : t("gemini-search.toast.searchError"))
    } finally {
      setIsSearching(false)
    }
  }

  // 리드 선택 핸들러
  const handleToggleLead = (index: number) => {
    setSelectedLeads((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const handleToggleAll = () => {
    if (selectedLeads.size === searchResults.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(searchResults.map((_, idx) => idx)))
    }
  }

  // 선택된 리드를 캠페인에 추가
  const handleAddToCampaign = async () => {
    if (selectedLeads.size === 0) {
      toast.error(t("gemini-search.toast.selectLeads"))
      return
    }

    if (!selectedGroupId) {
      toast.error(t("gemini-search.toast.selectGroup"))
      return
    }

    if (!workspaceId || workspaceId === "all") {
      toast.error(t("gemini-search.toast.selectWorkspace"))
      return
    }

    try {
      setIsAddingToCampaign(true)

      // 선택된 리드들을 Lead 객체로 변환 (백엔드 스키마에 맞춤)
      // ⚠️ IMPORTANT: Optional 필드는 값이 없으면 키 자체를 제외해야 함 (undefined가 아닌)
      const selectedLeadData = Array.from(selectedLeads).map((idx) => {
        const result = searchResults[idx]

        // 연락처 이름 구성 (이름 + 직책)
        const fullName = result["Full name"] || result.name || result.이름 || ""
        const jobTitle = result["Job title"] || result.title || result.직책 || ""
        const contactName = jobTitle ? `${fullName} (${jobTitle})` : fullName

        const lead: Record<string, unknown> = {
          // 필수 필드
          companyName:
            result["Company Name"] ||
            result.companyName ||
            result.company_name ||
            result.회사명 ||
            "",
          leadSource: "Gemini Search",
          leadStatus: "new",
        }

        // Optional 필드는 값이 있을 때만 추가 (null/undefined 방지)
        const foundCompanyName = result["Company Name"] || result.companyName
        if (foundCompanyName) lead.foundCompanyName = foundCompanyName

        const businessType =
          result["Company Industry"] || result.vertical || result.industry || result.산업
        if (businessType) lead.businessType = businessType

        const websiteUrl =
          result["Company Website"] || result.website || result.웹사이트 || result.url
        if (websiteUrl && websiteUrl !== "null") lead.websiteUrl = websiteUrl

        const description = result.description || result.설명
        if (description && description !== "null") lead.description = description

        const country = result.Location || result.country || result.국가
        if (country) lead.country = country

        if (contactName) lead.contactName = contactName

        const primaryEmail = result.Emails || result.email || result.이메일
        if (primaryEmail) lead.primaryEmail = primaryEmail

        return lead
      })

      console.log("📤 Sending bulk create request:", {
        workspaceId,
        leadsCount: selectedLeadData.length,
        customerGroupId: selectedGroupId,
        sampleLead: selectedLeadData[0],
      })

      // Bulk create API 호출
      const response = await fetch(`${API_BASE_URL}/api/v1/leads/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          workspaceId,
          leads: selectedLeadData,
          customerGroupId: selectedGroupId,
          createdBy: localStorage.getItem("userId") || undefined,
        }),
      })

      console.log("📥 Response status:", response.status)

      // HTML 응답인지 먼저 확인
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        console.error("Non-JSON response:", text.substring(0, 500))
        throw new Error(t("gemini-search.error.serverError", { status: response.status }))
      }

      const result = await response.json()
      console.log("📊 Bulk create result:", result)

      if (response.ok) {
        // 🎯 간단한 해결책: 선택한 개수를 이미 알고 있으니 그걸 사용!
        const selectedCount = selectedLeads.size
        const stats = result.stats || {}
        const duplicates = result.duplicateEmails?.length || stats.skipped || 0
        const actualCreated = selectedCount - duplicates

        if (duplicates > 0) {
          toast.success(
            t("gemini-search.toast.addSuccessWithDuplicates", {
              count: actualCreated,
              duplicates,
            }),
          )
        } else {
          toast.success(t("gemini-search.toast.addSuccess", { count: actualCreated }))
        }

        // 선택 초기화
        setSelectedLeads(new Set())
        setSelectedGroupId("")
      } else {
        throw new Error(result.message || result.error || t("gemini-search.toast.addFailed"))
      }
    } catch (error) {
      console.error("❌ Add to campaign error:", error)
      toast.error(error instanceof Error ? error.message : t("gemini-search.toast.addError"))
    } finally {
      setIsAddingToCampaign(false)
    }
  }

  // 엑셀 다운로드
  const handleDownloadExcel = () => {
    if (searchResults.length === 0) {
      toast.error(t("gemini-search.toast.noDownloadData"))
      return
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(searchResults)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads")

      XLSX.writeFile(workbook, `gemini-search-results-${Date.now()}.xlsx`)
      toast.success(t("gemini-search.toast.downloadSuccess"))
    } catch (error) {
      console.error("Download error:", error)
      toast.error(t("gemini-search.toast.downloadFailed"))
    }
  }

  // Drive URL에서 파일 가져오기
  const handleImportFromDrive = async () => {
    if (!driveUrl.trim()) {
      toast.error(t("gemini-search.toast.enterDriveUrl"))
      return
    }

    if (!workspaceId || workspaceId === "all") {
      toast.error(t("gemini-search.toast.selectWorkspace"))
      return
    }

    try {
      setIsImportingFromDrive(true)

      const requestBody = {
        workspaceId,
        driveUrl: driveUrl.trim(),
        metadata: {
          ...(metadata.country && { country: metadata.country }),
          ...(metadata.region && { region: metadata.region }),
          ...(metadata.vertical && { vertical: metadata.vertical }),
          ...(metadata.source && { source: metadata.source }),
          ...(metadata.dbVersion && { dbVersion: metadata.dbVersion }),
        },
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/admin/gemini-search/drive/import-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(t("gemini-search.toast.importSuccess", { count: result.data.totalRows }))
        setDriveUrl("")
        setMetadata({ country: "", region: "", vertical: "", source: "", dbVersion: "" })
        fetchStores()
      } else {
        throw new Error(result.message || t("gemini-search.toast.importFailed"))
      }
    } catch (error) {
      console.error("Import error:", error)
      toast.error(error instanceof Error ? error.message : t("gemini-search.toast.importError"))
    } finally {
      setIsImportingFromDrive(false)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary text-primary-foreground rounded-xl shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("gemini-search.header.title")}</h1>
            <p className="text-muted-foreground">{t("gemini-search.header.description")}</p>
          </div>
        </div>

        {/* 알림: 관리자 설정 필요 */}
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t("gemini-search.alert.adminRequired")}</AlertDescription>
        </Alert>

        <Tabs defaultValue="search" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="search">
              <Search className="h-4 w-4 mr-2" />
              {t("gemini-search.tabs.search")}
            </TabsTrigger>
            <TabsTrigger value="drive">
              <Database className="h-4 w-4 mr-2" />
              {t("gemini-search.tabs.drive")}
            </TabsTrigger>
            <TabsTrigger value="files">
              <Database className="h-4 w-4 mr-2" />
              {t("gemini-search.tabs.files")}
            </TabsTrigger>
          </TabsList>

          {/* 검색 탭 */}
          <TabsContent value="search">
            <Card>
              <CardHeader>
                <CardTitle>{t("gemini-search.search.title")}</CardTitle>
                <CardDescription>{t("gemini-search.search.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={searchQueryId}>{t("gemini-search.search.queryLabel")}</Label>
                  <Textarea
                    id={searchQueryId}
                    placeholder={t("gemini-search.search.queryPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* 필터 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={filterCountryId}>
                      {t("gemini-search.search.filterCountry")}
                    </Label>
                    <Input
                      id={filterCountryId}
                      placeholder={t("gemini-search.search.filterCountryPlaceholder")}
                      value={filters.country}
                      onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={filterRegionId}>{t("gemini-search.search.filterRegion")}</Label>
                    <Input
                      id={filterRegionId}
                      placeholder={t("gemini-search.search.filterRegionPlaceholder")}
                      value={filters.region}
                      onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={filterVerticalId}>
                      {t("gemini-search.search.filterVertical")}
                    </Label>
                    <Input
                      id={filterVerticalId}
                      placeholder={t("gemini-search.search.filterVerticalPlaceholder")}
                      value={filters.vertical}
                      onChange={(e) => setFilters({ ...filters, vertical: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="flex-1"
                  >
                    {isSearching ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
                          <div
                            className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground"
                            style={{ animationDelay: "0.2s" }}
                          />
                          <div
                            className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground"
                            style={{ animationDelay: "0.4s" }}
                          />
                        </div>
                        <span>{t("gemini-search.search.searching")}</span>
                      </div>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        {t("gemini-search.search.button")}
                      </>
                    )}
                  </Button>

                  {searchResults.length > 0 && (
                    <Button onClick={handleDownloadExcel} variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      {t("gemini-search.search.downloadExcel")}
                    </Button>
                  )}
                </div>

                {/* 리드 선택 및 캠페인 추가 */}
                {searchResults.length > 0 && (
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {selectedLeads.size > 0
                          ? t("gemini-search.search.leadsSelected", { count: selectedLeads.size })
                          : t("gemini-search.search.selectLeadsHint")}
                      </p>
                    </div>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder={t("gemini-search.search.selectGroup")} />
                      </SelectTrigger>
                      <SelectContent>
                        {customerGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddToCampaign}
                      disabled={selectedLeads.size === 0 || !selectedGroupId || isAddingToCampaign}
                    >
                      {isAddingToCampaign ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
                            <div
                              className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground"
                              style={{ animationDelay: "0.2s" }}
                            />
                            <div
                              className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground"
                              style={{ animationDelay: "0.4s" }}
                            />
                          </div>
                          <span>{t("gemini-search.search.adding")}</span>
                        </div>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          {t("gemini-search.search.addToCampaign")}
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* 검색 설명 */}
                {searchExplanation && (
                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertDescription>{searchExplanation}</AlertDescription>
                  </Alert>
                )}

                {/* 검색 결과 테이블 - 동적 컬럼 */}
                {searchResults.length > 0 && (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-700">
                          {/* 전체 선택 체크박스 */}
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={
                                searchResults.length > 0 &&
                                selectedLeads.size === searchResults.length
                              }
                              onCheckedChange={handleToggleAll}
                            />
                          </TableHead>
                          {/* 동적 컬럼 헤더 생성 */}
                          {searchResults.length > 0 &&
                            Object.keys(searchResults[0])
                              .filter((key) => key !== "matchReason" && key !== "confidenceScore")
                              .map((key) => (
                                <TableHead key={key} className="min-w-[120px]">
                                  {key}
                                </TableHead>
                              ))}
                          <TableHead className="min-w-[100px]">
                            {t("gemini-search.table.confidence")}
                          </TableHead>
                          <TableHead className="min-w-[200px]">
                            {t("gemini-search.table.matchReason")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.map((result, idx) => (
                          <TableRow
                            key={`result-${idx}-${result.companyName || result["Company Name"] || idx}`}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            {/* 선택 체크박스 */}
                            <TableCell>
                              <Checkbox
                                checked={selectedLeads.has(idx)}
                                onCheckedChange={() => handleToggleLead(idx)}
                              />
                            </TableCell>
                            {/* 동적 데이터 셀 */}
                            {Object.entries(result)
                              .filter(([key]) => key !== "matchReason" && key !== "confidenceScore")
                              .map(([key, value]) => {
                                // URL인 경우 링크로 표시
                                const isUrl =
                                  typeof value === "string" && value.match(/^https?:\/\//)
                                const isEmail = typeof value === "string" && value.includes("@")

                                return (
                                  <TableCell key={key} className="text-sm">
                                    {isUrl ? (
                                      <a
                                        href={value}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                      >
                                        {value}
                                      </a>
                                    ) : isEmail ? (
                                      <a
                                        href={`mailto:${value}`}
                                        className="text-blue-600 hover:underline"
                                      >
                                        {value}
                                      </a>
                                    ) : (
                                      <span>{value?.toString() || "-"}</span>
                                    )}
                                  </TableCell>
                                )
                              })}
                            {/* 신뢰도 */}
                            <TableCell>
                              {result.confidenceScore ? (
                                <Badge
                                  variant={
                                    result.confidenceScore >= 0.8
                                      ? "default"
                                      : result.confidenceScore >= 0.6
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {(result.confidenceScore * 100).toFixed(0)}%
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            {/* 매칭 이유 */}
                            <TableCell className="text-sm max-w-xs">
                              {result.matchReason || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {searchResults.length === 0 && !isSearching && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Search className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">
                      {t("gemini-search.search.emptyTitle")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("gemini-search.search.emptyDescription")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Google Drive 가져오기 탭 */}
          <TabsContent value="drive">
            <Card>
              <CardHeader>
                <CardTitle>{t("gemini-search.drive.title")}</CardTitle>
                <CardDescription>{t("gemini-search.drive.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 안내 메시지 */}
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{t("gemini-search.drive.howToUse")}</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                      <li>{t("gemini-search.drive.step1")}</li>
                      <li>{t("gemini-search.drive.step2")}</li>
                      <li>{t("gemini-search.drive.step3")}</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                {/* Drive URL 입력 */}
                <div className="space-y-2">
                  <Label htmlFor={driveUrlId}>{t("gemini-search.drive.urlLabel")}</Label>
                  <Textarea
                    id={driveUrlId}
                    placeholder={t("gemini-search.drive.urlPlaceholder")}
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("gemini-search.drive.urlHint")}
                  </p>
                </div>

                {/* 메타데이터 입력 */}
                <div className="space-y-2">
                  <Label>{t("gemini-search.drive.metadataLabel")}</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="drive-meta-country" className="text-xs">
                        {t("gemini-search.drive.metaCountry")}
                      </Label>
                      <Input
                        id={driveMetaCountryId}
                        placeholder={t("gemini-search.drive.metaCountryPlaceholder")}
                        value={metadata.country}
                        onChange={(e) => setMetadata({ ...metadata, country: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={driveMetaRegionId} className="text-xs">
                        {t("gemini-search.drive.metaRegion")}
                      </Label>
                      <Input
                        id={driveMetaRegionId}
                        placeholder={t("gemini-search.drive.metaRegionPlaceholder")}
                        value={metadata.region}
                        onChange={(e) => setMetadata({ ...metadata, region: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={driveMetaVerticalId} className="text-xs">
                        {t("gemini-search.drive.metaVertical")}
                      </Label>
                      <Input
                        id={driveMetaVerticalId}
                        placeholder={t("gemini-search.drive.metaVerticalPlaceholder")}
                        value={metadata.vertical}
                        onChange={(e) => setMetadata({ ...metadata, vertical: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={driveMetaSourceId} className="text-xs">
                        {t("gemini-search.drive.metaSource")}
                      </Label>
                      <Input
                        id={driveMetaSourceId}
                        placeholder={t("gemini-search.drive.metaSourcePlaceholder")}
                        value={metadata.source}
                        onChange={(e) => setMetadata({ ...metadata, source: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* 가져오기 버튼 */}
                <Button
                  onClick={handleImportFromDrive}
                  disabled={!driveUrl.trim() || isImportingFromDrive}
                  className="w-full"
                >
                  {isImportingFromDrive ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
                        <div
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground"
                          style={{ animationDelay: "0.2s" }}
                        />
                        <div
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground"
                          style={{ animationDelay: "0.4s" }}
                        />
                      </div>
                      <span>{t("gemini-search.drive.importing")}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {t("gemini-search.drive.importButton")}
                    </>
                  )}
                </Button>

                {/* 예시 */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <p className="text-sm font-medium mb-2">
                    💡 {t("gemini-search.drive.urlExample")}
                  </p>
                  <code className="text-xs break-all">
                    https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i0J/view
                  </code>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 업로드한 파일 탭 */}
          <TabsContent value="files">
            <Card>
              <CardHeader>
                <CardTitle>{t("gemini-search.files.title")}</CardTitle>
                <CardDescription>{t("gemini-search.files.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingStores ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                      <div
                        className="h-2 w-2 animate-pulse rounded-full bg-primary"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="h-2 w-2 animate-pulse rounded-full bg-primary"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("gemini-search.files.loading")}
                    </p>
                  </div>
                ) : uploadedStores.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-700">
                          <TableHead>{t("gemini-search.files.fileName")}</TableHead>
                          <TableHead>{t("gemini-search.files.uploadedAt")}</TableHead>
                          <TableHead>{t("gemini-search.files.updatedAt")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadedStores.map((store) => (
                          <TableRow
                            key={store.name}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <TableCell className="font-medium">{store.displayName}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(store.createTime).toLocaleString("ko-KR")}
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(store.updateTime).toLocaleString("ko-KR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Database className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">
                      {t("gemini-search.files.emptyTitle")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("gemini-search.files.emptyDescription")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
