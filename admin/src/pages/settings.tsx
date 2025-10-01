import { User } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCurrentUser, useUpdateProfileMutation } from "@/lib/api/hooks/auth"

export default function SettingsPage() {
  const nameId = useId()
  const emailId = useId()
  const employeeIdInput = useId()

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
      </div>
    </div>
  )
}
