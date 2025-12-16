import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
  Plus,
  Upload,
  UserCheck,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  useCreateCustomerGroup,
  useCustomerGroupsByWorkspace,
} from "@/lib/api/hooks/customer-groups"
import { useFetchSheetNames, useUploadLeads } from "@/lib/api/hooks/lead-import"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import type { ImportProgress, ImportResult } from "@/lib/api/services/lead-import"

export default function LeadImportPage() {
  // localStorage에서 사이드바의 현재 워크스페이스 가져오기
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(() => {
    const savedWorkspace = localStorage.getItem("selectedWorkspace") || ""
    // "all"이 선택된 경우 빈 문자열로 처리 (선택 안함)
    return savedWorkspace === "all" ? "" : savedWorkspace
  })
  const [selectedCustomerGroup, setSelectedCustomerGroup] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedSheet, setSelectedSheet] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // 고객 그룹 생성 다이얼로그 상태
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDescription, setNewGroupDescription] = useState("")

  // Unique IDs for form elements
  const workspaceSelectId = useId()
  const customerGroupSelectId = useId()
  const fileUploadId = useId()
  const sheetSelectId = useId()
  const groupNameId = useId()
  const groupDescriptionId = useId()

  // 현재 로그인한 유저의 ID 가져오기
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userId = currentUser?.id || ""

  // 유저가 소유하거나 멤버인 워크스페이스 목록 가져오기 (참여/소유한 것만)
  const { data: userWorkspaces } = useUserWorkspaces(userId, !!userId)

  // Workspace 배열로 변환
  const workspaces = userWorkspaces || []

  // 선택된 워크스페이스의 고객 그룹 조회
  const { data: customerGroups, refetch: refetchCustomerGroups } = useCustomerGroupsByWorkspace(
    selectedWorkspace,
    !!selectedWorkspace,
  )

  // 고객 그룹 생성 mutation
  const createCustomerGroupMutation = useCreateCustomerGroup()

  // 시트 이름 목록 조회 (TanStack Query)
  const {
    data: sheetNamesData,
    isLoading: isLoadingSheets,
    isError: isSheetError,
    error: sheetError,
  } = useFetchSheetNames(selectedFile, !!selectedFile)

  // 리드 임포트 mutation
  const uploadLeadsMutation = useUploadLeads()

  // 필수 컬럼 목록 (Excel/CSV에서 필요한 컬럼)
  const requiredColumns = ["company_name", "website_url"]

  // 선택적이지만 권장되는 컬럼
  const recommendedColumns = ["phone_number", "email"]

  // 엑셀/CSV 데이터 유효성 검증
  const validateExcelData = useCallback(
    async (
      file: File,
      sheetName: string,
    ): Promise<{ valid: boolean; error?: string; warning?: string }> => {
      try {
        const XLSX = await import("xlsx")

        const arrayBuffer = await file.arrayBuffer()
        const fileName = file.name.toLowerCase()

        let data: unknown[]

        // CSV 파일 처리
        if (fileName.endsWith(".csv")) {
          // CSV는 UTF-8로 읽기 (인코딩 문제 최소화)
          const workbook = XLSX.read(arrayBuffer, {
            type: "buffer",
            raw: false, // 문자열로 변환
            codepage: 65_001, // UTF-8 코드페이지
          })
          const firstSheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[firstSheetName]
          data = XLSX.utils.sheet_to_json(sheet, {
            defval: null,
            raw: false, // 문자열로 변환
          })
        } else {
          // Excel 파일 처리
          const workbook = XLSX.read(arrayBuffer, {
            type: "buffer",
            raw: false, // 문자열로 변환
          })
          const sheet = workbook.Sheets[sheetName]
          if (!sheet) {
            return { valid: false, error: "선택한 시트를 찾을 수 없습니다" }
          }
          data = XLSX.utils.sheet_to_json(sheet, {
            defval: null,
            raw: false, // 문자열로 변환
          })
        }

        if (data.length === 0) {
          return { valid: false, error: "파일에 데이터가 없습니다" }
        }

        // 첫 번째 행의 컬럼 확인
        const firstRow = data[0] as Record<string, unknown>
        const columns = Object.keys(firstRow)

        // 필수 컬럼 체크
        const missingRequired = requiredColumns.filter((col) => !columns.includes(col))
        if (missingRequired.length > 0) {
          return {
            valid: false,
            error: `필수 컬럼이 없습니다: ${missingRequired.join(", ")}`,
          }
        }

        // 권장 컬럼 체크 (경고만)
        const missingRecommended = recommendedColumns.filter((col) => !columns.includes(col))
        const warning =
          missingRecommended.length > 0
            ? `권장 컬럼이 없습니다: ${missingRecommended.join(", ")}`
            : undefined

        return { valid: true, warning }
      } catch (error) {
        console.error("Validation error:", error)
        return { valid: false, error: "데이터 검증 중 오류가 발생했습니다" }
      }
    },
    [],
  )

  // 시트 검증 헬퍼 함수
  const validateAndSetSheet = useCallback(
    async (file: File, sheetName: string) => {
      const validation = await validateExcelData(file, sheetName)

      if (validation.valid) {
        setValidationError(null)
        if (validation.warning) {
          toast.error(validation.warning, { duration: 5000, icon: "⚠️" })
        } else {
          toast.success("유효성 검증 완료")
        }
      } else {
        setValidationError(validation.error || "유효성 검증 실패")
        toast.error(validation.error || "유효성 검증 실패")
      }
    },
    [validateExcelData],
  )

  // 시트 이름 목록이 로드되면 자동으로 첫 번째 시트 선택
  useEffect(() => {
    if (sheetNamesData?.success && sheetNamesData.sheetNames.length > 0 && !selectedSheet) {
      const firstSheet = sheetNamesData.sheetNames[0]
      setSelectedSheet(firstSheet)
      toast.success(`${sheetNamesData.sheetNames.length}개의 시트를 찾았습니다`)
      // 자동으로 첫 번째 시트 검증
      if (selectedFile) {
        validateAndSetSheet(selectedFile, firstSheet)
      }
    }
  }, [sheetNamesData, selectedFile, selectedSheet, validateAndSetSheet])

  // 시트 이름 로드 에러 처리
  useEffect(() => {
    if (isSheetError && sheetError) {
      toast.error(
        sheetError instanceof Error ? sheetError.message : "시트 이름을 가져오는데 실패했습니다",
      )
    }
  }, [isSheetError, sheetError])

  // 파일 선택 핸들러
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    // 파일 크기 체크 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("파일 크기는 50MB 이하여야 합니다")
      return
    }

    // 파일 확장자 체크
    const fileName = file.name.toLowerCase()
    if (!(fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv"))) {
      toast.error("Excel 파일(.xlsx, .xls) 또는 CSV 파일(.csv)만 업로드 가능합니다")
      return
    }

    setSelectedFile(file)
    setSelectedSheet("")
    setImportProgress(null)
    setImportResult(null)
    setValidationError(null)

    // CSV 파일인 경우 자동으로 유효성 검증 수행
    if (fileName.endsWith(".csv")) {
      const validation = await validateExcelData(file, "")
      if (validation.valid) {
        setValidationError(null)
        if (validation.warning) {
          toast.error(validation.warning, { duration: 5000, icon: "⚠️" })
        } else {
          toast.success("유효성 검증 완료")
        }
      } else {
        setValidationError(validation.error || "유효성 검증 실패")
        toast.error(validation.error || "유효성 검증 실패")
      }
    }
  }

  // 워크스페이스 변경 핸들러
  const handleWorkspaceChange = (workspaceId: string) => {
    setSelectedWorkspace(workspaceId)
    setSelectedCustomerGroup("") // 워크스페이스 변경 시 고객 그룹 초기화
  }

  // 시트 선택 핸들러 (유효성 검증 포함)
  const handleSheetChange = async (sheetName: string) => {
    setSelectedSheet(sheetName)
    setValidationError(null)

    if (!selectedFile) {
      return
    }

    // 유효성 검증 수행
    await validateAndSetSheet(selectedFile, sheetName)
  }

  // 고객 그룹 생성 핸들러
  const handleCreateGroup = async () => {
    if (!selectedWorkspace) {
      toast.error("워크스페이스를 먼저 선택해주세요")
      return
    }

    if (!newGroupName.trim()) {
      toast.error("그룹명을 입력해주세요")
      return
    }

    try {
      const newGroup = await createCustomerGroupMutation.mutateAsync({
        workspaceId: selectedWorkspace,
        name: newGroupName,
        description: newGroupDescription || undefined,
        isDynamic: false,
      })

      // 다이얼로그 닫기 및 폼 초기화
      setIsCreateGroupDialogOpen(false)
      setNewGroupName("")
      setNewGroupDescription("")

      // 고객 그룹 목록 새로고침
      await refetchCustomerGroups()

      // 생성된 그룹 자동 선택
      setSelectedCustomerGroup(newGroup.id)
      toast.success("고객 그룹이 생성되었습니다")
    } catch (error) {
      // 에러는 mutation에서 처리됨
      console.error("Failed to create customer group:", error)
    }
  }

  // 다이얼로그 취소 핸들러
  const handleCancelCreateGroup = () => {
    setIsCreateGroupDialogOpen(false)
    setNewGroupName("")
    setNewGroupDescription("")
  }

  // 임포트 시작
  const handleImport = async () => {
    if (!selectedWorkspace) {
      toast.error("워크스페이스를 선택해주세요")
      return
    }

    if (!selectedFile) {
      toast.error("파일을 선택해주세요")
      return
    }

    // CSV 파일이 아닌 경우에만 시트 선택 확인
    const isCSV = selectedFile.name.toLowerCase().endsWith(".csv")
    if (!(isCSV || selectedSheet)) {
      toast.error("시트를 선택해주세요")
      return
    }

    if (validationError) {
      toast.error("유효성 검증을 통과하지 못했습니다. 다른 시트를 선택하거나 파일을 수정해주세요")
      return
    }

    setImportProgress(null)
    setImportResult(null)

    try {
      const result = await uploadLeadsMutation.mutateAsync({
        file: selectedFile,
        workspaceId: selectedWorkspace,
        sheetName: isCSV ? "" : selectedSheet,
        customerGroupId: selectedCustomerGroup || undefined,
        onProgress: (progress: ImportProgress) => {
          setImportProgress(progress)
        },
      })

      setImportResult(result)
      toast.success(
        `임포트 완료: 성공 ${result.success}건, 스킵 ${result.skipped}건, 실패 ${result.failed}건`,
      )
    } catch (error) {
      console.error("Import failed:", error)
      toast.error(error instanceof Error ? error.message : "임포트에 실패했습니다")
    }
  }

  // 폼 초기화
  const handleReset = () => {
    setSelectedFile(null)
    setSelectedSheet("")
    setSelectedCustomerGroup("")
    setImportProgress(null)
    setImportResult(null)
    setValidationError(null)
    // 파일 input 초기화
    const fileInput = document.getElementById(fileUploadId) as HTMLInputElement
    if (fileInput) {
      fileInput.value = ""
    }
  }

  // 진행률 계산
  const progressPercentage =
    importProgress?.total && importProgress.processed
      ? Math.round((importProgress.processed / importProgress.total) * 100)
      : 0

  const isImporting = uploadLeadsMutation.isPending

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">리드 데이터 임포트</h1>
        <p className="mt-2 text-muted-foreground">
          Excel 또는 CSV 파일을 업로드하여 리드 데이터를 일괄 임포트합니다. 중복된 website_url은
          자동으로 스킵됩니다.
        </p>
      </div>

      {/* 임포트 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>임포트 설정</CardTitle>
          <CardDescription>워크스페이스와 Excel 또는 CSV 파일을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 워크스페이스 선택 */}
          <div className="space-y-2">
            <Label htmlFor={workspaceSelectId}>워크스페이스 *</Label>
            <Select
              disabled={isImporting}
              onValueChange={handleWorkspaceChange}
              value={selectedWorkspace}
            >
              <SelectTrigger id={workspaceSelectId}>
                <SelectValue placeholder="워크스페이스 선택" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 고객 그룹 선택 (선택사항) */}
          {selectedWorkspace && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={customerGroupSelectId}>고객 그룹 (선택사항)</Label>
                <Button
                  disabled={isImporting}
                  onClick={() => setIsCreateGroupDialogOpen(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="mr-1 h-4 w-4" />새 그룹 생성
                </Button>
              </div>
              <Select
                disabled={isImporting}
                onValueChange={setSelectedCustomerGroup}
                value={selectedCustomerGroup}
              >
                <SelectTrigger id={customerGroupSelectId}>
                  <SelectValue placeholder="고객 그룹 선택 (선택하지 않으면 그룹에 추가되지 않음)" />
                </SelectTrigger>
                <SelectContent>
                  {customerGroups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        {group.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                선택한 고객 그룹에 임포트된 모든 리드가 자동으로 추가됩니다
              </p>
            </div>
          )}

          {/* 파일 업로드 */}
          <div className="space-y-2">
            <Label htmlFor={fileUploadId}>Excel 또는 CSV 파일 *</Label>
            <Input
              accept=".xlsx,.xls,.csv"
              disabled={isImporting}
              id={fileUploadId}
              onChange={handleFileSelect}
              type="file"
            />
            {selectedFile && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <FileUp className="h-4 w-4" />
                <span>
                  {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                </span>
              </div>
            )}
          </div>

          {/* 시트 선택 (Excel 파일만) */}
          {selectedFile &&
            !selectedFile.name.toLowerCase().endsWith(".csv") &&
            sheetNamesData?.sheetNames &&
            sheetNamesData.sheetNames.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor={sheetSelectId}>시트 선택 *</Label>
                <Select
                  disabled={isImporting || isLoadingSheets}
                  onValueChange={handleSheetChange}
                  value={selectedSheet}
                >
                  <SelectTrigger id={sheetSelectId}>
                    <SelectValue placeholder="시트 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {sheetNamesData.sheetNames.map((sheetName) => (
                      <SelectItem key={sheetName} value={sheetName}>
                        {sheetName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  시트 선택 시 자동으로 유효성 검증이 수행됩니다
                </p>
              </div>
            )}

          {/* 유효성 검증 에러 표시 */}
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>유효성 검증 실패</AlertTitle>
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {isLoadingSheets && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>시트 정보를 불러오는 중...</span>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-4">
            <Button
              className="flex-1"
              disabled={
                !(
                  selectedWorkspace &&
                  selectedFile &&
                  (selectedFile?.name.toLowerCase().endsWith(".csv") || selectedSheet)
                ) ||
                isImporting ||
                !!validationError
              }
              onClick={handleImport}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  임포트 중...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  임포트 시작
                </>
              )}
            </Button>
            <Button disabled={isImporting} onClick={handleReset} variant="outline">
              초기화
            </Button>
          </div>
          {validationError && (
            <p className="text-destructive text-xs">유효성 검증을 통과해야 임포트할 수 있습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 진행 상황 */}
      {importProgress && (
        <Card>
          <CardHeader>
            <CardTitle>임포트 진행 상황</CardTitle>
            <CardDescription>
              {importProgress.type === "complete" ? "임포트가 완료되었습니다" : "임포트 진행 중..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 진행률 바 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">진행률</span>
                <span className="text-muted-foreground">
                  {importProgress.processed || 0} / {importProgress.total || 0} (
                  {progressPercentage}%)
                </span>
              </div>
              <Progress className="h-2" value={progressPercentage} />
            </div>

            {/* 현재 처리 중인 항목 */}
            {importProgress.type === "progress" && importProgress.currentCompanyName && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  처리 중: {importProgress.currentCompanyName} (Row {importProgress.currentRow})
                </span>
              </div>
            )}

            {/* 통계 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">성공</span>
                </div>
                <div className="font-bold text-2xl">{importProgress.success || 0}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-sm">스킵</span>
                </div>
                <div className="font-bold text-2xl">{importProgress.skipped || 0}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-sm">실패</span>
                </div>
                <div className="font-bold text-2xl">{importProgress.failed || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 완료 결과 */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle>임포트 결과</CardTitle>
            <CardDescription>소요 시간: {importResult.duration}ms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 요약 */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="px-3 py-1 text-base" variant="default">
                <CheckCircle2 className="mr-1 h-4 w-4" />
                성공: {importResult.success}건
              </Badge>
              <Badge className="px-3 py-1 text-base" variant="secondary">
                <AlertCircle className="mr-1 h-4 w-4" />
                스킵: {importResult.skipped}건
              </Badge>
              {importResult.failed > 0 && (
                <Badge className="px-3 py-1 text-base" variant="destructive">
                  <XCircle className="mr-1 h-4 w-4" />
                  실패: {importResult.failed}건
                </Badge>
              )}
            </div>

            {/* 스킵된 항목 목록 */}
            {importResult.skippedLeads && importResult.skippedLeads.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle>스킵된 항목 ({importResult.skippedLeads.length}건)</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                    {importResult.skippedLeads.map((skipped, index) => (
                      <div className="border-yellow-400 border-l-2 pl-2 text-sm" key={index}>
                        <div className="font-medium">
                          Row {skipped.rowNumber}: {skipped.companyName || "N/A"}
                        </div>
                        <div className="text-muted-foreground text-xs">{skipped.websiteUrl}</div>
                        <div className="text-yellow-700 dark:text-yellow-300">{skipped.reason}</div>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* 에러 목록 */}
            {importResult.errors && importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>실패한 항목 ({importResult.errors.length}건)</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <div className="border-red-400 border-l-2 pl-2 text-sm" key={index}>
                        <div className="font-medium">
                          Row {error.row}: {error.companyName || "N/A"}
                        </div>
                        <div className="text-red-700 dark:text-red-300">{error.error}</div>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 고객 그룹 생성 다이얼로그 */}
      <Dialog onOpenChange={setIsCreateGroupDialogOpen} open={isCreateGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 고객 그룹 생성</DialogTitle>
            <DialogDescription>
              새로운 고객 그룹을 생성합니다. 생성 후 자동으로 선택됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={groupNameId}>그룹명 *</Label>
              <Input
                id={groupNameId}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleCreateGroup()
                  }
                }}
                placeholder="고객 그룹명을 입력하세요"
                value={newGroupName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={groupDescriptionId}>설명 (선택사항)</Label>
              <Textarea
                id={groupDescriptionId}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="그룹 설명을 입력하세요"
                rows={3}
                value={newGroupDescription}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={createCustomerGroupMutation.isPending}
              onClick={handleCancelCreateGroup}
              type="button"
              variant="outline"
            >
              취소
            </Button>
            <Button
              disabled={createCustomerGroupMutation.isPending || !newGroupName.trim()}
              onClick={handleCreateGroup}
              type="button"
            >
              {createCustomerGroupMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                "생성"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
