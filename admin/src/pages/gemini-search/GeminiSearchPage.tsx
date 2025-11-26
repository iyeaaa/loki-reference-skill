import { motion } from "framer-motion"
import {
  AlertCircle,
  Database,
  Download,
  FileUp,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Upload,
} from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
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
  const fileId = useId()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

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
  const metaCountryId = useId()
  const metaRegionId = useId()
  const metaVerticalId = useId()
  const metaSourceId = useId()
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
      toast.error("스토어 목록을 불러오지 못했습니다")
    } finally {
      setIsLoadingStores(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 업로드된 파일 목록 불러오기
  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  // CSV 업로드
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("파일을 선택해주세요")
      return
    }

    if (!workspaceId || workspaceId === "all") {
      toast.error("워크스페이스를 선택해주세요")
      return
    }

    try {
      setIsUploading(true)

      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("workspaceId", workspaceId)

      // 메타데이터 추가 (값이 있는 것만)
      const metadataObj: Record<string, string> = {}
      if (metadata.country) metadataObj.country = metadata.country
      if (metadata.region) metadataObj.region = metadata.region
      if (metadata.vertical) metadataObj.vertical = metadata.vertical
      if (metadata.source) metadataObj.source = metadata.source
      if (metadata.dbVersion) metadataObj.dbVersion = metadata.dbVersion

      if (Object.keys(metadataObj).length > 0) {
        formData.append("metadata", JSON.stringify(metadataObj))
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/admin/gemini-search/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`업로드 성공! ${result.data.totalRows}개 리드가 등록되었습니다`)
        setSelectedFile(null)
        setMetadata({ country: "", region: "", vertical: "", source: "", dbVersion: "" })
        fetchStores()
      } else {
        throw new Error(result.message || "업로드 실패")
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error instanceof Error ? error.message : "업로드에 실패했습니다")
    } finally {
      setIsUploading(false)
    }
  }

  // 리드 검색
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("검색어를 입력해주세요")
      return
    }

    if (!workspaceId || workspaceId === "all") {
      toast.error("워크스페이스를 선택해주세요")
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
          `${result.data.totalResults}개의 리드를 찾았습니다 (${result.data.processingTime.toFixed(2)}초)`,
        )
      } else {
        throw new Error(result.message || "검색 실패")
      }
    } catch (error) {
      console.error("Search error:", error)
      toast.error(error instanceof Error ? error.message : "검색에 실패했습니다")
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
      toast.error("리드를 선택해주세요")
      return
    }

    if (!selectedGroupId) {
      toast.error("고객 그룹을 선택해주세요")
      return
    }

    if (!workspaceId || workspaceId === "all") {
      toast.error("워크스페이스를 선택해주세요")
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
        throw new Error(`서버 오류 (${response.status}): JSON 응답이 아닙니다`)
      }

      const result = await response.json()
      console.log("📊 Bulk create result:", result)

      if (response.ok) {
        // 🎯 간단한 해결책: 선택한 개수를 이미 알고 있으니 그걸 사용!
        const selectedCount = selectedLeads.size
        const stats = result.stats || {}
        const duplicates = result.duplicateEmails?.length || stats.skipped || 0
        const actualCreated = selectedCount - duplicates

        toast.success(
          `${actualCreated}개 리드가 추가되었습니다!${duplicates > 0 ? ` (${duplicates}개 중복)` : ""}`,
        )

        // 선택 초기화
        setSelectedLeads(new Set())
        setSelectedGroupId("")
      } else {
        throw new Error(result.message || result.error || "리드 추가 실패")
      }
    } catch (error) {
      console.error("❌ Add to campaign error:", error)
      toast.error(error instanceof Error ? error.message : "캠페인 추가에 실패했습니다")
    } finally {
      setIsAddingToCampaign(false)
    }
  }

  // 엑셀 다운로드
  const handleDownloadExcel = () => {
    if (searchResults.length === 0) {
      toast.error("다운로드할 결과가 없습니다")
      return
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(searchResults)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads")

      XLSX.writeFile(workbook, `gemini-search-results-${Date.now()}.xlsx`)
      toast.success("엑셀 파일이 다운로드되었습니다")
    } catch (error) {
      console.error("Download error:", error)
      toast.error("다운로드에 실패했습니다")
    }
  }

  // Drive URL에서 파일 가져오기
  const handleImportFromDrive = async () => {
    if (!driveUrl.trim()) {
      toast.error("Drive 공유 URL을 입력해주세요")
      return
    }

    if (!workspaceId || workspaceId === "all") {
      toast.error("워크스페이스를 선택해주세요")
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
        toast.success(`가져오기 성공! ${result.data.totalRows}개 리드가 등록되었습니다`)
        setDriveUrl("")
        setMetadata({ country: "", region: "", vertical: "", source: "", dbVersion: "" })
        fetchStores()
      } else {
        throw new Error(result.message || "가져오기 실패")
      }
    } catch (error) {
      console.error("Import error:", error)
      toast.error(error instanceof Error ? error.message : "가져오기에 실패했습니다")
    } finally {
      setIsImportingFromDrive(false)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Gemini File Search</h1>
            <p className="text-muted-foreground">
              Google Gemini AI로 전세계 리드를 스마트하게 검색하세요
            </p>
          </div>
        </div>

        {/* 알림: Gemini API 키 필요 */}
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            이 기능을 사용하려면 서버에 <strong>GEMINI_API_KEY</strong> 환경 변수가 설정되어 있어야
            합니다.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="search" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="search">
              <Search className="h-4 w-4 mr-2" />
              검색
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              로컬 업로드
            </TabsTrigger>
            <TabsTrigger value="drive">
              <Database className="h-4 w-4 mr-2" />
              Drive 가져오기
            </TabsTrigger>
            <TabsTrigger value="files">
              <Database className="h-4 w-4 mr-2" />
              업로드된 파일
            </TabsTrigger>
          </TabsList>

          {/* 검색 탭 */}
          <TabsContent value="search">
            <Card>
              <CardHeader>
                <CardTitle>리드 검색</CardTitle>
                <CardDescription>
                  자연어로 검색하세요 (예: "독일의 침구 도매업체 찾아줘")
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={searchQueryId}>검색 쿼리</Label>
                  <Textarea
                    id={searchQueryId}
                    placeholder="예: 독일에서 호텔에 침구를 공급하는 도매업체"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* 필터 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={filterCountryId}>국가 (선택)</Label>
                    <Input
                      id={filterCountryId}
                      placeholder="예: Germany"
                      value={filters.country}
                      onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={filterRegionId}>지역 (선택)</Label>
                    <Input
                      id={filterRegionId}
                      placeholder="예: Europe"
                      value={filters.region}
                      onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={filterVerticalId}>업종 (선택)</Label>
                    <Input
                      id={filterVerticalId}
                      placeholder="예: bedding"
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
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        검색 중...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        검색
                      </>
                    )}
                  </Button>

                  {searchResults.length > 0 && (
                    <Button onClick={handleDownloadExcel} variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  )}
                </div>

                {/* 리드 선택 및 캠페인 추가 */}
                {searchResults.length > 0 && (
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {selectedLeads.size > 0
                          ? `${selectedLeads.size}개 리드 선택됨`
                          : "리드를 선택하고 캠페인에 추가하세요"}
                      </p>
                    </div>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="고객 그룹 선택" />
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
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          추가 중...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          캠페인에 추가
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
                        <TableRow>
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
                          <TableHead className="min-w-[100px]">신뢰도</TableHead>
                          <TableHead className="min-w-[200px]">매칭 이유</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.map((result, idx) => (
                          <TableRow
                            key={`result-${idx}-${result.companyName || result["Company Name"] || idx}`}
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
                  <div className="text-center py-12 text-muted-foreground">
                    검색 결과가 여기에 표시됩니다
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 로컬 CSV 업로드 탭 */}
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>CSV 파일 업로드</CardTitle>
                <CardDescription>
                  리드 데이터를 Gemini File Search에 업로드하세요 (최대 100MB)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 파일 선택 영역 */}
                <label
                  htmlFor={fileId}
                  className={`block border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <FileUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      파일을 드래그하거나 클릭하여 선택하세요
                    </p>
                    <input
                      type="file"
                      id={fileId}
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault()
                        document.getElementById(fileId)?.click()
                      }}
                    >
                      파일 선택
                    </Button>
                  </div>
                  {selectedFile && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  )}
                </label>

                {/* 메타데이터 입력 */}
                <div className="space-y-2">
                  <Label>메타데이터 (선택사항)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="meta-country" className="text-xs">
                        국가
                      </Label>
                      <Input
                        id={metaCountryId}
                        placeholder="예: Germany"
                        value={metadata.country}
                        onChange={(e) => setMetadata({ ...metadata, country: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={metaRegionId} className="text-xs">
                        지역
                      </Label>
                      <Input
                        id={metaRegionId}
                        placeholder="예: Europe"
                        value={metadata.region}
                        onChange={(e) => setMetadata({ ...metadata, region: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={metaVerticalId} className="text-xs">
                        업종
                      </Label>
                      <Input
                        id={metaVerticalId}
                        placeholder="예: bedding"
                        value={metadata.vertical}
                        onChange={(e) => setMetadata({ ...metadata, vertical: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={metaSourceId} className="text-xs">
                        출처
                      </Label>
                      <Input
                        id={metaSourceId}
                        placeholder="예: Beauty-DB-2025"
                        value={metadata.source}
                        onChange={(e) => setMetadata({ ...metadata, source: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Gemini에 업로드
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Google Drive 가져오기 탭 */}
          <TabsContent value="drive">
            <Card>
              <CardHeader>
                <CardTitle>Google Drive에서 가져오기</CardTitle>
                <CardDescription>
                  Google Drive 공유 링크로 리드 데이터를 Gemini로 가져오세요 (API 인증 불필요!)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 안내 메시지 */}
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>사용 방법:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                      <li>Google Drive에서 파일 우클릭 → "링크 복사"</li>
                      <li>공유 설정: "링크가 있는 모든 사용자"로 변경</li>
                      <li>아래에 URL 붙여넣기</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                {/* Drive URL 입력 */}
                <div className="space-y-2">
                  <Label htmlFor={driveUrlId}>Google Drive 공유 URL</Label>
                  <Textarea
                    id={driveUrlId}
                    placeholder="예: https://drive.google.com/file/d/YOUR_FILE_ID/view"
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    지원 형식: /file/d/FILE_ID/view, ?id=FILE_ID, 또는 직접 FILE_ID
                  </p>
                </div>

                {/* 메타데이터 입력 */}
                <div className="space-y-2">
                  <Label>메타데이터 (선택사항)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="drive-meta-country" className="text-xs">
                        국가
                      </Label>
                      <Input
                        id={driveMetaCountryId}
                        placeholder="예: South Korea"
                        value={metadata.country}
                        onChange={(e) => setMetadata({ ...metadata, country: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={driveMetaRegionId} className="text-xs">
                        지역
                      </Label>
                      <Input
                        id={driveMetaRegionId}
                        placeholder="예: Asia"
                        value={metadata.region}
                        onChange={(e) => setMetadata({ ...metadata, region: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={driveMetaVerticalId} className="text-xs">
                        업종
                      </Label>
                      <Input
                        id={driveMetaVerticalId}
                        placeholder="예: bedding, beauty"
                        value={metadata.vertical}
                        onChange={(e) => setMetadata({ ...metadata, vertical: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={driveMetaSourceId} className="text-xs">
                        출처
                      </Label>
                      <Input
                        id={driveMetaSourceId}
                        placeholder="예: Lead-DB-2025-Q1"
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
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      가져오는 중...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Drive에서 Gemini로 가져오기
                    </>
                  )}
                </Button>

                {/* 예시 */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <p className="text-sm font-medium mb-2">💡 URL 예시:</p>
                  <code className="text-xs break-all">
                    https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i0J/view
                  </code>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 업로드된 파일 탭 */}
          <TabsContent value="files">
            <Card>
              <CardHeader>
                <CardTitle>업로드된 파일</CardTitle>
                <CardDescription>Gemini에 업로드된 리드 데이터 파일 목록</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingStores ? (
                  <div className="text-center py-12">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">불러오는 중...</p>
                  </div>
                ) : uploadedStores.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>파일명</TableHead>
                          <TableHead>업로드 일시</TableHead>
                          <TableHead>수정 일시</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadedStores.map((store) => (
                          <TableRow key={store.name}>
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
                  <div className="text-center py-12 text-muted-foreground">
                    업로드된 파일이 없습니다
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
