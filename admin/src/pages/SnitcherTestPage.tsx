/**
 * IP Intelligence Test Page (Public)
 *
 * Multi-provider IP lookup test page
 * - Snitcher: IP to Company API
 * - ipapi.is: IP Intelligence API
 *
 * 경로: /snitcher-test
 */

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Network,
  Search,
  Terminal,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { Separator } from "@/components/ui/separator"
import { publicApiFetch } from "@/lib/api/client"

// ============================================================================
// Types
// ============================================================================

type Provider = "snitcher" | "ipapi"

type ProviderConfig = {
  id: Provider
  name: string
  description: string
  docsUrl: string
  statusEndpoint: string
  lookupEndpoint: string
  features: string[]
}

type ApiResult = {
  success: boolean
  statusCode: number
  data?: unknown
  error?: string
  message?: string
}

type StatusResult = {
  success: boolean
  configured: boolean
  message: string
}

// ============================================================================
// Provider Configurations
// ============================================================================

const PROVIDERS: ProviderConfig[] = [
  {
    id: "snitcher",
    name: "Snitcher",
    description: "IP to Company API - 기업 정보 조회",
    docsUrl: "https://docs.snitcher.com/ip2company",
    statusEndpoint: "/api/v1/snitcher/status",
    lookupEndpoint: "/api/v1/snitcher/find-company",
    features: ["회사명", "도메인", "산업", "직원수", "위치", "소셜"],
  },
  {
    id: "ipapi",
    name: "ipapi.is",
    description: "IP Intelligence API - 보안 정보 포함",
    docsUrl: "https://ipapi.is/developers.html",
    statusEndpoint: "/api/v1/ipapi/status",
    lookupEndpoint: "/api/v1/ipapi/lookup",
    features: ["회사", "위치", "ASN", "VPN/Proxy 감지", "Tor 감지", "데이터센터"],
  },
]

// ============================================================================
// API Functions
// ============================================================================

async function checkStatus(provider: Provider): Promise<StatusResult> {
  const config = PROVIDERS.find((p) => p.id === provider)!
  return publicApiFetch<StatusResult>(config.statusEndpoint)
}

async function lookupIp(provider: Provider, ip: string): Promise<ApiResult> {
  const config = PROVIDERS.find((p) => p.id === provider)!
  return publicApiFetch<ApiResult>(config.lookupEndpoint, {
    method: "POST",
    body: JSON.stringify({ ip }),
  })
}

// ============================================================================
// Component
// ============================================================================

