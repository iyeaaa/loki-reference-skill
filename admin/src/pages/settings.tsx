import { Bell, Mail, Palette, Shield, User } from "lucide-react"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
  const nameId = useId()
  const emailId = useId()
  const companyId = useId()
  const senderNameId = useId()
  const senderEmailId = useId()
  const replyToId = useId()
  const currentPasswordId = useId()
  const newPasswordId = useId()
  const confirmPasswordId = useId()
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">설정</h1>
        <p className="text-muted-foreground mt-2">시스템 및 계정 설정을 관리합니다</p>
      </div>

      <div className="space-y-6">
        {/* 프로필 설정 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>프로필 설정</CardTitle>
            </div>
            <CardDescription>계정 정보를 관리합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={nameId}>이름</Label>
              <Input id={nameId} placeholder="홍길동" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={emailId}>이메일</Label>
              <Input id={emailId} type="email" placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={companyId}>회사명</Label>
              <Input id={companyId} placeholder="회사명" />
            </div>
            <Button>변경사항 저장</Button>
          </CardContent>
        </Card>

        {/* 이메일 설정 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <CardTitle>이메일 설정</CardTitle>
            </div>
            <CardDescription>발송 이메일 계정 및 설정을 관리합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={senderNameId}>발신자 이름</Label>
              <Input id={senderNameId} placeholder="회사명 또는 담당자명" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={senderEmailId}>발신자 이메일</Label>
              <Input id={senderEmailId} type="email" placeholder="sender@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={replyToId}>회신 이메일</Label>
              <Input id={replyToId} type="email" placeholder="reply@company.com" />
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>이메일 트래킹</Label>
                  <p className="text-sm text-muted-foreground">오픈 및 클릭 추적 활성화</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>읽음 확인 요청</Label>
                  <p className="text-sm text-muted-foreground">이메일 읽음 확인 요청 포함</p>
                </div>
                <Switch />
              </div>
            </div>
            <Button>변경사항 저장</Button>
          </CardContent>
        </Card>

        {/* 알림 설정 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>알림 설정</CardTitle>
            </div>
            <CardDescription>시스템 알림 및 이메일 알림을 관리합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>바이어 응답 알림</Label>
                <p className="text-sm text-muted-foreground">
                  바이어로부터 회신이 오면 알림을 받습니다
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>발송 실패 알림</Label>
                <p className="text-sm text-muted-foreground">이메일 발송 실패 시 알림을 받습니다</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>일일 리포트</Label>
                <p className="text-sm text-muted-foreground">
                  매일 발송 및 응답 현황 요약을 받습니다
                </p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>주간 리포트</Label>
                <p className="text-sm text-muted-foreground">매주 월요일 성과 리포트를 받습니다</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Button>변경사항 저장</Button>
          </CardContent>
        </Card>

        {/* 보안 설정 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>보안 설정</CardTitle>
            </div>
            <CardDescription>계정 보안 및 접근 권한을 관리합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={currentPasswordId}>현재 비밀번호</Label>
              <Input id={currentPasswordId} type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={newPasswordId}>새 비밀번호</Label>
              <Input id={newPasswordId} type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={confirmPasswordId}>비밀번호 확인</Label>
              <Input id={confirmPasswordId} type="password" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>2단계 인증</Label>
                <p className="text-sm text-muted-foreground">
                  로그인 시 추가 인증 단계를 요구합니다
                </p>
              </div>
              <Switch />
            </div>
            <Button>비밀번호 변경</Button>
          </CardContent>
        </Card>

        {/* 테마 설정 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <CardTitle>테마 설정</CardTitle>
            </div>
            <CardDescription>화면 테마 및 표시 설정을 관리합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>다크 모드</Label>
                <p className="text-sm text-muted-foreground">다크 테마를 사용합니다</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>자동 테마 전환</Label>
                <p className="text-sm text-muted-foreground">
                  시스템 설정에 따라 자동으로 테마를 변경합니다
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Button>변경사항 저장</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
