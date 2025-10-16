import {
  Building2,
  Download,
  FileUp,
  Loader2,
  Mail,
  Send,
  Trash2,
  Upload,
  User,
} from "lucide-react"
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
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useUsers } from "@/lib/api/hooks/users"
import { useSuspenseWorkspaces } from "@/lib/api/hooks/workspaces"

interface CSVEmailData {
  fromEmail: string
  toEmail: string
  subject: string
  bodyText?: string
  bodyHtml?: string
  fromName?: string
}

interface BulkSendResult {
  toEmail: string
  subject: string
  success: boolean
  error?: string
  emailId?: string
}

export default function BulkEmailCSVPage() {
  // Generate unique IDs for form elements
  const sendWorkspaceId = useId()
  const sendUserId = useId()
  const fromNameId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 워크스페이스 및 사용자 선택
  const [selectedSendWorkspace, setSelectedSendWorkspace] = useState("")
  const [selectedSendUser, setSelectedSendUser] = useState("")

  // 발신자 이름 (공통)
  const [fromName, setFromName] = useState("")

  // CSV 파일 및 파싱된 데이터
  const [csvFile, setCSVFile] = useState<File | null>(null)
  const [emailsData, setEmailsData] = useState<CSVEmailData[]>([])
  const [isSending, setIsSending] = useState(false)
  const [sendResults, setSendResults] = useState<BulkSendResult[]>([])

  // 진행 상태 관리
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 })
  const [currentSendingEmail, setCurrentSendingEmail] = useState<string>("")

  // API hooks
  const {
    data: { workspaces },
  } = useSuspenseWorkspaces({ limit: 100 })
  const { data: usersData } = useUsers({ limit: 100 })

  // 워크스페이스와 유저가 선택되면 이메일 계정 정보 조회
  const {
    data: emailAccountInfo,
    isLoading: isLoadingEmailAccount,
    error: emailAccountError,
  } = useEmailAccountByWorkspaceAndUser(selectedSendWorkspace, selectedSendUser)

  // 워크스페이스를 첫 번째 항목으로 자동 선택
  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !selectedSendWorkspace) {
      setSelectedSendWorkspace(workspaces[0].id)
    }
  }, [workspaces, selectedSendWorkspace])

  // 유저를 첫 번째 항목으로 자동 선택
  useEffect(() => {
    if (usersData?.users && usersData.users.length > 0 && !selectedSendUser) {
      setSelectedSendUser(usersData.users[0].id)
    }
  }, [usersData, selectedSendUser])

  // CSV 파일 선택 핸들러
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".csv")) {
      toast.error("CSV 파일만 업로드 가능합니다")
      return
    }

    setCSVFile(file)
    setSendResults([])

    // CSV 파일 파싱
    try {
      let text = await file.text()

      // BOM (Byte Order Mark) 제거
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.substring(1)
      }

      const lines = text.split("\n").map((line) => line.trim())

      // 첫 번째 줄은 헤더로 가정
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

      // 헤더에서 컬럼 인덱스 찾기
      const fromEmailIdx = headers.findIndex(
        (h) => h === "발신인" || h === "fromemail" || h === "from",
      )
      const toEmailIdx = headers.findIndex((h) => h === "수신인" || h === "toemail" || h === "to")
      const subjectIdx = headers.findIndex((h) => h === "제목" || h === "subject")
      const bodyTextIdx = headers.findIndex(
        (h) =>
          h === "이메일 내용" ||
          h === "내용" ||
          h === "bodytext" ||
          h === "body" ||
          h === "content",
      )
      const bodyHtmlIdx = headers.findIndex(
        (h) => h === "html내용" || h === "bodyhtml" || h === "html",
      )

      if (toEmailIdx === -1 || subjectIdx === -1) {
        toast.error("필수 컬럼이 없습니다. 수신인(to), 제목(subject)은 필수입니다.")
        return
      }

      const parsedEmails: CSVEmailData[] = []

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue

        const values = lines[i].split(",").map((v) => v.trim())

        const emailData: CSVEmailData = {
          fromEmail: fromEmailIdx !== -1 ? values[fromEmailIdx] || "" : "",
          toEmail: values[toEmailIdx] || "",
          subject: values[subjectIdx] || "",
          bodyText: bodyTextIdx !== -1 ? values[bodyTextIdx] : undefined,
          bodyHtml: bodyHtmlIdx !== -1 ? values[bodyHtmlIdx] : undefined,
        }

        // 수신인과 제목은 필수
        if (emailData.toEmail && emailData.subject) {
          parsedEmails.push(emailData)
        }
      }

      if (parsedEmails.length === 0) {
        toast.error("유효한 이메일 데이터가 없습니다")
        return
      }

      setEmailsData(parsedEmails)
      toast.success(`${parsedEmails.length}개의 이메일 데이터를 불러왔습니다`)
    } catch (error) {
      console.error("Failed to parse CSV:", error)
      toast.error("CSV 파일 파싱에 실패했습니다")
    }
  }

  // 대량 메일 발송 핸들러 (2초 간격으로 순차 발송)
  const handleBulkSend = async () => {
    if (!selectedSendWorkspace || !selectedSendUser) {
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

    const results: BulkSendResult[] = []

    try {
      // 각 이메일을 2초 간격으로 순차 발송
      for (let i = 0; i < emailsData.length; i++) {
        const email = emailsData[i]
        const fromEmailValue = email.fromEmail?.trim() || emailAccountInfo.emailAddress

        // 현재 발송 중인 이메일 정보 업데이트
        setCurrentSendingEmail(email.toEmail)
        setSendingProgress({ current: i + 1, total: emailsData.length })

        try {
          // 단일 이메일 발송 API 호출
          const response = await fetch("http://localhost:3001/api/v1/bulk-emails/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
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
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            const errorMessage = errorData?.message || `API 호출 실패 (${response.status})`
            results.push({
              toEmail: email.toEmail,
              subject: email.subject,
              success: false,
              error: errorMessage,
            })
          } else {
            const result = await response.json()
            if (result.success && result.data && result.data.results[0]) {
              results.push(result.data.results[0])
            } else {
              results.push({
                toEmail: email.toEmail,
                subject: email.subject,
                success: false,
                error: "발송 결과를 확인할 수 없습니다",
              })
            }
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
    <div className="container mx-auto py-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3">
        <FileUp className="h-8 w-8 text-violet-600" />
        <div>
          <h1 className="text-3xl font-bold">CSV 대량 메일 발송</h1>
          <p className="text-muted-foreground">
            CSV 파일을 업로드하여 여러 수신자에게 이메일을 한 번에 발송합니다
          </p>
        </div>
      </div>

      {/* 발송 설정 - 워크스페이스 및 사용자 선택 */}
      <Card>
        <CardHeader>
          <CardTitle>발송 설정</CardTitle>
          <CardDescription>
            선택한 워크스페이스와 사용자에 따라 발송 이메일 계정이 자동으로 설정됩니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={sendWorkspaceId}>워크스페이스 *</Label>
              <Select value={selectedSendWorkspace} onValueChange={setSelectedSendWorkspace}>
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
              <Select value={selectedSendUser} onValueChange={setSelectedSendUser}>
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
            <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
              이메일 계정 정보를 불러오는 중...
            </div>
          )}

          {/* 이메일 계정 정보 표시 */}
          {emailAccountInfo && !isLoadingEmailAccount && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full">
                  <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-green-900 dark:text-green-100">
                    발신 이메일 계정 설정됨
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">
                    이 계정으로 모든 이메일이 발송됩니다
                  </div>
                </div>
              </div>
              <div className="space-y-2 pl-10">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-700 dark:text-green-300 font-medium">이메일:</span>
                  <span className="font-mono text-green-900 dark:text-green-100">
                    {emailAccountInfo.emailAddress}
                  </span>
                </div>
                {emailAccountInfo.displayName && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-700 dark:text-green-300 font-medium">
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
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 bg-destructive/20 rounded-full">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="font-semibold">이메일 계정을 찾을 수 없습니다</div>
                </div>
                <p className="text-sm pl-10">
                  선택한 워크스페이스와 사용자에 대한 활성화된 이메일 계정이 없습니다. 이메일 계정
                  페이지에서 먼저 등록해주세요.
                </p>
              </div>
            )}

          <div className="space-y-2">
            <Label htmlFor={fromNameId}>발신자 이름 (선택)</Label>
            <Input
              id={fromNameId}
              placeholder="발신자 이름"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              disabled={!emailAccountInfo}
            />
            <p className="text-xs text-muted-foreground">
              비어있으면 이메일 계정의 표시 이름({emailAccountInfo?.displayName || "미설정"})이
              사용됩니다
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CSV 파일 업로드 */}
      <Card>
        <CardHeader>
          <CardTitle>CSV 파일 업로드</CardTitle>
          <CardDescription>
            발신인, 수신인, 제목, 이메일 내용 순서로 구성된 CSV 파일을 업로드하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>CSV 파일 형식</Label>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                템플릿 다운로드
              </Button>
            </div>
            <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
              <p className="font-medium">CSV 열 구성 (순서대로):</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
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
              <p className="text-xs text-muted-foreground mt-3">
                ※ 템플릿 다운로드 버튼을 클릭하면 예시 데이터가 포함된 CSV 파일을 받을 수 있습니다
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>파일 선택</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="flex-1"
              />
              <Button variant="outline" onClick={handleClear}>
                <Trash2 className="mr-2 h-4 w-4" />
                초기화
              </Button>
            </div>
          </div>

          {csvFile && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    {csvFile.name}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
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
            <CardTitle>업로드된 데이터 미리보기</CardTitle>
            <CardDescription>{emailsData.length}개의 이메일이 발송됩니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
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
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {email.fromEmail?.trim() || emailAccountInfo?.emailAddress || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{email.toEmail}</TableCell>
                      <TableCell className="text-sm">{email.subject}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {email.bodyText
                          ? `${email.bodyText.substring(0, 50)}...`
                          : email.bodyHtml
                            ? "HTML 내용"
                            : "없음"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {emailsData.length > 10 && (
              <p className="text-sm text-muted-foreground mt-2">
                처음 10개만 표시됩니다. 총 {emailsData.length}개의 이메일
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 발송 버튼 */}
      {emailsData.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={handleBulkSend}
              disabled={isSending || !emailAccountInfo}
              className="w-full"
              size="lg"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  발송 중... ({sendingProgress.current}/{sendingProgress.total})
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  {emailsData.length}개 이메일 발송
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 진행률 표시 */}
      {isSending && (
        <Card>
          <CardHeader>
            <CardTitle>발송 진행 중</CardTitle>
            <CardDescription>
              {sendingProgress.current} / {sendingProgress.total} 완료 (
              {Math.round((sendingProgress.current / sendingProgress.total) * 100)}%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress
              value={(sendingProgress.current / sendingProgress.total) * 100}
              className="h-3"
            />
            {currentSendingEmail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  현재 발송 중: <span className="font-mono">{currentSendingEmail}</span>
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              각 이메일은 2초 간격으로 발송됩니다. 브라우저를 닫지 마세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 발송 결과 */}
      {sendResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>발송 결과</CardTitle>
            <CardDescription>
              성공: {sendResults.filter((r) => r.success).length}건, 실패:{" "}
              {sendResults.filter((r) => !r.success).length}건
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
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
                              <div className="font-mono text-xs text-muted-foreground">
                                From: {emailData.fromEmail.trim()}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{result.subject}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
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
    </div>
  )
}
