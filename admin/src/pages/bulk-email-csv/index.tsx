import {
  Building2,
  Download,
  FileSpreadsheet,
  Loader2,
  Mail,
  Send,
  Trash2,
  Upload,
  User,
} from "lucide-react"
import Papa from "papaparse"
import { useEffect, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBulkEmailSend } from "@/lib/api/hooks/bulk-emails"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useUsers } from "@/lib/api/hooks/users"
import { useSuspenseWorkspaces } from "@/lib/api/hooks/workspaces"
import type { BulkEmailResult } from "@/lib/api/types/bulk-email"
import { useAuth } from "@/lib/auth-provider"

type CSVEmailData = {
  fromEmail: string
  toEmail: string
  subject: string
  bodyText?: string
  bodyHtml?: string
  fromName?: string
}

export default function BulkEmailCSVPage() {
  // Auth context for current user
  const { user } = useAuth()

  // Generate unique IDs for form elements
  const sendWorkspaceId = useId()
  const sendUserId = useId()
  const fromNameId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 워크스페이스 및 사용자 선택 - localStorage에서 기본값 가져오기
  const [selectedSendWorkspace, setSelectedSendWorkspace] = useState<string>(
    () => localStorage.getItem("selectedWorkspace") || "",
  )
  const [selectedSendUser, setSelectedSendUser] = useState<string>(() => user?.id || "")

  // 발신자 이름 (공통)
  const [fromName, setFromName] = useState("")

  // CSV 파일 및 파싱된 데이터
  const [csvFile, setCSVFile] = useState<File | null>(null)
  const [emailsData, setEmailsData] = useState<CSVEmailData[]>([])
  const [isSending, setIsSending] = useState(false)
  const [sendResults, setSendResults] = useState<BulkEmailResult[]>([])

  // 진행 상태 관리
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 })
  const [currentSendingEmail, setCurrentSendingEmail] = useState<string>("")

  // API hooks
  const {
    data: { workspaces },
  } = useSuspenseWorkspaces({ limit: 100 })
  const { data: usersData } = useUsers({ limit: 100 })
  const bulkEmailMutation = useBulkEmailSend()

  // 워크스페이스와 유저가 선택되면 이메일 계정 정보 조회
  const {
    data: emailAccountInfo,
    isLoading: isLoadingEmailAccount,
    error: emailAccountError,
  } = useEmailAccountByWorkspaceAndUser(selectedSendWorkspace, !!selectedSendWorkspace)

  // 워크스페이스를 사이드바 선택값 또는 첫 번째 항목으로 자동 선택
  useEffect(() => {
    const savedWorkspace = localStorage.getItem("selectedWorkspace")
    if (savedWorkspace && savedWorkspace !== "all" && !selectedSendWorkspace) {
      setSelectedSendWorkspace(savedWorkspace)
    } else if (workspaces && workspaces.length > 0 && !selectedSendWorkspace) {
      setSelectedSendWorkspace(workspaces[0].id)
    }
  }, [workspaces, selectedSendWorkspace])

  // 현재 로그인한 사용자를 기본값으로 설정
  useEffect(() => {
    if (user?.id && !selectedSendUser) {
      // 사용자가 선택한 워크스페이스의 사용자 목록에 현재 사용자가 있는지 확인
      const currentUserExists = usersData?.users?.some((u) => u.id === user.id)
      if (currentUserExists) {
        setSelectedSendUser(user.id)
      } else if (usersData?.users && usersData.users.length > 0) {
        setSelectedSendUser(usersData.users[0].id)
      }
    }
  }, [user, usersData, selectedSendUser])

  // CSV 파일 선택 핸들러
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.name.endsWith(".csv")) {
      toast.error("CSV 파일만 업로드 가능합니다")
      return
    }

    setCSVFile(file)
    setSendResults([])

    // CSV 파일 파싱
    try {
      const text = await file.text()

      // papaparse를 사용하여 CSV 파싱 (RFC 4180 표준 준수, 따옴표 안의 줄바꿈 처리)
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results: { data: Record<string, string>[] }) => {
          try {
            const data = results.data as Record<string, string>[]

            if (data.length === 0) {
              toast.error("유효한 이메일 데이터가 없습니다")
              return
            }

            // 헤더 이름 정규화 (대소문자 구분 없이, 공백 제거)
            const normalizedData = data.map((row) => {
              const normalizedRow: Record<string, string> = {}
              for (const [key, value] of Object.entries(row)) {
                normalizedRow[key.trim().toLowerCase()] = value
              }
              return normalizedRow
            })

            // 헤더에서 컬럼 이름 찾기
            const parsedEmails: CSVEmailData[] = []

            for (const row of normalizedData) {
              // 각 컬럼에 대해 여러 가능한 헤더 이름 확인
              const fromEmail = row.발신인 || row.fromemail || row.from || row.sender || ""
              const toEmail = row.수신인 || row.toemail || row.to || row.recipient || ""
              const subject = row.제목 || row.subject || row.title || ""
              const bodyText =
                row["이메일 내용"] ||
                row.내용 ||
                row.bodytext ||
                row.body ||
                row.content ||
                row.text ||
                ""
              const bodyHtml = row.html내용 || row.bodyhtml || row.html || ""

              // 수신인과 제목은 필수
              if (!(toEmail && subject)) {
                continue
              }

              const emailData: CSVEmailData = {
                fromEmail: fromEmail.trim(),
                toEmail: toEmail.trim(),
                subject: subject.trim(),
                bodyText: bodyText ? bodyText.trim() : undefined,
                bodyHtml: bodyHtml ? bodyHtml.trim() : undefined,
              }

              parsedEmails.push(emailData)
            }

            if (parsedEmails.length === 0) {
              toast.error("필수 컬럼이 없습니다. 수신인(to), 제목(subject)은 필수입니다.")
              return
            }

            // 중복된 이메일 주소 제거
            const emailMap = new Map<string, CSVEmailData>()
            const duplicates: string[] = []

            for (const email of parsedEmails) {
              const emailKey = email.toEmail.toLowerCase()
              if (emailMap.has(emailKey)) {
                duplicates.push(email.toEmail)
              } else {
                emailMap.set(emailKey, email)
              }
            }

            const uniqueEmails = Array.from(emailMap.values())

            setEmailsData(uniqueEmails)
            toast.success(
              `${uniqueEmails.length}개의 이메일 데이터를 불러왔습니다${
                duplicates.length > 0 ? ` (중복 ${duplicates.length}개 제거됨)` : ""
              }`,
            )
          } catch (err) {
            console.error("Failed to process parsed CSV:", err)
            toast.error("CSV 파일 처리 중 오류가 발생했습니다")
          }
        },
        error: (error: Error) => {
          console.error("Failed to parse CSV:", error)
          toast.error("CSV 파일 파싱에 실패했습니다")
        },
      })
    } catch (error) {
      console.error("Failed to read CSV file:", error)
      toast.error("CSV 파일을 읽을 수 없습니다")
    }
  }

  // 대량 메일 발송 핸들러 (2초 간격으로 순차 발송)
  const handleBulkSend = async () => {
    if (!(selectedSendWorkspace && selectedSendUser)) {
      toast.error("워크스페이스와 사용자를 선택해주세요")
      return
    }

    if (emailsData.length === 0) {
      toast.error("먼저 CSV 파일을 업로드해주세요")
      return
    }

    if (!emailAccountInfo) {
      toast.error("이메일 계정 정보를 찾을 수 없습니다")
      return
    }

    setIsSending(true)
    setSendResults([])
    setSendingProgress({ current: 0, total: emailsData.length })

    const results: BulkEmailResult[] = []

    try {
      // 각 이메일을 2초 간격으로 순차 발송
      for (let i = 0; i < emailsData.length; i++) {
        const email = emailsData[i]
        const fromEmailValue = email.fromEmail?.trim() || emailAccountInfo.emailAddress

        // 현재 발송 중인 이메일 정보 업데이트
        setCurrentSendingEmail(email.toEmail)
        setSendingProgress({ current: i + 1, total: emailsData.length })

        try {
          // TanStack Query mutation을 사용한 단일 이메일 발송
          const response = await bulkEmailMutation.mutateAsync({
            workspaceId: selectedSendWorkspace,
            userId: selectedSendUser,
            emails: [
              {
                fromEmail: fromEmailValue,
                toEmail: email.toEmail,
                subject: email.subject,
                bodyText: email.bodyText,
                bodyHtml: email.bodyHtml,
                fromName: fromName || emailAccountInfo.displayName || undefined,
              },
            ],
          })

          // 응답에서 첫 번째 결과 가져오기
          if (response.results?.[0]) {
            results.push(response.results[0])
          } else {
            results.push({
              toEmail: email.toEmail,
              subject: email.subject,
              success: false,
              error: "발송 결과를 확인할 수 없습니다",
            })
          }
        } catch (error) {
          console.error(`Failed to send email to ${email.toEmail}:`, error)
          results.push({
            toEmail: email.toEmail,
            subject: email.subject,
            success: false,
            error: error instanceof Error ? error.message : "이메일 발송 중 오류가 발생했습니다",
          })
        }

        // 실시간으로 결과 업데이트
        setSendResults([...results])

        // 마지막 이메일이 아니면 2초 대기
        if (i < emailsData.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }

      const successCount = results.filter((r) => r.success).length
      const failCount = results.filter((r) => !r.success).length

      toast.success(`발송 완료: 성공 ${successCount}건, 실패 ${failCount}건`)
    } catch (error) {
      console.error("Failed to send bulk emails:", error)
      const errorMessage =
        error instanceof Error ? error.message : "대량 메일 발송 중 오류가 발생했습니다"
      toast.error(errorMessage)
    } finally {
      setIsSending(false)
      setCurrentSendingEmail("")
      setSendingProgress({ current: 0, total: 0 })
    }
  }

  // 초기화
  const handleClear = () => {
    setCSVFile(null)
    setEmailsData([])
    setSendResults([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // CSV 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const templateData = [
      ["발신인", "수신인", "제목", "이메일 내용"],
      [
        "sender@email.com",
        "example1@email.com",
        "테스트 제목 1",
        "안녕하세요. 이것은 테스트 이메일입니다.",
      ],
      ["", "example2@email.com", "테스트 제목 2", "반갑습니다. 두 번째 테스트 이메일입니다."],
      ["", "example3@email.com", "프로모션 안내", "특별 할인 이벤트를 안내드립니다."],
    ]

    const csvContent = templateData.map((row) => row.join(",")).join("\n")
    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute("download", "email_template.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success("CSV 템플릿 다운로드 완료")
  }

  return (
    <div className="space-y-6 p-6">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" />
          <h1 className="font-bold text-2xl">CSV 대량 메일 발송</h1>
        </div>
        <p className="text-muted-foreground">
          CSV 파일을 업로드하여 여러 수신자에게 이메일을 한 번에 발송합니다
        </p>
      </div>

      {/* 발송 설정 - 워크스페이스 및 사용자 선택 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>발송 설정</CardTitle>
          </div>
          <CardDescription>
            선택한 워크스페이스와 사용자에 따라 발송 이메일 계정이 자동으로 설정됩니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={sendWorkspaceId}>워크스페이스 *</Label>
              <Select onValueChange={setSelectedSendWorkspace} value={selectedSendWorkspace}>
                <SelectTrigger id={sendWorkspaceId}>
                  <SelectValue placeholder="워크스페이스 선택" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces?.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {workspace.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={sendUserId}>사용자 *</Label>
              <Select onValueChange={setSelectedSendUser} value={selectedSendUser}>
                <SelectTrigger id={sendUserId}>
                  <SelectValue placeholder="사용자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {usersData?.users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {user.username} ({user.email})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 로딩 상태 */}
          {isLoadingEmailAccount && selectedSendWorkspace && selectedSendUser && (
            <div className="rounded-lg bg-muted p-4 text-muted-foreground text-sm">
              이메일 계정 정보를 불러오는 중...
            </div>
          )}

          {/* 이메일 계정 정보 표시 */}
          {emailAccountInfo && !isLoadingEmailAccount && (
            <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="font-semibold text-green-900 text-sm dark:text-green-100">
                    발신 이메일 계정 설정됨
                  </div>
                  <div className="text-green-600 text-xs dark:text-green-400">
                    이 계정으로 모든 이메일이 발송됩니다
                  </div>
                </div>
              </div>
              <div className="space-y-2 pl-10">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-green-700 dark:text-green-300">이메일:</span>
                  <span className="font-mono text-green-900 dark:text-green-100">
                    {emailAccountInfo.emailAddress}
                  </span>
                </div>
                {emailAccountInfo.displayName && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-green-700 dark:text-green-300">
                      표시 이름:
                    </span>
                    <span className="text-green-900 dark:text-green-100">
                      {emailAccountInfo.displayName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 에러 상태 */}
          {emailAccountError &&
            !isLoadingEmailAccount &&
            selectedSendWorkspace &&
            selectedSendUser && (
              <div className="space-y-2 rounded-lg bg-destructive/10 p-4 text-destructive">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/20">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="font-semibold">이메일 계정을 찾을 수 없습니다</div>
                </div>
                <p className="pl-10 text-sm">
                  선택한 워크스페이스와 사용자에 대한 활성화된 이메일 계정이 없습니다. 이메일 계정
                  페이지에서 먼저 등록해주세요.
                </p>
              </div>
            )}

          <div className="space-y-2">
            <Label htmlFor={fromNameId}>발신자 이름 (선택)</Label>
            <Input
              disabled={!emailAccountInfo}
              id={fromNameId}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="발신자 이름"
              value={fromName}
            />
            <p className="text-muted-foreground text-xs">
              비어있으면 이메일 계정의 표시 이름({emailAccountInfo?.displayName || "미설정"})이
              사용됩니다
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CSV 파일 업로드 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            <CardTitle>CSV 파일 업로드</CardTitle>
          </div>
          <CardDescription>
            발신인, 수신인, 제목, 이메일 내용 순서로 구성된 CSV 파일을 업로드하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>CSV 파일 형식</Label>
              <Button onClick={handleDownloadTemplate} size="sm" variant="outline">
                <Download className="mr-2 h-4 w-4" />
                템플릿 다운로드
              </Button>
            </div>
            <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium">CSV 열 구성 (순서대로):</p>
              <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                <li>
                  <strong>발신인</strong> (from, fromemail, 발신인) - 비어있으면 선택한 이메일 계정
                  사용
                </li>
                <li>
                  <strong>수신인</strong> (to, toemail, 수신인) - 필수
                </li>
                <li>
                  <strong>제목</strong> (subject, 제목) - 필수
                </li>
                <li>
                  <strong>이메일 내용</strong> (body, bodytext, content, 내용, 이메일 내용)
                </li>
              </ol>
              <p className="mt-3 text-muted-foreground text-xs">
                ※ 템플릿 다운로드 버튼을 클릭하면 예시 데이터가 포함된 CSV 파일을 받을 수 있습니다
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>파일 선택</Label>
            <Input accept=".csv" onChange={handleFileChange} ref={fileInputRef} type="file" />
          </div>

          {csvFile && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="font-semibold text-blue-900 text-sm dark:text-blue-100">
                    {csvFile.name}
                  </p>
                  <p className="text-blue-600 text-xs dark:text-blue-400">
                    {emailsData.length}개의 이메일 데이터
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 업로드된 데이터 미리보기 */}
      {emailsData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              <CardTitle>업로드된 데이터 미리보기</CardTitle>
            </div>
            <CardDescription>{emailsData.length}개의 이메일이 발송됩니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>발신인</TableHead>
                    <TableHead>수신인</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead>내용 미리보기</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailsData.slice(0, 10).map((email, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                      <TableCell className="font-mono text-muted-foreground text-xs">
                        {email.fromEmail?.trim() || emailAccountInfo?.emailAddress || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{email.toEmail}</TableCell>
                      <TableCell className="text-sm">{email.subject}</TableCell>
                      <TableCell className="max-w-md text-muted-foreground text-sm">
                        {email.bodyText ? (
                          <div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                            {email.bodyText.length > 200
                              ? `${email.bodyText.substring(0, 200)}...`
                              : email.bodyText}
                          </div>
                        ) : email.bodyHtml ? (
                          "HTML 내용"
                        ) : (
                          "없음"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {emailsData.length > 10 && (
              <p className="mt-2 text-muted-foreground text-sm">
                처음 10개만 표시됩니다. 총 {emailsData.length}개의 이메일
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 발송 버튼 */}
      {emailsData.length > 0 && !isSending && sendResults.length === 0 && (
        <div className="flex justify-end gap-3">
          <Button disabled={isSending} onClick={handleClear} variant="outline">
            <Trash2 className="mr-2 h-4 w-4" />
            초기화
          </Button>
          <Button disabled={isSending || !emailAccountInfo} onClick={handleBulkSend} size="lg">
            <Send className="mr-2 h-5 w-5" />
            {emailsData.length}개 이메일 발송
          </Button>
        </div>
      )}

      {/* 진행률 표시 */}
      {isSending && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <CardTitle>발송 진행 중</CardTitle>
            </div>
            <CardDescription>
              {sendingProgress.current} / {sendingProgress.total} 완료 (
              {Math.round((sendingProgress.current / sendingProgress.total) * 100)}%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress
              className="h-3"
              value={(sendingProgress.current / sendingProgress.total) * 100}
            />
            {currentSendingEmail && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  현재 발송 중: <span className="font-mono">{currentSendingEmail}</span>
                </span>
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              각 이메일은 2초 간격으로 발송됩니다. 브라우저를 닫지 마세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 발송 결과 */}
      {sendResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <CardTitle>발송 결과</CardTitle>
            </div>
            <CardDescription>
              성공: {sendResults.filter((r) => r.success).length}건, 실패:{" "}
              {sendResults.filter((r) => !r.success).length}건
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>수신인</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead>메시지</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sendResults.map((result, index) => {
                    const emailData = emailsData[index]
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                        <TableCell>
                          {result.success ? (
                            <Badge className="bg-green-500">성공</Badge>
                          ) : (
                            <Badge variant="destructive">실패</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-mono text-sm">{result.toEmail}</div>
                            {emailData?.fromEmail?.trim() && (
                              <div className="font-mono text-muted-foreground text-xs">
                                From: {emailData.fromEmail.trim()}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{result.subject}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {result.error || "발송 완료"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 발송 완료 후 초기화 버튼 */}
      {sendResults.length > 0 && !isSending && (
        <div className="flex justify-end">
          <Button onClick={handleClear} variant="outline">
            <Trash2 className="mr-2 h-4 w-4" />
            초기화하고 다시 시작
          </Button>
        </div>
      )}
    </div>
  )
}
