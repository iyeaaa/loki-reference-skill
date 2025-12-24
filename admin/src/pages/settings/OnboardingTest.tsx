import { FileText, Rocket } from "lucide-react"
import { useId, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { useTestOnboarding } from "@/lib/api/hooks/onboarding"

const INDUSTRY_OPTIONS = {
  beauty: "뷰티/화장품",
  fashion: "패션/의류",
  food: "식품/음료",
  it_saas: "IT/SaaS",
  manufacturing: "제조업",
  retail: "소매업",
  healthcare: "헬스케어",
  education: "교육",
  other: "기타",
}

const TARGET_OPTIONS = {
  b2b: "기업 대상 (B2B)",
  b2c: "소비자 대상 (B2C)",
  both: "둘 다 (B2B + B2C)",
}

const COUNTRY_OPTIONS = {
  jp: "일본 (Japan)",
  us: "미국 (United States)",
  sea: "동남아시아 (Southeast Asia)",
  eu: "유럽 (Europe)",
  cn: "중국 (China)",
  ae: "UAE (United Arab Emirates)",
  kr: "한국 (South Korea)",
  other: "기타 (Other)",
}

export function OnboardingTest() {
  const companyNameId = useId()
  const companyDescId = useId()
  const industryId = useId()
  const targetId = useId()
  const countryId = useId()

  const testOnboarding = useTestOnboarding()

  const [companyName, setCompanyName] = useState("주식회사 거목")
  const [companyDescription, setCompanyDescription] = useState(
    "가공 기계 및 관련 공장 기계 해외 수출",
  )
  const [industry, setIndustry] = useState("beauty")
  const [target, setTarget] = useState("b2b")
  const [country, setCountry] = useState("jp")

  const canSubmit = companyName.trim().length > 0 && !testOnboarding.isPending

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }

    await testOnboarding.mutateAsync({
      workspaceName: companyName.trim(),
      workspaceDescription: companyDescription.trim() || undefined,
      industry,
      target,
      country,
    })
  }

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadJSON = () => {
    if (!(testOnboarding.data?.leadDiscovery && testOnboarding.data?.emailGeneration)) {
      return
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)
    downloadFile(
      JSON.stringify(testOnboarding.data, null, 2),
      `onboarding-test-${timestamp}.json`,
      "application/json",
    )
  }

  const handleDownloadMarkdown = () => {
    if (!(testOnboarding.data?.leadDiscovery && testOnboarding.data?.emailGeneration)) {
      return
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)

    let mdContent = "# 온보딩 전체 테스트 결과\n\n"
    mdContent += `**생성 시간**: ${new Date().toLocaleString("ko-KR")}\n\n`

    mdContent += "## 입력 정보\n\n"
    mdContent += `- **회사명**: ${companyName}\n`
    if (companyDescription) {
      mdContent += `- **회사 설명**: ${companyDescription}\n`
    }
    mdContent += `- **산업**: ${INDUSTRY_OPTIONS[industry as keyof typeof INDUSTRY_OPTIONS]}\n`
    mdContent += `- **타겟**: ${TARGET_OPTIONS[target as keyof typeof TARGET_OPTIONS]}\n`
    mdContent += `- **국가**: ${COUNTRY_OPTIONS[country as keyof typeof COUNTRY_OPTIONS]}\n\n`

    mdContent += "## 1. 바이어 검색 결과\n\n"
    mdContent += "### 통계\n\n"
    mdContent += `- 총 발견: ${testOnboarding.data.leadDiscovery.stats.totalFound}개\n`
    mdContent += `- 정보 보강: ${testOnboarding.data.leadDiscovery.stats.totalEnriched}개\n`
    mdContent += `- 이메일 확보: ${testOnboarding.data.leadDiscovery.stats.totalWithEmail}개\n`
    mdContent += `- 최종 선정: ${testOnboarding.data.leadDiscovery.leads.length}개\n\n`

    mdContent += "### 발견된 바이어\n\n"
    for (let i = 0; i < testOnboarding.data.leadDiscovery.leads.length; i++) {
      const lead = testOnboarding.data.leadDiscovery.leads[i]
      mdContent += `#### ${i + 1}. ${lead.company}\n\n`
      mdContent += `- **Website**: ${lead.website}\n`
      mdContent += `- **Email**: ${lead.email || "N/A"}\n`
      mdContent += `- **Industry**: ${lead.industry}\n`
      mdContent += `- **Country**: ${lead.country}\n`
      if (lead.description) {
        mdContent += `- **Description**: ${lead.description}\n`
      }
      mdContent += "\n"
    }

    mdContent += "## 2. 이메일 생성 결과\n\n"
    for (const template of testOnboarding.data.emailGeneration.templates) {
      mdContent += `### Step ${template.step}: ${template.type} (+${template.delayDays}일)\n\n`
      mdContent += `**제목**: ${template.subject}\n\n`
      mdContent += `**본문**:\n\`\`\`\n${template.bodyText}\n\`\`\`\n\n`
    }

    downloadFile(mdContent, `onboarding-test-${timestamp}.md`, "text/markdown")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          <CardTitle>온보딩 전체 테스트</CardTitle>
        </div>
        <CardDescription>
          바이어 검색 + AI 이메일 생성을 한번에 테스트합니다. 실제 온보딩 프로세스와 동일하게
          동작합니다. (소요 시간: 약 2~3분)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="max-w-2xl space-y-4" onSubmit={handleTest}>
          <div className="space-y-2">
            <Label htmlFor={companyNameId}>회사명 (companyName) *</Label>
            <Input
              id={companyNameId}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="주식회사 거목"
              required
              value={companyName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyDescId}>회사 설명 (companyDescription, optional)</Label>
            <Textarea
              id={companyDescId}
              onChange={(e) => setCompanyDescription(e.target.value)}
              placeholder="가공 기계 및 관련 공장 기계 해외 수출"
              rows={3}
              value={companyDescription}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={industryId}>산업군 (industry) *</Label>
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

          <div className="space-y-2">
            <Label htmlFor={targetId}>타겟 고객 (target) *</Label>
            <Select onValueChange={setTarget} value={target}>
              <SelectTrigger id={targetId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TARGET_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={countryId}>희망 진출 국가 (country) *</Label>
            <Select onValueChange={setCountry} value={country}>
              <SelectTrigger id={countryId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COUNTRY_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full sm:w-auto" disabled={!canSubmit} type="submit">
            {testOnboarding.isPending ? "테스트 실행 중... (2~3분 소요)" : "테스트 실행 (약 2~3분)"}
          </Button>

          {testOnboarding.isPending && (
            <div className="space-y-2">
              <Progress value={testOnboarding.progress} />
              <p className="text-center text-muted-foreground text-sm">
                진행 중: {testOnboarding.progress}%
              </p>
            </div>
          )}

          {testOnboarding.isSuccess &&
            testOnboarding.data &&
            testOnboarding.data.leadDiscovery &&
            testOnboarding.data.emailGeneration && (
              <div className="mt-6 space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold text-lg">테스트 결과</h3>

                <div className="space-y-2">
                  <h4 className="font-medium">📊 바이어 검색 결과</h4>
                  <div className="space-y-1 text-muted-foreground text-sm">
                    <p>• 총 발견: {testOnboarding.data.leadDiscovery.stats.totalFound}개</p>
                    <p>• 이메일 확보: {testOnboarding.data.leadDiscovery.stats.totalWithEmail}개</p>
                    <p>• 최종 선정: {testOnboarding.data.leadDiscovery.leads.length}개</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">📧 이메일 생성 결과</h4>
                  <div className="space-y-1 text-muted-foreground text-sm">
                    <p>• 생성된 이메일: {testOnboarding.data.emailGeneration.templates.length}개</p>
                    {testOnboarding.data.emailGeneration.templates.map((t) => (
                      <p key={t.step}>
                        &nbsp;&nbsp;Step {t.step} ({t.type}): {t.subject}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">👥 샘플 바이어 (처음 5개)</h4>
                  <div className="space-y-1 text-muted-foreground text-sm">
                    {testOnboarding.data.leadDiscovery.leads.slice(0, 5).map((lead, i) => (
                      <p key={i}>
                        {i + 1}. {lead.company} - {lead.email}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="gap-2"
                    onClick={handleDownloadJSON}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <FileText className="h-4 w-4" />
                    JSON 다운로드
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={handleDownloadMarkdown}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <FileText className="h-4 w-4" />
                    Markdown 다운로드
                  </Button>
                </div>
              </div>
            )}

          {testOnboarding.isError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 text-sm">
              테스트 실패: {testOnboarding.error?.message || "알 수 없는 오류"}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
