import {
  Building2,
  Calendar,
  Mail,
  Send,
  TestTube,
  Trash2,
  User,
  UserCheck,
  Users,
} from "lucide-react"
import { useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCustomerGroupsByWorkspace } from "@/lib/api/hooks/customer-groups"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useSendEmail } from "@/lib/api/hooks/emails"
import { useUsers } from "@/lib/api/hooks/users"
import { useSuspenseWorkspaces } from "@/lib/api/hooks/workspaces"
import type { SendEmailRequest } from "@/lib/api/types/email"

export default function EmailSendTestPage() {
  // Generate unique IDs for form elements
  const fromNameId = useId()
  const singleRecipientId = useId()
  const singleSubjectId = useId()
  const singleCcId = useId()
  const singleBccId = useId()
  const singleBodyTextId = useId()
  const singleBodyHtmlId = useId()
  const bulkRecipientsId = useId()
  const bulkSubjectId = useId()
  const bulkBodyTextId = useId()
  const bulkBodyHtmlId = useId()
  const scheduleRecipientsId = useId()
  const scheduleDateTimeId = useId()
  const sendWorkspaceId = useId()
  const sendUserId = useId()
  const scheduleSubjectId = useId()
  const scheduleBodyTextId = useId()
  const scheduleBodyHtmlId = useId()
  const groupWorkspaceId = useId()
  const groupCustomerGroupId = useId()
  const groupSubjectId = useId()
  const groupBodyTextId = useId()
  const groupBodyHtmlId = useId()

  // 워크스페이스 및 사용자 선택 (자동 선택)
  const [selectedSendWorkspace, setSelectedSendWorkspace] = useState("")
  const [selectedSendUser, setSelectedSendUser] = useState("")

  // 발신자 이름 (공통)
  const [fromName, setFromName] = useState("")

  // 단일 발송 상태
  const [singleRecipient, setSingleRecipient] = useState("")
  const [singleSubject, setSingleSubject] = useState("")
  const [singleBodyText, setSingleBodyText] = useState("")
  const [singleBodyHtml, setSingleBodyHtml] = useState("")
  const [singleCc, setSingleCc] = useState("")
  const [singleBcc, setSingleBcc] = useState("")

  // 대량 발송 상태
  const [bulkRecipients, setBulkRecipients] = useState("")
  const [bulkSubject, setBulkSubject] = useState("")
  const [bulkBodyText, setBulkBodyText] = useState("")
  const [bulkBodyHtml, setBulkBodyHtml] = useState("")

  // 스케줄 대량 발송 상태
  const [scheduleRecipients, setScheduleRecipients] = useState("")
  const [scheduleSubject, setScheduleSubject] = useState("")
  const [scheduleBodyText, setScheduleBodyText] = useState("")
  const [scheduleBodyHtml, setScheduleBodyHtml] = useState("")
  const [scheduleDateTime, setScheduleDateTime] = useState("")

  // 고객 그룹 발송 상태
  const [selectedWorkspace, setSelectedWorkspace] = useState("")
  const [selectedCustomerGroup, setSelectedCustomerGroup] = useState("")
  const [groupSubject, setGroupSubject] = useState("")
  const [groupBodyText, setGroupBodyText] = useState("")
  const [groupBodyHtml, setGroupBodyHtml] = useState("")
  const [groupMembers, setGroupMembers] = useState<
    Array<{ id: string; name: string; email: string }>
  >([])
  const [isLoadingGroupMembers, setIsLoadingGroupMembers] = useState(false)

  // API hooks
  const {
    data: { workspaces },
  } = useSuspenseWorkspaces({ limit: 100 })
  const { data: usersData } = useUsers({ limit: 100 })
  const { data: customerGroups } = useCustomerGroupsByWorkspace(
    selectedWorkspace,
    !!selectedWorkspace,
  )
  const sendEmailMutation = useSendEmail()

  // 워크스페이스와 유저가 선택되면 이메일 계정 정보 조회 (TanStack Query)
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

  // 고객 그룹 멤버 가져오기
  const fetchGroupMembers = async (groupId: string) => {
    setIsLoadingGroupMembers(true)
    try {
      console.log("Fetching group members for groupId:", groupId)
      const response = await fetch(
        `http://localhost:3001/api/v1/customer-groups/${groupId}/members-with-emails`,
      )

      console.log("Response status:", response.status)
      console.log("Response ok:", response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API Error Response:", errorText)
        throw new Error(`API Error (${response.status}): ${errorText}`)
      }

      const responseText = await response.text()
      console.log("Raw response text:", responseText)

      let result: {
        success?: boolean
        data?: Array<{ id: string; name: string; email: string }>
        message?: string
      }
      try {
        result = JSON.parse(responseText)
        console.log("Parsed API Response:", result)
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError)
        console.error("Response was not JSON:", responseText)
        throw new Error(`Response is not valid JSON: ${responseText.substring(0, 100)}...`)
      }

      // API 응답에서 data 필드 추출
      if (result.success && result.data) {
        console.log("Setting group members:", result.data)
        setGroupMembers(result.data)
      } else {
        throw new Error(result.message || "고객 그룹 멤버를 가져오는데 실패했습니다")
      }
    } catch (error: unknown) {
      console.error("Failed to fetch group members:", error)
      toast.error(
        `고객 그룹 멤버를 가져오는데 실패했습니다: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`,
      )
      setGroupMembers([])
    } finally {
      setIsLoadingGroupMembers(false)
    }
  }

  // 워크스페이스 변경 시 고객 그룹 초기화
  const handleWorkspaceChange = (workspaceId: string) => {
    setSelectedWorkspace(workspaceId)
    setSelectedCustomerGroup("")
    setGroupMembers([])
  }

  // 고객 그룹 변경 시 멤버 가져오기
  const handleCustomerGroupChange = (groupId: string) => {
    setSelectedCustomerGroup(groupId)
    if (groupId) {
      fetchGroupMembers(groupId)
    } else {
      setGroupMembers([])
    }
  }

  const handleSingleSend = async () => {
    if (!selectedSendWorkspace || !selectedSendUser) {
      toast.error("워크스페이스와 사용자를 선택해주세요")
      return
    }

    if (!singleRecipient || !singleSubject) {
      toast.error("필수 항목을 모두 입력해주세요 (수신자, 제목)")
      return
    }

    const emailData: SendEmailRequest = {
      workspaceId: selectedSendWorkspace,
      userId: selectedSendUser,
      toEmail: singleRecipient,
      subject: singleSubject,
      bodyText: singleBodyText || undefined,
      bodyHtml: singleBodyHtml || undefined,
      ccEmails: singleCc ? singleCc.split(",").map((e) => e.trim()) : undefined,
      bccEmails: singleBcc ? singleBcc.split(",").map((e) => e.trim()) : undefined,
      fromName: fromName || undefined,
      includeSignature: true, // 서명 포함
    }

    try {
      await sendEmailMutation.mutateAsync(emailData)
      // 성공 시 폼 초기화
      setSingleRecipient("")
      setSingleSubject("")
      setSingleBodyText("")
      setSingleBodyHtml("")
      setSingleCc("")
      setSingleBcc("")
    } catch (error) {
      // 에러는 mutation에서 처리됨
      console.error("Failed to send email:", error)
    }
  }

  const handleBulkSend = async () => {
    if (!selectedSendWorkspace || !selectedSendUser) {
      toast.error("워크스페이스와 사용자를 선택해주세요")
      return
    }

    if (!bulkRecipients || !bulkSubject) {
      toast.error("필수 항목을 모두 입력해주세요 (수신자 목록, 제목)")
      return
    }

    const recipients = bulkRecipients
      .split("\n")
      .map((email) => email.trim())
      .filter((email) => email.length > 0)

    if (recipients.length === 0) {
      toast.error("최소 하나 이상의 이메일 주소를 입력해주세요")
      return
    }

    let successCount = 0
    let failCount = 0

    for (const recipient of recipients) {
      const emailData: SendEmailRequest = {
        workspaceId: selectedSendWorkspace,
        userId: selectedSendUser,
        toEmail: recipient,
        subject: bulkSubject,
        bodyText: bulkBodyText || undefined,
        bodyHtml: bulkBodyHtml || undefined,
        fromName: fromName || undefined,
        includeSignature: true, // 서명 포함
      }

      try {
        await sendEmailMutation.mutateAsync(emailData)
        successCount++
      } catch (error) {
        failCount++
        console.error(`Failed to send email to ${recipient}:`, error)
      }
    }

    toast.success(
      `대량 발송 완료: 성공 ${successCount}건, 실패 ${failCount}건 (총 ${recipients.length}건)`,
    )

    // 성공 시 폼 초기화
    if (successCount > 0) {
      setBulkRecipients("")
      setBulkSubject("")
      setBulkBodyText("")
      setBulkBodyHtml("")
    }
  }

  const clearSingleForm = () => {
    setSingleRecipient("")
    setSingleSubject("")
    setSingleBodyText("")
    setSingleBodyHtml("")
    setSingleCc("")
    setSingleBcc("")
  }

  const clearBulkForm = () => {
    setBulkRecipients("")
    setBulkSubject("")
    setBulkBodyText("")
    setBulkBodyHtml("")
  }

  const handleScheduleSend = async () => {
    if (!selectedSendWorkspace || !selectedSendUser) {
      toast.error("워크스페이스와 사용자를 선택해주세요")
      return
    }

    if (!scheduleRecipients || !scheduleSubject || !scheduleDateTime) {
      toast.error("필수 항목을 모두 입력해주세요 (수신자 목록, 제목, 예약 시간)")
      return
    }

    const recipients = scheduleRecipients
      .split("\n")
      .map((email) => email.trim())
      .filter((email) => email.length > 0)

    if (recipients.length === 0) {
      toast.error("최소 하나 이상의 이메일 주소를 입력해주세요")
      return
    }

    // 예약 시간이 현재 시간보다 이후인지 확인 (한국 시간 기준)
    // datetime-local은 로컬 시간대를 반환하므로, 한국 시간으로 간주하고 UTC로 변환
    const scheduledDate = new Date(scheduleDateTime)
    const now = new Date()

    if (scheduledDate <= now) {
      toast.error("예약 시간은 현재 시간보다 이후여야 합니다")
      return
    }

    // 한국 시간으로 표시 (KST = UTC+9)
    const kstOffset = 9 * 60 * 60 * 1000
    const scheduledKST = new Date(scheduledDate.getTime() + kstOffset)
    const scheduledKSTString = scheduledKST.toISOString().slice(0, 19).replace("T", " ")

    let successCount = 0
    let failCount = 0

    for (const recipient of recipients) {
      // 예약 시간 정보를 본문에 추가
      const bodyTextWithSchedule = `${scheduleBodyText || ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 스케줄 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ 예약 시간 (KST): ${scheduledKSTString}
📧 수신자: ${recipient}

※ 실제 발송 시간은 예약 시간 이후 30초 이내입니다.
   (Worker 주기: 30초)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

      const bodyHtmlWithSchedule = scheduleBodyHtml
        ? `${scheduleBodyHtml}
<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">
<div style="background: #f9fafb; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 13px;">
  <h3 style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">📅 스케줄 정보</h3>
  <p style="margin: 5px 0;"><strong>⏰ 예약 시간 (KST):</strong> ${scheduledKSTString}</p>
  <p style="margin: 5px 0;"><strong>📧 수신자:</strong> ${recipient}</p>
  <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">
    ※ 실제 발송 시간은 예약 시간 이후 30초 이내입니다. (Worker 주기: 30초)
  </p>
</div>`
        : undefined

      const emailData: SendEmailRequest = {
        workspaceId: selectedSendWorkspace,
        userId: selectedSendUser,
        toEmail: recipient,
        subject: scheduleSubject,
        bodyText: bodyTextWithSchedule,
        bodyHtml: bodyHtmlWithSchedule,
        fromName: fromName || undefined,
        scheduledAt: scheduledDate.toISOString(),
        includeSignature: true, // 서명 포함
      }

      try {
        await sendEmailMutation.mutateAsync(emailData)
        successCount++
      } catch (error) {
        failCount++
        console.error(`Failed to schedule email to ${recipient}:`, error)
      }
    }

    toast.success(
      `스케줄 발송 예약 완료: 성공 ${successCount}건, 실패 ${failCount}건 (총 ${recipients.length}건)`,
    )

    // 성공 시 폼 초기화
    if (successCount > 0) {
      setScheduleRecipients("")
      setScheduleSubject("")
      setScheduleBodyText("")
      setScheduleBodyHtml("")
      setScheduleDateTime("")
    }
  }

  // 30초 후 테스트 발송 (3명)
  const handleQuickTest = async () => {
    if (!selectedSendWorkspace || !selectedSendUser) {
      toast.error("워크스페이스와 사용자를 선택해주세요")
      return
    }

    const testRecipients = ["wks0968@gmail.com", "admin@grinda.ai", "grindaai1@gmail.com"]

    // 30초 후 시간 계산
    const scheduledDate = new Date(Date.now() + 30 * 1000)
    const kstOffset = 9 * 60 * 60 * 1000
    const scheduledKST = new Date(scheduledDate.getTime() + kstOffset)
    const scheduledKSTString = scheduledKST.toISOString().slice(0, 19).replace("T", " ")

    let successCount = 0
    let failCount = 0

    toast.loading("30초 후 발송 테스트 예약 중...", { id: "quick-test" })

    for (const recipient of testRecipients) {
      const bodyText = `스케줄 이메일 발송 시스템 테스트

안녕하세요,

이 이메일은 스케줄 발송 시스템의 자동 테스트 이메일입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 스케줄 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ 예약 시간 (KST): ${scheduledKSTString}
📧 수신자: ${recipient}

※ 실제 발송 시간은 예약 시간 이후 30초 이내입니다.
   (Worker 주기: 30초)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

감사합니다.
`

      const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1f2937;">스케줄 이메일 발송 시스템 테스트</h2>
  <p>안녕하세요,</p>
  <p>이 이메일은 스케줄 발송 시스템의 자동 테스트 이메일입니다.</p>

  <hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

  <div style="background: #f9fafb; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 13px;">
    <h3 style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">📅 스케줄 정보</h3>
    <p style="margin: 5px 0;"><strong>⏰ 예약 시간 (KST):</strong> ${scheduledKSTString}</p>
    <p style="margin: 5px 0;"><strong>📧 수신자:</strong> ${recipient}</p>
    <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">
      ※ 실제 발송 시간은 예약 시간 이후 30초 이내입니다. (Worker 주기: 30초)
    </p>
  </div>

  <p style="margin-top: 20px;">감사합니다.</p>
</div>
`

      const emailData: SendEmailRequest = {
        workspaceId: selectedSendWorkspace,
        userId: selectedSendUser,
        toEmail: recipient,
        subject: `스케줄 테스트 (${scheduledKSTString} KST 발송 예정)`,
        bodyText,
        bodyHtml,
        fromName: fromName || undefined,
        scheduledAt: scheduledDate.toISOString(),
      }

      try {
        await sendEmailMutation.mutateAsync(emailData)
        successCount++
      } catch (error) {
        failCount++
        console.error(`Failed to schedule test email to ${recipient}:`, error)
      }
    }

    toast.success(`30초 후 테스트 발송 예약 완료!\n성공: ${successCount}건, 실패: ${failCount}건`, {
      id: "quick-test",
      duration: 5000,
    })
  }

  const clearScheduleForm = () => {
    setScheduleRecipients("")
    setScheduleSubject("")
    setScheduleBodyText("")
    setScheduleBodyHtml("")
    setScheduleDateTime("")
  }

  const handleGroupSend = async () => {
    if (!selectedSendWorkspace || !selectedSendUser) {
      toast.error("워크스페이스와 사용자를 선택해주세요")
      return
    }

    if (!selectedWorkspace || !selectedCustomerGroup || !groupSubject) {
      toast.error("필수 항목을 모두 입력해주세요 (워크스페이스, 고객 그룹, 제목)")
      return
    }

    if (groupMembers.length === 0) {
      toast.error("선택한 고객 그룹에 이메일 주소가 있는 멤버가 없습니다")
      return
    }

    // 이메일 주소가 있는 멤버만 필터링
    const membersWithEmail = groupMembers.filter((member) => member.email)
    if (membersWithEmail.length === 0) {
      toast.error("선택한 고객 그룹에 유효한 이메일 주소가 있는 멤버가 없습니다")
      return
    }

    let successCount = 0
    let failCount = 0

    for (const member of membersWithEmail) {
      const emailData: SendEmailRequest = {
        workspaceId: selectedSendWorkspace,
        userId: selectedSendUser,
        toEmail: member.email,
        subject: groupSubject,
        bodyText: groupBodyText || undefined,
        bodyHtml: groupBodyHtml || undefined,
        fromName: fromName || undefined,
      }

      try {
        await sendEmailMutation.mutateAsync(emailData)
        successCount++
      } catch (error) {
        failCount++
        console.error(`Failed to send email to ${member.email}:`, error)
      }
    }

    toast.success(
      `고객 그룹 발송 완료: 성공 ${successCount}건, 실패 ${failCount}건 (총 ${membersWithEmail.length}건)`,
    )

    // 성공 시 폼 초기화
    if (successCount > 0) {
      setGroupSubject("")
      setGroupBodyText("")
      setGroupBodyHtml("")
    }
  }

  const clearGroupForm = () => {
    setSelectedWorkspace("")
    setSelectedCustomerGroup("")
    setGroupSubject("")
    setGroupBodyText("")
    setGroupBodyHtml("")
    setGroupMembers([])
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
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
              <p className="text-xs text-muted-foreground">
                이 워크스페이스의 이메일 계정으로 발송됩니다
              </p>
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
              <p className="text-xs text-muted-foreground">
                이 사용자에게 등록된 이메일 계정으로 발송됩니다
              </p>
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
                  선택한 워크스페이스(
                  <strong>{workspaces.find((w) => w.id === selectedSendWorkspace)?.name}</strong>
                  )와 사용자(
                  <strong>
                    {usersData?.users?.find((u) => u.id === selectedSendUser)?.username}
                  </strong>
                  )에 대한 활성화된 이메일 계정이 없습니다.
                  <br />
                  이메일 계정 페이지에서 먼저 등록해주세요.
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
              비어있으면 이메일 계정의 표시 이름(
              {emailAccountInfo?.displayName || "미설정"})이 사용됩니다
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 주석처리된 워크스페이스 및 이메일 계정 선택
      <Card>
        <CardHeader>
          <CardTitle>발송 설정</CardTitle>
          <CardDescription>이메일을 발송할 워크스페이스와 계정을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor={workspaceId}>워크스페이스 *</Label>
              <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                <SelectTrigger id={workspaceId}>
                  <SelectValue placeholder="워크스페이스 선택" />
                </SelectTrigger>
                <SelectContent>
                  {workspacesData?.workspaces?.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={emailAccountId}>이메일 계정 *</Label>
              <Select
                value={selectedEmailAccount}
                onValueChange={setSelectedEmailAccount}
                disabled={!selectedWorkspace}
              >
                <SelectTrigger id={emailAccountId}>
                  <SelectValue placeholder="이메일 계정 선택" />
                </SelectTrigger>
                <SelectContent>
                  {emailAccounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.emailAddress} ({account.displayName || "이름 없음"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fromName">발신자 이름</Label>
              <Input
                id="fromName"
                placeholder="Rinda Expert 팀"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                수신자에게 표시될 발신자 이름입니다
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      */}

      {/* 탭으로 단일/대량/스케줄/그룹 발송 구분 */}
      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full max-w-4xl grid-cols-4">
          <TabsTrigger value="single">
            <Mail className="mr-2 h-4 w-4" />
            단일 발송
          </TabsTrigger>
          <TabsTrigger value="bulk">
            <Users className="mr-2 h-4 w-4" />
            대량 발송
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Calendar className="mr-2 h-4 w-4" />
            스케줄 대량 발송
          </TabsTrigger>
          <TabsTrigger value="group">
            <UserCheck className="mr-2 h-4 w-4" />
            고객 그룹 발송
          </TabsTrigger>
        </TabsList>

        {/* 단일 발송 */}
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>단일 이메일 발송</CardTitle>
              <CardDescription>한 명의 수신자에게 이메일을 발송합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={singleRecipientId}>수신자 (To) *</Label>
                <Input
                  id={singleRecipientId}
                  type="email"
                  placeholder="recipient@example.com"
                  value={singleRecipient}
                  onChange={(e) => setSingleRecipient(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={singleSubjectId}>제목 *</Label>
                <Input
                  id={singleSubjectId}
                  placeholder="이메일 제목"
                  value={singleSubject}
                  onChange={(e) => setSingleSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={singleCcId}>참조 (CC)</Label>
                <Input
                  id={singleCcId}
                  placeholder="여러 주소는 쉼표(,)로 구분"
                  value={singleCc}
                  onChange={(e) => setSingleCc(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={singleBccId}>숨은 참조 (BCC)</Label>
                <Input
                  id={singleBccId}
                  placeholder="여러 주소는 쉼표(,)로 구분"
                  value={singleBcc}
                  onChange={(e) => setSingleBcc(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={singleBodyTextId}>본문 (텍스트)</Label>
                <RichTextEditor
                  value={singleBodyText}
                  onChange={setSingleBodyText}
                  placeholder="텍스트 형식의 이메일 본문"
                  height="150px"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={singleBodyHtmlId}>본문 (HTML)</Label>
                <RichTextEditor
                  value={singleBodyHtml}
                  onChange={setSingleBodyHtml}
                  placeholder="<p>HTML 형식의 이메일 본문</p>"
                  height="150px"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSingleSend}
                  disabled={!singleRecipient || !singleSubject || sendEmailMutation.isPending}
                  className="flex-1"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendEmailMutation.isPending ? "발송 중..." : "이메일 발송"}
                </Button>
                <Button variant="outline" onClick={clearSingleForm}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  초기화
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 대량 발송 */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>대량 이메일 발송</CardTitle>
              <CardDescription>여러 수신자에게 동일한 내용의 이메일을 발송합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={bulkRecipientsId}>수신자 목록 (줄바꿈으로 구분) *</Label>
                <RichTextEditor
                  value={bulkRecipients}
                  onChange={setBulkRecipients}
                  placeholder="recipient1@example.com&#10;recipient2@example.com&#10;recipient3@example.com"
                  height="200px"
                />
                <p className="text-sm text-muted-foreground">
                  총 {bulkRecipients.split("\n").filter((e) => e.trim()).length}
                  개의 이메일 주소
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={bulkSubjectId}>제목 *</Label>
                <Input
                  id={bulkSubjectId}
                  placeholder="이메일 제목"
                  value={bulkSubject}
                  onChange={(e) => setBulkSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={bulkBodyTextId}>본문 (텍스트)</Label>
                <RichTextEditor
                  value={bulkBodyText}
                  onChange={setBulkBodyText}
                  placeholder="텍스트 형식의 이메일 본문"
                  height="150px"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={bulkBodyHtmlId}>본문 (HTML)</Label>
                <RichTextEditor
                  value={bulkBodyHtml}
                  onChange={setBulkBodyHtml}
                  placeholder="<p>HTML 형식의 이메일 본문</p>"
                  height="150px"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleBulkSend}
                  disabled={!bulkRecipients || !bulkSubject || sendEmailMutation.isPending}
                  className="flex-1"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendEmailMutation.isPending ? "발송 중..." : "대량 발송"}
                </Button>
                <Button variant="outline" onClick={clearBulkForm}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  초기화
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 스케줄 대량 발송 */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>스케줄 대량 이메일 발송</CardTitle>
              <CardDescription>
                여러 수신자에게 특정 시간에 동일한 내용의 이메일을 발송합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={scheduleRecipientsId}>수신자 목록 (줄바꿈으로 구분) *</Label>
                <RichTextEditor
                  value={scheduleRecipients}
                  onChange={setScheduleRecipients}
                  placeholder="recipient1@example.com&#10;recipient2@example.com&#10;recipient3@example.com"
                  height="200px"
                />
                <p className="text-sm text-muted-foreground">
                  총 {scheduleRecipients.split("\n").filter((e) => e.trim()).length}
                  개의 이메일 주소
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={scheduleDateTimeId}>예약 시간 *</Label>
                <Input
                  id={scheduleDateTimeId}
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  예약된 시간에 모든 수신자에게 이메일이 발송됩니다 (한국 시간 기준)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={scheduleSubjectId}>제목 *</Label>
                <Input
                  id={scheduleSubjectId}
                  placeholder="이메일 제목"
                  value={scheduleSubject}
                  onChange={(e) => setScheduleSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={scheduleBodyTextId}>본문 (텍스트)</Label>
                <RichTextEditor
                  value={scheduleBodyText}
                  onChange={setScheduleBodyText}
                  placeholder="텍스트 형식의 이메일 본문"
                  height="150px"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={scheduleBodyHtmlId}>본문 (HTML)</Label>
                <RichTextEditor
                  value={scheduleBodyHtml}
                  onChange={setScheduleBodyHtml}
                  placeholder="<p>HTML 형식의 이메일 본문</p>"
                  height="150px"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleScheduleSend}
                  disabled={
                    !scheduleRecipients ||
                    !scheduleSubject ||
                    !scheduleDateTime ||
                    sendEmailMutation.isPending
                  }
                  className="flex-1"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {sendEmailMutation.isPending ? "예약 중..." : "스케줄 발송 예약"}
                </Button>
                <Button variant="outline" onClick={clearScheduleForm}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  초기화
                </Button>
              </div>

              {/* Quick Test Button */}
              <div className="mt-6 pt-6 border-t">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">🧪 빠른 테스트</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      3명의 테스트 수신자에게 30초 후 발송 예약을 빠르게 테스트할 수 있습니다
                    </p>
                  </div>
                  <Button
                    onClick={handleQuickTest}
                    disabled={sendEmailMutation.isPending}
                    variant="secondary"
                    className="w-full"
                  >
                    <TestTube className="mr-2 h-4 w-4" />
                    30초 후 테스트 발송 (3명)
                  </Button>
                  <div className="bg-muted/50 rounded-md p-3 text-xs space-y-1">
                    <p className="font-medium">테스트 수신자:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      <li>wks0968@gmail.com</li>
                      <li>admin@grinda.ai</li>
                      <li>grindaai1@gmail.com</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 고객 그룹 발송 */}
        <TabsContent value="group">
          <Card>
            <CardHeader>
              <CardTitle>고객 그룹 이메일 발송</CardTitle>
              <CardDescription>
                워크스페이스의 고객 그룹을 선택하여 해당 그룹의 모든 멤버에게 이메일을 발송합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={groupWorkspaceId}>워크스페이스 *</Label>
                  <Select value={selectedWorkspace} onValueChange={handleWorkspaceChange}>
                    <SelectTrigger id={groupWorkspaceId}>
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
                  <Label htmlFor={groupCustomerGroupId}>고객 그룹 *</Label>
                  <Select
                    value={selectedCustomerGroup}
                    onValueChange={handleCustomerGroupChange}
                    disabled={!selectedWorkspace}
                  >
                    <SelectTrigger id={groupCustomerGroupId}>
                      <SelectValue placeholder="고객 그룹 선택" />
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
                </div>
              </div>

              {/* 선택된 그룹 멤버 정보 */}
              {selectedCustomerGroup && (
                <div className="space-y-2">
                  <Label>그룹 멤버 정보</Label>
                  <div className="p-3 bg-muted rounded-md">
                    {isLoadingGroupMembers ? (
                      <div className="text-sm text-muted-foreground">
                        멤버 정보를 불러오는 중...
                      </div>
                    ) : groupMembers.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">총 {groupMembers.length}명의 멤버</Badge>
                          <Badge variant="outline">
                            이메일 주소 보유: {groupMembers.filter((m) => m.email).length}명
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          이메일 주소가 있는 멤버들에게만 이메일이 발송됩니다
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        이 그룹에는 멤버가 없습니다
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor={groupSubjectId}>제목 *</Label>
                <Input
                  id={groupSubjectId}
                  placeholder="이메일 제목"
                  value={groupSubject}
                  onChange={(e) => setGroupSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={groupBodyTextId}>본문 (텍스트)</Label>
                <RichTextEditor
                  value={groupBodyText}
                  onChange={setGroupBodyText}
                  placeholder="텍스트 형식의 이메일 본문"
                  height="150px"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={groupBodyHtmlId}>본문 (HTML)</Label>
                <RichTextEditor
                  value={groupBodyHtml}
                  onChange={setGroupBodyHtml}
                  placeholder="<p>HTML 형식의 이메일 본문</p>"
                  height="150px"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleGroupSend}
                  disabled={
                    !selectedWorkspace ||
                    !selectedCustomerGroup ||
                    !groupSubject ||
                    groupMembers.length === 0 ||
                    sendEmailMutation.isPending
                  }
                  className="flex-1"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  {sendEmailMutation.isPending ? "발송 중..." : "그룹 발송"}
                </Button>
                <Button variant="outline" onClick={clearGroupForm}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  초기화
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
