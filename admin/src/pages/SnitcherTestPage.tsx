/**
 * Snitcher IP to Company API Test Page (Public)
 *
 * IP to Company API 테스트 페이지
 * - 로그인 없이 접근 가능
 * - 서버에 설정된 API Key 사용
 *
 * 경로: /snitcher-test
 * @see https://docs.snitcher.com/ip2company
 */

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Search,
  Trash2,
  Users,
} from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { publicApiFetch } from "@/lib/api/client"

// ============================================================================
// Types
// ============================================================================

type SnitcherCompanyData = {
  name?: string
  domain?: string
  industry?: string
  foundedYear?: number
  employeeRange?: string
  revenue?: string
  location?: {
    city?: string
    region?: string
    country?: string
    countryCode?: string
  }
  social?: {
    linkedin?: string
    crunchbase?: string
    twitter?: string
  }
}

type SnitcherApiResult = {
  success: boolean
  statusCode: number
  data?: {
    ip: string
    company?: SnitcherCompanyData
  }
  error?: string
  message?: string
}

type SnitcherUsageResult = {
  success: boolean
  statusCode: number
  data?: {
    credits: {
      used: number
      remaining: number
      total: number
    }
    billingCycle: {
      start: string
      end: string
    }
  }
  error?: string
}

type SnitcherStatusResult = {
  success: boolean
  configured: boolean
  message: string
}

// ============================================================================
// API Functions
// ============================================================================

async function checkStatus(): Promise<SnitcherStatusResult> {
  return publicApiFetch<SnitcherStatusResult>("/api/v1/snitcher/status")
}

async function findCompanyByIp(ip: string): Promise<SnitcherApiResult> {
  return publicApiFetch<SnitcherApiResult>("/api/v1/snitcher/find-company", {
    method: "POST",
    body: JSON.stringify({ ip }),
  })
}

async function getUsage(): Promise<SnitcherUsageResult> {
  return publicApiFetch<SnitcherUsageResult>("/api/v1/snitcher/usage")
}

// ============================================================================
// Component
// ============================================================================

