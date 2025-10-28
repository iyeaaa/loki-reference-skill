import { Building2, FileUp, Settings as SettingsIcon, User, Users } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCurrentUser, useUpdateProfileMutation } from "@/lib/api/hooks/auth"



export default function SettingsPage() {
  const navigate = useNavigate()
  const nameId = useId()
  const emailId = useId()
  const employeeIdInput = useId()

  const systemManagementItems = [
    {
      title: "워크스페이스 관리",
      description: "워크스페이스를 생성하고 관리합니다",
      url: "/workspaces",
      icon: Building2,
    },
    {
      title: "유저 관리",
      description: "사용자 계정을 관리합니다",
      url: "/users",
      icon: Users,
    },
    {
      title: "리드 데이터 임포트",
      description: "CSV 파일로 리드 데이터를 일괄 등록합니다",
      url: "/lead-import",
      icon: FileUp,
    },
  ]

  const { data: currentUser, isLoading } = useCurrentUser()
  const updateProfileMutation = useUpdateProfileMutation()

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    employeeId: "",
  })

  // Load current user data
  useEffect(() => {
    if (currentUser) {
      setFormData({
        username: currentUser.username || "",
        email: currentUser.email || "",
        employeeId: currentUser.employeeId || "",
      })
    }
  }, [currentUser])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">설정 및 시스템 관리</h1>
        </div>
        <p className="text-muted-foreground">계정 정보와 시스템을 관리합니다</p>
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
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={nameId}>이름</Label>
                <Input
                  id={nameId}
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="홍길동"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={emailId}>이메일</Label>
                <Input
                  id={emailId}
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={employeeIdInput}>사원번호</Label>
                <Input
                  id={employeeIdInput}
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  placeholder="EMP001"
                  required
                />
              </div>
              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? "저장 중..." : "변경사항 저장"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 시스템 관리 */}
        <Card>
          <CardHeader>
            <CardTitle>시스템 관리</CardTitle>
            <CardDescription>워크스페이스, 사용자 및 데이터를 관리합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {systemManagementItems.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => navigate(item.url)}
                  className="flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:border-violet-500"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="rounded-lg bg-violet-100 dark:bg-violet-900/20 p-2">
                      <item.icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