export default function SnitcherTestPage() {
  // Provider state
  const [selectedProvider, setSelectedProvider] = useState<Provider>("ipapi")

  // IP state
  const [ipAddress, setIpAddress] = useState("")

  // Result state
  const [result, setResult] = useState<ApiResult | null>(null)

  const providerConfig = PROVIDERS.find((p) => p.id === selectedProvider)!

  // Check API status
  const statusQuery = useQuery({
    queryKey: ["ip-lookup-status", selectedProvider],
    queryFn: () => checkStatus(selectedProvider),
  })

  // Lookup mutation
  const lookupMutation = useMutation({
    mutationFn: () => lookupIp(selectedProvider, ipAddress),
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

  // For ipapi.is, always available (free tier)
  const isConfigured = selectedProvider === "ipapi" ? true : statusQuery.data?.configured === true
  const canLookup = isConfigured && ipAddress.trim().length > 0 && !lookupMutation.isPending

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault()
    if (canLookup) {
      lookupMutation.mutate()
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

  const handleProviderChange = (value: Provider) => {
    setSelectedProvider(value)
    setResult(null)
  }

  // Test IPs - Korean companies
  const koreanIps = [
    { ip: "223.130.200.104", label: "Naver" },
    { ip: "110.76.141.50", label: "Kakao" },
    { ip: "203.229.225.200", label: "Samsung" },
    { ip: "211.115.106.81", label: "LG" },
  ]

  // Test IPs - Global companies
  const globalIps = [
    { ip: "8.8.8.8", label: "Google" },
    { ip: "13.107.42.14", label: "Microsoft" },
    { ip: "17.253.144.10", label: "Apple" },
    { ip: "157.240.1.35", label: "Meta" },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-zinc-800 border-b bg-zinc-900/50 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-green-500" />
            <span className="font-mono font-semibold">IP Intelligence API Test</span>
          </div>
          <a
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-100"
            href={providerConfig.docsUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            API Docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="mb-2 font-bold font-mono text-3xl text-green-500">$ ip-lookup --test</h1>
          <p className="font-mono text-sm text-zinc-500">
            IP 주소로 기업/보안 정보를 조회하는 API 테스트
          </p>
        </div>

        {/* API Status */}
        {statusQuery.isLoading ? (
          <div className="mb-6 flex items-center justify-center gap-2 font-mono text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            API 상태 확인 중...
          </div>
        ) : isConfigured ? (
          <Alert className="mb-6 border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="font-mono text-green-500">API Ready</AlertTitle>
            <AlertDescription className="font-mono text-sm text-zinc-400">
              {statusQuery.data?.message}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-6 border-red-500/30 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertTitle className="font-mono text-red-500">API Not Configured</AlertTitle>
            <AlertDescription className="font-mono text-sm text-zinc-400">
              서버에 API Key가 설정되지 않았습니다.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Card */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-lg text-zinc-100">
                <Network className="h-5 w-5 text-green-500" />
                IP Lookup
              </CardTitle>
              <CardDescription className="font-mono text-zinc-500">
                API 선택 후 IP 주소를 입력하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleLookup}>
                {/* Provider Select */}
                <div className="space-y-2">
                  <Label className="font-mono text-sm text-zinc-400" htmlFor="provider">
                    API Provider
                  </Label>
                  <Select
                    onValueChange={(v) => handleProviderChange(v as Provider)}
                    value={selectedProvider}
                  >
                    <SelectTrigger className="border-zinc-700 bg-zinc-800 font-mono text-zinc-100">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-700 bg-zinc-800">
                      {PROVIDERS.map((provider) => (
                        <SelectItem
                          className="font-mono text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                          key={provider.id}
                          value={provider.id}
                        >
                          <div className="flex items-center gap-2">
                            <span>{provider.name}</span>
                            <span className="text-xs text-zinc-500">- {provider.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-1">
                  {providerConfig.features.map((feature) => (
                    <Badge
                      className="border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-400"
                      key={feature}
                      variant="outline"
                    >
                      {feature}
                    </Badge>
                  ))}
                </div>

                <Separator className="bg-zinc-800" />

                {/* IP Address */}
                <div className="space-y-2">
                  <Label className="font-mono text-sm text-zinc-400" htmlFor="ipAddress">
                    IP Address
                  </Label>
                  <Input
                    className="border-zinc-700 bg-zinc-800 font-mono text-zinc-100 placeholder:text-zinc-600"
                    disabled={!isConfigured}
                    id="ipAddress"
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="0.0.0.0"
                    value={ipAddress}
                  />
                </div>

                {/* Test IPs */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs text-zinc-600">Korean Companies</Label>
                    <div className="flex flex-wrap gap-2">
                      {koreanIps.map((item) => (
                        <Button
                          className="border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
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
                  <div className="space-y-2">
                    <Label className="font-mono text-xs text-zinc-600">Global Companies</Label>
                    <div className="flex flex-wrap gap-2">
                      {globalIps.map((item) => (
                        <Button
                          className="border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
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
                </div>

                <Separator className="bg-zinc-800" />

                {/* Submit Button */}
                <Button
                  className="w-full bg-green-600 font-mono hover:bg-green-700"
                  disabled={!canLookup}
                  size="lg"
                  type="submit"
                >
                  {lookupMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      조회 중...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />$ lookup --ip {ipAddress || "..."}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Result Card - Console Style */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-mono text-lg text-zinc-100">
                  <Terminal className="h-5 w-5 text-green-500" />
                  Response
                </CardTitle>
                {result && (
                  <div className="flex gap-2">
                    <Button
                      className="border-zinc-700 bg-zinc-800 font-mono text-xs hover:bg-zinc-700"
                      onClick={handleCopyJson}
                      size="sm"
                      variant="outline"
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                    <Button
                      className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                      onClick={handleClear}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <CardDescription className="font-mono text-zinc-500">
                {result ? (
                  <span className="flex items-center gap-2">
                    status:{" "}
                    <Badge
                      className={
                        result.success
                          ? "border-green-500/50 bg-green-500/20 text-green-400"
                          : "border-red-500/50 bg-red-500/20 text-red-400"
                      }
                      variant="outline"
                    >
                      {result.statusCode}
                    </Badge>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-600">provider: {selectedProvider}</span>
                  </span>
                ) : (
                  "$ waiting for request..."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="relative">
                  {/* Console Header */}
                  <div className="flex items-center gap-2 rounded-t-lg border border-zinc-700 border-b-0 bg-zinc-800 px-4 py-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="ml-2 font-mono text-xs text-zinc-500">response.json</span>
                  </div>
                  {/* Console Body */}
                  <pre className="max-h-[500px] overflow-auto rounded-b-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm">
                    <JsonSyntaxHighlight data={result} />
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Terminal className="mb-4 h-16 w-16 text-zinc-800" />
                  <p className="font-mono text-sm text-zinc-600">
                    $ echo "Enter IP address and click lookup"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="mt-6 border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="font-mono text-base text-zinc-100">API Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {PROVIDERS.map((provider) => (
                <div
                  className={`rounded-lg border p-4 ${
                    selectedProvider === provider.id
                      ? "border-green-500/50 bg-green-500/10"
                      : "border-zinc-800 bg-zinc-800/50"
                  }`}
                  key={provider.id}
                >
                  <h4 className="mb-2 font-medium font-mono text-sm text-zinc-100">
                    {provider.name}
                  </h4>
                  <p className="mb-2 font-mono text-xs text-zinc-500">{provider.description}</p>
                  <a
                    className="flex items-center gap-1 font-mono text-green-500 text-xs hover:underline"
                    href={provider.docsUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Documentation <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

// ============================================================================
// JSON Syntax Highlighting Component
// ============================================================================

function JsonSyntaxHighlight({ data }: { data: unknown }) {
  const formatValue = (value: unknown, indent = 0): React.ReactNode => {
    const indentStr = "  ".repeat(indent)

    if (value === null) {
      return <span className="text-zinc-500">null</span>
    }

    if (typeof value === "boolean") {
      return <span className="text-yellow-400">{value.toString()}</span>
    }

    if (typeof value === "number") {
      return <span className="text-cyan-400">{value}</span>
    }

    if (typeof value === "string") {
      // Check if it's a URL
      if (value.startsWith("http://") || value.startsWith("https://")) {
        return (
          <span className="text-green-400">
            "
            <a
              className="underline hover:text-green-300"
              href={value}
              rel="noopener noreferrer"
              target="_blank"
            >
              {value}
            </a>
            "
          </span>
        )
      }
      return <span className="text-green-400">"{value}"</span>
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-zinc-400">[]</span>
      }
      return (
        <>
          <span className="text-zinc-400">[</span>
          {"\n"}
          {value.map((item, index) => (
            <span key={index}>
              {indentStr}
              {"  "}
              {formatValue(item, indent + 1)}
              {index < value.length - 1 && <span className="text-zinc-400">,</span>}
              {"\n"}
            </span>
          ))}
          {indentStr}
          <span className="text-zinc-400">]</span>
        </>
      )
    }

    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length === 0) {
        return <span className="text-zinc-400">{"{}"}</span>
      }
      return (
        <>
          <span className="text-zinc-400">{"{"}</span>
          {"\n"}
          {entries.map(([key, val], index) => (
            <span key={key}>
              {indentStr}
              {"  "}
              <span className="text-purple-400">"{key}"</span>
              <span className="text-zinc-400">: </span>
              {formatValue(val, indent + 1)}
              {index < entries.length - 1 && <span className="text-zinc-400">,</span>}
              {"\n"}
            </span>
          ))}
          {indentStr}
          <span className="text-zinc-400">{"}"}</span>
        </>
      )
    }

    return <span className="text-zinc-400">{String(value)}</span>
  }

  return <code>{formatValue(data)}</code>
}