export default function SnitcherTestPage() {
  // IP state
  const [ipAddress, setIpAddress] = useState("")

  // Result state
  const [result, setResult] = useState<SnitcherApiResult | null>(null)

  // Check API status
  const statusQuery = useQuery({
    queryKey: ["snitcher-status"],
    queryFn: checkStatus,
  })

  // Get usage
  const usageQuery = useQuery({
    queryKey: ["snitcher-usage"],
    queryFn: getUsage,
    enabled: statusQuery.data?.configured === true,
  })

  // Find company mutation
  const findCompanyMutation = useMutation({
    mutationFn: () => findCompanyByIp(ipAddress),
    onSuccess: (data) => {
      setResult(data)
    },
    onError: (error) => {
      setResult({
        success: false,
        statusCode: 500,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  const isConfigured = statusQuery.data?.configured === true
  const canFindCompany =
    isConfigured && ipAddress.trim().length > 0 && !findCompanyMutation.isPending

  const handleFindCompany = (e: React.FormEvent) => {
    e.preventDefault()
    if (canFindCompany) {
      findCompanyMutation.mutate()
    }
  }

  const handleClear = () => {
    setResult(null)
  }

  const handleCopyJson = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    }
  }

  // Example test IPs
  const testIps = [
    { ip: "8.8.8.8", label: "Google DNS" },
    { ip: "208.67.222.222", label: "Cisco OpenDNS" },
    { ip: "1.1.1.1", label: "Cloudflare" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">Snitcher IP to Company API Test</span>
          </div>
          <a
            className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
            href="https://docs.snitcher.com/ip2company"
            rel="noopener noreferrer"
            target="_blank"
          >
            API Docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="mb-2 font-bold text-3xl">IP to Company API</h1>
          <p className="text-muted-foreground">
            IP 주소로 회사 정보를 조회하는 Snitcher API 테스트
          </p>
        </div>

        {/* API Status */}
        {statusQuery.isLoading ? (
          <div className="mb-6 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            API 상태 확인 중...
          </div>
        ) : isConfigured ? (
          <Alert className="mb-6">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle>API 연결됨</AlertTitle>
            <AlertDescription className="flex items-center gap-4">
              <span>Snitcher API가 정상적으로 연결되었습니다.</span>
              {usageQuery.data?.success && usageQuery.data.data && (
                <Badge variant="outline">
                  크레딧: {usageQuery.data.data.credits.remaining.toLocaleString()} /{" "}
                  {usageQuery.data.data.credits.total.toLocaleString()}
                </Badge>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>API 미설정</AlertTitle>
            <AlertDescription>
              서버에 Snitcher API Key가 설정되지 않았습니다. 관리자에게 문의하세요.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="h-5 w-5" />
                IP 조회
              </CardTitle>
              <CardDescription>조회할 IP 주소를 입력하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleFindCompany}>
                {/* IP Address */}
                <div className="space-y-2">
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <Input
                    disabled={!isConfigured}
                    id="ipAddress"
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="203.xxx.xxx.xxx"
                    value={ipAddress}
                  />
                </div>

                {/* Test IPs */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">테스트 IP 예시</Label>
                  <div className="flex flex-wrap gap-2">
                    {testIps.map((item) => (
                      <Button
                        disabled={!isConfigured}
                        key={item.ip}
                        onClick={() => setIpAddress(item.ip)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Submit Button */}
                <Button className="w-full" disabled={!canFindCompany} size="lg" type="submit">
                  {findCompanyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      조회 중...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      회사 조회
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Result Card */}
          <ResultCard handleClear={handleClear} handleCopyJson={handleCopyJson} result={result} />
        </div>

        {/* Info Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">API 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <h4 className="mb-2 font-medium text-sm">Rate Limit</h4>
                <p className="text-muted-foreground text-sm">600 requests/minute</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <h4 className="mb-2 font-medium text-sm">인증</h4>
                <div className="space-y-1 text-sm">
                  <p>Bearer Token (API Key)</p>
                  <p className="text-muted-foreground text-xs">서버에서 관리</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <h4 className="mb-2 font-medium text-sm">문서</h4>
                <a
                  className="flex items-center gap-1 text-primary text-sm hover:underline"
                  href="https://docs.snitcher.com/ip2company"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Snitcher API Docs <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Response Codes */}
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="mb-3 font-medium text-sm">응답 코드</h4>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default">200</Badge>
                  <span className="text-muted-foreground">회사 정보 조회 성공</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">202</Badge>
                  <span className="text-muted-foreground">처리 대기 중 (재시도 필요)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">403</Badge>
                  <span className="text-muted-foreground">할당량 초과</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">404</Badge>
                  <span className="text-muted-foreground">ISP / 개인 사용자 IP</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">429</Badge>
                  <span className="text-muted-foreground">Rate limit 초과</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

// ============================================================================
// Result Card Component
// ============================================================================

function ResultCard({
  result,
  handleCopyJson,
  handleClear,
}: {
  result: SnitcherApiResult | null
  handleCopyJson: () => void
  handleClear: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5" />
            응답 결과
          </CardTitle>
          {result && (
            <div className="flex gap-2">
              <Button onClick={handleCopyJson} size="sm" variant="outline">
                <Copy className="mr-1 h-3 w-3" />
                복사
              </Button>
              <Button onClick={handleClear} size="sm" variant="ghost">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          {result ? (
            <span className="flex items-center gap-2">
              상태:{" "}
              <Badge variant={result.success ? "default" : "destructive"}>
                {result.statusCode}
              </Badge>
            </span>
          ) : (
            "조회 결과가 여기에 표시됩니다"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result ? (
          result.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>오류</AlertTitle>
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          ) : result.message ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {result.statusCode === 202 ? "처리 대기 중" : "ISP / 개인 사용자"}
              </AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          ) : result.data?.company ? (
            <div className="space-y-4">
              {/* Company Info */}
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      {result.data.company.name}
                    </h3>
                    {result.data.company.domain && (
                      <a
                        className="text-muted-foreground text-sm hover:underline"
                        href={`https://${result.data.company.domain}`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {result.data.company.domain}
                      </a>
                    )}
                  </div>
                  <Badge variant="outline">company</Badge>
                </div>

                <Separator className="my-3" />

                <div className="grid gap-3 text-sm">
                  {result.data.company.industry && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">산업:</span>
                      <span>{result.data.company.industry}</span>
                    </div>
                  )}
                  {result.data.company.employeeRange && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">직원 수:</span>
                      <span>{result.data.company.employeeRange}</span>
                    </div>
                  )}
                  {result.data.company.revenue && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">매출:</span>
                      <span>{result.data.company.revenue}</span>
                    </div>
                  )}
                  {result.data.company.foundedYear && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">설립:</span>
                      <span>{result.data.company.foundedYear}년</span>
                    </div>
                  )}
                  {result.data.company.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">위치:</span>
                      <span>
                        {[
                          result.data.company.location.city,
                          result.data.company.location.region,
                          result.data.company.location.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Social Profiles */}
                {result.data.company.social &&
                  (result.data.company.social.linkedin || result.data.company.social.twitter) && (
                    <div className="mt-3 flex gap-2">
                      {result.data.company.social.linkedin && (
                        <a
                          className="text-muted-foreground hover:text-foreground"
                          href={result.data.company.social.linkedin}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Badge variant="secondary">LinkedIn</Badge>
                        </a>
                      )}
                      {result.data.company.social.twitter && (
                        <a
                          className="text-muted-foreground hover:text-foreground"
                          href={result.data.company.social.twitter}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Badge variant="secondary">Twitter</Badge>
                        </a>
                      )}
                      {result.data.company.social.crunchbase && (
                        <a
                          className="text-muted-foreground hover:text-foreground"
                          href={result.data.company.social.crunchbase}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Badge variant="secondary">Crunchbase</Badge>
                        </a>
                      )}
                    </div>
                  )}
              </div>

              {/* Raw JSON */}
              <details className="group">
                <summary className="cursor-pointer text-muted-foreground text-sm hover:text-foreground">
                  원본 JSON 보기
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Building2 className="mb-4 h-12 w-12 opacity-20" />
            <p>IP 주소를 입력하고 조회 버튼을 누르세요</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
