import { useMutation } from "@tanstack/react-query"
import { Mail, Send } from "lucide-react"
import { useId, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api/client"

type SendOnboardingEmailParams = {
  email: string
  firstName?: string
  companyName?: string
  companyDescription?: string
  leadCount: number
  emailCount: number
  dashboardUrl: string
  language?: "en" | "ko"
  trialDaysRemaining?: number
  industry?: string
  topCompanies?: string[]
}

const INDUSTRY_OPTIONS = {
  beauty: "뷰티/화장품 (Beauty)",
  fashion: "패션/의류 (Fashion)",
  food: "식품/음료 (Food & Beverage)",
  it_saas: "IT/SaaS",
  manufacturing: "제조업 (Manufacturing)",
  retail: "소매업 (Retail)",
  healthcare: "헬스케어 (Healthcare)",
  education: "교육 (Education)",
  other: "기타 (Other)",
}

export function OnboardingEmailTest() {
  const emailId = useId()
  const firstNameId = useId()
  const companyNameId = useId()
  const companyDescId = useId()
  const leadCountId = useId()
  const emailCountId = useId()
  const dashboardUrlId = useId()
  const languageId = useId()
  const trialDaysId = useId()
  const industryId = useId()
  const topCompaniesId = useId()

  // Form state
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("철희")
  const [companyName, setCompanyName] = useState("주식회사 거목")
  const [companyDescription, setCompanyDescription] = useState("가공 기계 및 공장 설비 해외 수출")
  const [leadCount, setLeadCount] = useState(75)
  const [emailCount, setEmailCount] = useState(225)
  const [dashboardUrl, setDashboardUrl] = useState("https://app.rinda.ai/dashboard")
  const [language, setLanguage] = useState<"en" | "ko">("ko")
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | undefined>(7)
  const [industry, setIndustry] = useState("beauty")
  const [topCompanies, setTopCompanies] = useState("Amazon, Walmart, Target")

  const sendEmailMutation = useMutation({
    mutationFn: async (params: SendOnboardingEmailParams) =>
      apiFetch<{ success: boolean; message: string }>("/api/v1/test/onboarding-email", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      toast.success(`${email}로 온보딩 완료 이메일을 발송했습니다.`)
    },
    onError: (error: Error) => {
      toast.error(`발송 실패: ${error.message}`)
    },
  })

  const canSubmit = email.trim().length > 0 && !sendEmailMutation.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }

    const topCompaniesArray = topCompanies
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0)

    await sendEmailMutation.mutateAsync({
      email: email.trim(),
      firstName: firstName.trim() || undefined,
      companyName: companyName.trim() || undefined,
      companyDescription: companyDescription.trim() || undefined,
      leadCount,
      emailCount,
      dashboardUrl: dashboardUrl.trim(),
      language,
      trialDaysRemaining,
      industry: INDUSTRY_OPTIONS[industry as keyof typeof INDUSTRY_OPTIONS],
      topCompanies: topCompaniesArray.length > 0 ? topCompaniesArray : undefined,
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle>온보딩 완료 이메일 테스트</CardTitle>
        </div>
        <CardDescription>
          Loops.so를 통해 온보딩 완료 이메일을 테스트합니다. 모든 변수를 직접 입력하여 이메일
          미리보기를 확인할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="max-w-2xl space-y-4" onSubmit={handleSubmit}>
          {/* 수신자 이메일 */}
          <div className="space-y-2">
            <Label htmlFor={emailId}>수신자 이메일 *</Label>
            <Input
              id={emailId}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              required
              type="email"
              value={email}
            />
          </div>

          {/* 이름 */}
          <div className="space-y-2">
            <Label htmlFor={firstNameId}>이름 (firstName)</Label>
            <Input
              id={firstNameId}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="철희"
              value={firstName}
            />
          </div>

          {/* 회사명 */}
          <div className="space-y-2">
            <Label htmlFor={companyNameId}>회사명 (companyName, 개인화용)</Label>
            <Input
              id={companyNameId}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="주식회사 거목"
              value={companyName}
            />
          </div>

          {/* 회사 설명 */}
          <div className="space-y-2">
            <Label htmlFor={companyDescId}>회사 설명 (companyDescription, 개인화용)</Label>
            <Textarea
              id={companyDescId}
              onChange={(e) => setCompanyDescription(e.target.value)}
              placeholder="가공 기계 및 공장 설비 해외 수출"
              rows={2}
              value={companyDescription}
            />
          </div>

          {/* 바이어 수 & 이메일 수 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={leadCountId}>발견된 바이어 수 *</Label>
              <Input
                id={leadCountId}
                min={0}
                onChange={(e) => setLeadCount(Number(e.target.value))}
                required
                type="number"
                value={leadCount}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={emailCountId}>생성된 이메일 수 *</Label>
              <Input
                id={emailCountId}
                min={0}
                onChange={(e) => setEmailCount(Number(e.target.value))}
                required
                type="number"
                value={emailCount}
              />
            </div>
          </div>

          {/* 대시보드 URL */}
          <div className="space-y-2">
            <Label htmlFor={dashboardUrlId}>대시보드 URL *</Label>
            <Input
              id={dashboardUrlId}
              onChange={(e) => setDashboardUrl(e.target.value)}
              placeholder="https://app.rinda.ai/dashboard"
              required
              type="url"
              value={dashboardUrl}
            />
          </div>

          {/* 언어 & 체험판 잔여일 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={languageId}>언어</Label>
              <Select onValueChange={(v) => setLanguage(v as "en" | "ko")} value={language}>
                <SelectTrigger id={languageId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ko">한국어 (Korean)</SelectItem>
                  <SelectItem value="en">영어 (English)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={trialDaysId}>체험판 잔여일 (optional)</Label>
              <Input
                id={trialDaysId}
                min={0}
                onChange={(e) =>
                  setTrialDaysRemaining(e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="14"
                type="number"
                value={trialDaysRemaining ?? ""}
              />
            </div>
          </div>

          {/* 산업 */}
          <div className="space-y-2">
            <Label htmlFor={industryId}>산업군 (optional)</Label>
            <Select onValueChange={setIndustry} value={industry}>
              <SelectTrigger id={industryId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INDUSTRY_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 상위 기업 */}
          <div className="space-y-2">
            <Label htmlFor={topCompaniesId}>발견된 상위 기업 (optional, 쉼표로 구분)</Label>
            <Textarea
              id={topCompaniesId}
              onChange={(e) => setTopCompanies(e.target.value)}
              placeholder="Amazon, Walmart, Target"
              rows={2}
              value={topCompanies}
            />
          </div>

          {/* Submit */}
          <Button className="w-full gap-2 sm:w-auto" disabled={!canSubmit} type="submit">
            <Send className="h-4 w-4" />
            {sendEmailMutation.isPending ? "발송 중..." : "테스트 이메일 발송"}
          </Button>

          {/* Success message */}
          {sendEmailMutation.isSuccess && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 text-sm">
              이메일이 성공적으로 발송되었습니다. 받은편지함을 확인해주세요.
            </div>
          )}

          {/* Error message */}
          {sendEmailMutation.isError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 text-sm">
              발송 실패: {sendEmailMutation.error?.message || "알 수 없는 오류"}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
