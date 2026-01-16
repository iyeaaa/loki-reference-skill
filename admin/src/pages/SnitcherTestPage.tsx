/**
 * IP Intelligence Test Page (Public)
 *
 * Multi-provider IP lookup test page
 * - ipapi.is: IP Intelligence API (보안 정보 포함)
 * - Snitcher: IP to Company API
 *
 * 경로: /snitcher-test
 */

import { useMutation, useQuery } from "@tanstack/react-query"
import L from "leaflet"
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  MapPin,
  Network,
  Search,
  Server,
  Shield,
  Terminal,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  data?: IpapiData | Record<string, unknown>
  error?: string
  message?: string
}

type StatusResult = {
  success: boolean
  configured: boolean
  message: string
}

// ipapi.is specific types
type IpapiData = {
  ip: string
  rir: string
  is_bogon: boolean
  is_mobile: boolean
  is_satellite: boolean
  is_crawler: boolean
  is_datacenter: boolean
  is_tor: boolean
  is_proxy: boolean
  is_vpn: boolean
  is_abuser: boolean
  elapsed_ms: number
  datacenter?: {
    datacenter: string
    domain: string
    network: string
  }
  company?: {
    name: string
    abuser_score: string
    domain: string
    type: string
    network: string
    whois: string
  }
  abuse?: {
    name: string
    address: string
    email: string
    phone: string
  }
  asn?: {
    asn: number
    abuser_score: string
    route: string
    descr: string
    country: string
    active: boolean
    org: string
    domain: string
    abuse: string
    type: string
    created?: string
    updated?: string
    rir: string
    whois: string
  }
  location?: {
    is_eu_member: boolean
    calling_code: string
    currency_code: string
    continent: string
    country: string
    country_code: string
    state: string
    city: string
    latitude: number
    longitude: number
    zip: string
    timezone: string
    local_time: string
    local_time_unix: number
    is_dst: boolean
  }
}

// ============================================================================
// Provider Configurations
// ============================================================================

const PROVIDERS: ProviderConfig[] = [
  {
    id: "ipapi",
    name: "ipapi.is",
    description: "IP Intelligence API - 보안 정보 포함",
    docsUrl: "https://ipapi.is/developers.html",
    statusEndpoint: "/api/v1/ipapi/status",
    lookupEndpoint: "/api/v1/ipapi/lookup",
    features: ["회사", "위치", "ASN", "VPN/Proxy 감지", "Tor 감지", "데이터센터"],
  },
  {
    id: "snitcher",
    name: "Snitcher",
    description: "IP to Company API - 기업 정보 조회",
    docsUrl: "https://docs.snitcher.com/ip2company",
    statusEndpoint: "/api/v1/snitcher/status",
    lookupEndpoint: "/api/v1/snitcher/find-company",
    features: ["회사명", "도메인", "산업", "직원수", "위치", "소셜"],
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

function getProviderConfig(provider: Provider): ProviderConfig {
  const config = PROVIDERS.find((p) => p.id === provider)
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`)
  }
  return config
}

// ============================================================================
// API Functions
// ============================================================================

async function checkStatus(provider: Provider): Promise<StatusResult> {
  const config = getProviderConfig(provider)
  return publicApiFetch<StatusResult>(config.statusEndpoint)
}

async function lookupIp(provider: Provider, ip: string): Promise<ApiResult> {
  const config = getProviderConfig(provider)
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

  // Raw JSON toggle
  const [showRawJson, setShowRawJson] = useState(false)
  // My IP loading state
  const [isLoadingMyIp, setIsLoadingMyIp] = useState(false)

  const providerConfig = getProviderConfig(selectedProvider)

  // Fetch current user's IP address
  const fetchMyIp = async () => {
    setIsLoadingMyIp(true)
    try {
      const response = await fetch("https://api.ipify.org?format=json")
      const data = await response.json()
      if (data.ip) {
        setIpAddress(data.ip)
      }
    } catch (error) {
      console.error("Failed to fetch IP:", error)
    } finally {
      setIsLoadingMyIp(false)
    }
  }

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

  // Get location data for map
  const locationData = result?.success && result.data ? (result.data as IpapiData) : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <span className="font-semibold">IP Intelligence API</span>
          </div>
          <a
            className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
            href={providerConfig.docsUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            API Docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      {/* Main Content - Split Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[400px] shrink-0 overflow-y-auto border-r bg-muted/30 p-2">
          <div className="space-y-2">
            {/* API Status */}
            {statusQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                API 상태 확인 중...
              </div>
            ) : isConfigured ? (
              <Alert className="py-1.5">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                <AlertDescription className="text-xs">{statusQuery.data?.message}</AlertDescription>
              </Alert>
            ) : (
              <Alert className="py-1.5" variant="destructive">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-xs">
                  서버에 API Key가 설정되지 않았습니다.
                </AlertDescription>
              </Alert>
            )}

            {/* Search Section */}
            <Card className="shadow-none">
              <CardHeader className="px-3 py-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Search className="h-4 w-4 text-primary" />
                  IP Lookup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pt-0 pb-3">
                <form className="space-y-2" onSubmit={handleLookup}>
                  {/* Provider Select */}
                  <Select
                    onValueChange={(v) => handleProviderChange(v as Provider)}
                    value={selectedProvider}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1">
                    {providerConfig.features.map((feature) => (
                      <Badge className="text-xs" key={feature} variant="secondary">
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  {/* IP Address */}
                  <div className="flex gap-2">
                    <Input
                      className="h-9"
                      disabled={!isConfigured}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="IP 주소 입력"
                      value={ipAddress}
                    />
                    <Button className="h-9 shrink-0" disabled={!canLookup} size="sm" type="submit">
                      {lookupMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* My IP & Test IPs */}
                  <div className="space-y-2">
                    {/* My IP Button */}
                    <Button
                      className="h-7 w-full text-xs"
                      disabled={!isConfigured || isLoadingMyIp}
                      onClick={fetchMyIp}
                      type="button"
                      variant="secondary"
                    >
                      {isLoadingMyIp ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          IP 가져오는 중...
                        </>
                      ) : (
                        <>
                          <Network className="mr-1 h-3 w-3" />내 IP 주소 입력
                        </>
                      )}
                    </Button>
                    {/* Korean Companies */}
                    <div className="flex flex-wrap gap-1">
                      {koreanIps.map((item) => (
                        <Button
                          className="h-7 px-2 text-xs"
                          disabled={!isConfigured}
                          key={item.ip}
                          onClick={() => setIpAddress(item.ip)}
                          type="button"
                          variant="outline"
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                    {/* Global Companies */}
                    <div className="flex flex-wrap gap-1">
                      {globalIps.map((item) => (
                        <Button
                          className="h-7 px-2 text-xs"
                          disabled={!isConfigured}
                          key={item.ip}
                          onClick={() => setIpAddress(item.ip)}
                          type="button"
                          variant="outline"
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Result Section */}
            <Card className="shadow-none">
              <CardHeader className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Terminal className="h-4 w-4 text-primary" />
                    조회 결과
                  </CardTitle>
                  {result && (
                    <div className="flex gap-1">
                      <Button
                        className={`h-6 px-1.5 ${showRawJson ? "bg-muted" : ""}`}
                        onClick={() => setShowRawJson(!showRawJson)}
                        size="sm"
                        title="Raw JSON"
                        variant="ghost"
                      >
                        <Terminal className="h-3 w-3" />
                      </Button>
                      <Button
                        className="h-6 px-1.5"
                        onClick={handleCopyJson}
                        size="sm"
                        title="Copy"
                        variant="ghost"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        className="h-6 px-1.5"
                        onClick={handleClear}
                        size="sm"
                        title="Clear"
                        variant="ghost"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {result && (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge
                      className="h-5 text-xs"
                      variant={result.success ? "default" : "destructive"}
                    >
                      {result.statusCode}
                    </Badge>
                    <span className="text-muted-foreground">{selectedProvider}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="px-3 pt-0 pb-3">
                {result ? (
                  showRawJson ? (
                    <div className="relative">
                      <div className="flex items-center gap-1.5 rounded-t-md border border-b-0 bg-slate-800 px-3 py-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        <span className="ml-2 font-mono text-slate-400 text-xs">response.json</span>
                      </div>
                      <pre className="max-h-[300px] overflow-auto rounded-b-md border border-slate-700 bg-slate-900 p-3 font-mono text-slate-50 text-xs">
                        <JsonSyntaxHighlight data={result} />
                      </pre>
                    </div>
                  ) : selectedProvider === "ipapi" && result.data ? (
                    <IpapiResultDisplay data={result.data as IpapiData} />
                  ) : (
                    <SnitcherResultDisplay data={result} />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Search className="mb-2 h-10 w-10 text-muted-foreground/20" />
                    <p className="text-muted-foreground text-xs">IP 주소를 입력하고 조회하세요</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Info */}
            <div className="grid grid-cols-2 gap-1.5">
              {PROVIDERS.map((provider) => (
                <div
                  className={`rounded-md border p-2 ${
                    selectedProvider === provider.id ? "border-primary bg-primary/5" : "bg-muted/50"
                  }`}
                  key={provider.id}
                >
                  <h4 className="mb-0.5 font-medium text-xs">{provider.name}</h4>
                  <a
                    className="flex items-center gap-1 text-primary text-xs hover:underline"
                    href={provider.docsUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Docs <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>

            {/* Field Description */}
            {selectedProvider === "ipapi" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-muted-foreground text-xs">
                  <Info className="h-3 w-3" />
                  필드 설명
                </div>
                <IpapiFieldDescription />
              </div>
            )}
          </div>
        </aside>

        {/* Right Side - Large Map */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {selectedProvider === "ipapi" ? (
            <div className="relative h-full w-full">
              <FullScreenMap data={locationData} />
              {/* Map Info Overlay */}
              {locationData?.location && (
                <div className="absolute top-4 left-4 z-[1000] max-w-xs rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-mono font-semibold text-sm">{locationData.ip}</span>
                    </div>
                    {locationData.company && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{locationData.company.name}</span>
                      </div>
                    )}
                    <div className="text-muted-foreground text-xs">
                      {[
                        locationData.location.city,
                        locationData.location.state,
                        locationData.location.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                    <div className="font-mono text-muted-foreground text-xs">
                      {locationData.location.latitude?.toFixed(4)},{" "}
                      {locationData.location.longitude?.toFixed(4)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-muted/20">
              <Globe className="mb-4 h-24 w-24 text-muted-foreground/20" />
              <p className="text-muted-foreground">
                ipapi.is를 선택하면 지도에서 위치를 확인할 수 있습니다
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ============================================================================
// ipapi.is Result Display Component
// ============================================================================

function IpapiResultDisplay({ data }: { data: IpapiData }) {
  const { location, company, asn } = data

  return (
    <div className="space-y-3">
      {/* IP & Basic Info */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono font-semibold">{data.ip}</span>
          <Badge className="text-xs" variant="outline">
            {data.rir}
          </Badge>
        </div>
        <div className="text-muted-foreground text-xs">응답시간: {data.elapsed_ms}ms</div>
      </div>

      {/* Security Flags */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-1 font-medium text-xs">
          <Shield className="h-3 w-3 text-red-500" />
          보안 상태
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          <SecurityBadge label="VPN" value={data.is_vpn} />
          <SecurityBadge label="Proxy" value={data.is_proxy} />
          <SecurityBadge label="Tor" value={data.is_tor} />
          <SecurityBadge label="Datacenter" value={data.is_datacenter} />
          <SecurityBadge label="Abuser" value={data.is_abuser} />
          <SecurityBadge label="Crawler" value={data.is_crawler} />
          <SecurityBadge label="Mobile" value={data.is_mobile} />
          <SecurityBadge label="Satellite" value={data.is_satellite} />
        </div>
      </div>

      {/* Company Info */}
      {company && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1 font-medium text-xs">
            <Building2 className="h-3 w-3 text-purple-500" />
            회사 정보
          </h4>
          <div className="rounded-lg border p-2.5 text-xs">
            <div className="mb-1 font-medium">{company.name}</div>
            {company.domain && <div className="text-muted-foreground">{company.domain}</div>}
            <div className="mt-2 flex flex-wrap gap-1">
              {company.type && (
                <Badge className="text-xs" variant="secondary">
                  {company.type}
                </Badge>
              )}
              {company.abuser_score && (
                <Badge
                  className="text-xs"
                  variant={company.abuser_score === "low" ? "outline" : "destructive"}
                >
                  위험도: {company.abuser_score}
                </Badge>
              )}
            </div>
            {company.network && (
              <div className="mt-2 font-mono text-muted-foreground text-xs">{company.network}</div>
            )}
          </div>
        </div>
      )}

      {/* Location Info */}
      {location && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1 font-medium text-xs">
            <MapPin className="h-3 w-3 text-green-500" />
            위치 정보
          </h4>
          <div className="rounded-lg border p-2.5 text-xs">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <span className="text-muted-foreground">국가:</span>{" "}
                <span className="font-medium">{location.country}</span>
                {location.country_code && (
                  <span className="text-muted-foreground"> ({location.country_code})</span>
                )}
              </div>
              {location.state && (
                <div>
                  <span className="text-muted-foreground">지역:</span>{" "}
                  <span className="font-medium">{location.state}</span>
                </div>
              )}
              {location.city && (
                <div>
                  <span className="text-muted-foreground">도시:</span>{" "}
                  <span className="font-medium">{location.city}</span>
                </div>
              )}
              {location.timezone && (
                <div>
                  <span className="text-muted-foreground">시간대:</span>{" "}
                  <span className="font-medium">{location.timezone}</span>
                </div>
              )}
            </div>
            {location.latitude && location.longitude && (
              <div className="mt-2 font-mono text-muted-foreground">
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              {location.is_eu_member && (
                <Badge className="text-xs" variant="outline">
                  EU 회원국
                </Badge>
              )}
              {location.is_dst && (
                <Badge className="text-xs" variant="outline">
                  서머타임
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ASN Info */}
      {asn && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1 font-medium text-xs">
            <Server className="h-3 w-3 text-orange-500" />
            ASN 정보
          </h4>
          <div className="rounded-lg border p-2.5 text-xs">
            <div className="mb-1 font-medium">AS{asn.asn}</div>
            {asn.org && <div className="text-muted-foreground">{asn.org}</div>}
            {asn.route && <div className="mt-1 font-mono text-muted-foreground">{asn.route}</div>}
            <div className="mt-2 flex flex-wrap gap-1">
              {asn.type && (
                <Badge className="text-xs" variant="secondary">
                  {asn.type}
                </Badge>
              )}
              {asn.active && (
                <Badge className="text-xs" variant="outline">
                  Active
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Security badge helper
function SecurityBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
        value
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span className="font-medium">{value ? "Yes" : "No"}</span>
    </div>
  )
}

// ============================================================================
// Snitcher Result Display Component
// ============================================================================

function SnitcherResultDisplay({ data }: { data: ApiResult }) {
  if (!data.success) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span className="font-medium text-sm">오류 발생</span>
        </div>
        <p className="mt-1 text-red-600 text-xs dark:text-red-300">
          {data.error || data.message || "알 수 없는 오류"}
        </p>
      </div>
    )
  }

  const company = (data.data as Record<string, unknown>)?.company as
    | Record<string, unknown>
    | undefined

  if (!company) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-center">
        <p className="text-muted-foreground text-sm">회사 정보를 찾을 수 없습니다</p>
        {data.message && <p className="mt-1 text-muted-foreground text-xs">{data.message}</p>}
      </div>
    )
  }

  const location = company.location as Record<string, unknown> | undefined
  const social = company.social as Record<string, unknown> | undefined

  return (
    <div className="space-y-3">
      {/* Company Info */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-1 font-medium">{String(company.name)}</div>
        {company.domain ? (
          <div className="text-muted-foreground text-xs">{String(company.domain)}</div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1">
          {company.industry ? (
            <Badge className="text-xs" variant="secondary">
              {String(company.industry)}
            </Badge>
          ) : null}
          {company.employeeRange ? (
            <Badge className="text-xs" variant="outline">
              직원수: {String(company.employeeRange)}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Location */}
      {location ? (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1 font-medium text-xs">
            <MapPin className="h-3 w-3 text-green-500" />
            위치
          </h4>
          <div className="rounded-lg border p-2.5 text-xs">
            {[location.city, location.region, location.country]
              .filter(Boolean)
              .map(String)
              .join(", ")}
          </div>
        </div>
      ) : null}

      {/* Social Links */}
      {social ? (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1 font-medium text-xs">
            <Globe className="h-3 w-3 text-blue-500" />
            소셜
          </h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {social.linkedin ? (
              <a
                className="text-primary hover:underline"
                href={String(social.linkedin)}
                rel="noopener noreferrer"
                target="_blank"
              >
                LinkedIn
              </a>
            ) : null}
            {social.twitter ? (
              <a
                className="text-primary hover:underline"
                href={String(social.twitter)}
                rel="noopener noreferrer"
                target="_blank"
              >
                Twitter
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ============================================================================
// ipapi.is Field Description Component
// ============================================================================

function IpapiFieldDescription() {
  return (
    <div className="space-y-6">
      {/* Security Flags */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm">
          <Shield className="h-4 w-4 text-red-500" />
          보안 위협 지표
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">필드</th>
                <th className="px-3 py-2 text-left font-medium">설명</th>
                <th className="px-3 py-2 text-left font-medium">보안 관점</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_tor</td>
                <td className="px-3 py-2">Tor 출구 노드 여부</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">
                  익명 네트워크, 추적 불가
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_vpn</td>
                <td className="px-3 py-2">상용 VPN 서비스 IP</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">위치 우회 가능</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_proxy</td>
                <td className="px-3 py-2">프록시 서버 여부</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">실제 IP 은닉</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_abuser</td>
                <td className="px-3 py-2">악성 활동 이력</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">
                  스팸, DDoS, 해킹 시도 등
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_datacenter</td>
                <td className="px-3 py-2">데이터센터/호스팅 IP</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">봇/자동화 트래픽 가능성</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_crawler</td>
                <td className="px-3 py-2">검색엔진 봇/크롤러</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">자동화된 웹 수집</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Alert className="mt-3" variant="default">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>주의:</strong> 대규모 공유 인프라(Google DNS 등)의 경우 일부 사용자의 악용으로
            인해 플래그가 설정될 수 있습니다. 단일 지표만으로 차단 결정을 내리지 마세요.
          </AlertDescription>
        </Alert>
      </div>

      <Separator />

      {/* Network Info */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm">
          <Globe className="h-4 w-4 text-blue-500" />
          네트워크 기본 정보
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">필드</th>
                <th className="px-3 py-2 text-left font-medium">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2 font-mono text-xs">rir</td>
                <td className="px-3 py-2">
                  지역 인터넷 등록기관 (ARIN=북미, RIPE=유럽, APNIC=아시아태평양, KRNIC=한국)
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_bogon</td>
                <td className="px-3 py-2">
                  비공인 IP 여부 (사설 IP, 예약 주소 등 - true면 비정상)
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_mobile</td>
                <td className="px-3 py-2">모바일 통신사(3G/4G/5G) 대역 여부</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_satellite</td>
                <td className="px-3 py-2">위성 인터넷(Starlink, HughesNet 등) 여부</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      {/* Company Info */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm">
          <Building2 className="h-4 w-4 text-purple-500" />
          company 객체 (소유 기업)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">필드</th>
                <th className="px-3 py-2 text-left font-medium">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2 font-mono text-xs">name</td>
                <td className="px-3 py-2">IP 블록 소유 기업명</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">abuser_score</td>
                <td className="px-3 py-2">악용 점수 (0~1, Low/Medium/High) - 낮을수록 안전</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">type</td>
                <td className="px-3 py-2">네트워크 유형: hosting, isp, business, education 등</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">network</td>
                <td className="px-3 py-2">할당된 IP 대역 범위</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      {/* ASN Info */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm">
          <Server className="h-4 w-4 text-orange-500" />
          asn 객체 (자율 시스템)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">필드</th>
                <th className="px-3 py-2 text-left font-medium">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2 font-mono text-xs">asn</td>
                <td className="px-3 py-2">
                  자율 시스템 번호 - BGP 라우팅 고유 식별자 (예: 15169=Google)
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">route</td>
                <td className="px-3 py-2">BGP에서 광고되는 라우팅 프리픽스 (CIDR 표기)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">org</td>
                <td className="px-3 py-2">AS 소유 조직</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">active</td>
                <td className="px-3 py-2">현재 BGP 테이블에서 활성 상태</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 rounded-lg bg-muted/50 p-3">
          <p className="text-muted-foreground text-xs">
            <strong>AS(자율 시스템)란?</strong> 동일한 라우팅 정책 하에 운영되는 IP 네트워크의
            집합입니다. 인터넷은 수만 개의 AS가 BGP 프로토콜로 상호 연결된 구조입니다.
          </p>
          <code className="mt-2 block text-xs">
            AS15169 (Google) ↔ AS3356 (Lumen) ↔ AS4766 (KT) ↔ 사용자
          </code>
        </div>
      </div>

      <Separator />

      {/* Location Info */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm">
          <MapPin className="h-4 w-4 text-green-500" />
          location 객체 (지리 정보)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">필드</th>
                <th className="px-3 py-2 text-left font-medium">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2 font-mono text-xs">country / country_code</td>
                <td className="px-3 py-2">국가명 / ISO 국가 코드</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">state / city</td>
                <td className="px-3 py-2">주(도) / 도시</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">latitude / longitude</td>
                <td className="px-3 py-2">위도/경도 (GeoIP DB 기반, 도시 수준 정확도)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">timezone</td>
                <td className="px-3 py-2">IANA 타임존 식별자 (예: Asia/Seoul)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_eu_member</td>
                <td className="px-3 py-2">EU 회원국 여부 (GDPR 적용 판단에 활용)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">is_dst</td>
                <td className="px-3 py-2">서머타임(일광절약시간) 적용 여부</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Alert className="mt-3" variant="default">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>GeoIP 정확도 주의:</strong> IP 기반 위치는 실제 서버 위치가 아닌 IP 등록 위치를
            반영합니다. Anycast IP(8.8.8.8 포함)의 경우 실제 응답 서버는 전 세계에 분산되어 있을 수
            있습니다.
          </AlertDescription>
        </Alert>
      </div>

      <Separator />

      {/* Abuse Contact */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-sm">
          <AlertCircle className="h-4 w-4 text-red-500" />
          abuse 객체 (악용 신고 연락처)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">필드</th>
                <th className="px-3 py-2 text-left font-medium">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2 font-mono text-xs">email</td>
                <td className="px-3 py-2">악용 신고 이메일 (RFC 2142 abuse@ 형식)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">phone</td>
                <td className="px-3 py-2">연락처 전화번호</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">address</td>
                <td className="px-3 py-2">담당 조직 주소</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-muted-foreground text-xs">
          네트워크에서 발생한 악성 활동(스팸, DDoS, 해킹 시도 등)을 신고할 수 있는 공식
          연락처입니다.
        </p>
      </div>

      <Separator />

      {/* Use Cases */}
      <div>
        <h4 className="mb-3 font-semibold text-sm">실무 활용 시나리오</h4>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-1 font-medium text-xs">보안 위협 탐지</p>
            <p className="font-mono text-muted-foreground text-xs">
              is_tor, is_vpn, is_proxy, is_abuser
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-1 font-medium text-xs">봇/크롤러 필터링</p>
            <p className="font-mono text-muted-foreground text-xs">is_crawler, is_datacenter</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-1 font-medium text-xs">지역 기반 서비스</p>
            <p className="font-mono text-muted-foreground text-xs">country_code, state, city</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-1 font-medium text-xs">규정 준수 (GDPR)</p>
            <p className="font-mono text-muted-foreground text-xs">is_eu_member, country_code</p>
          </div>
        </div>
      </div>
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
      return <span className="text-slate-500">null</span>
    }

    if (typeof value === "boolean") {
      return <span className="text-amber-400">{value.toString()}</span>
    }

    if (typeof value === "number") {
      return <span className="text-cyan-400">{value}</span>
    }

    if (typeof value === "string") {
      // Check if it's a URL
      if (value.startsWith("http://") || value.startsWith("https://")) {
        return (
          <span className="text-emerald-400">
            "
            <a
              className="underline hover:text-emerald-300"
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
      return <span className="text-emerald-400">"{value}"</span>
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-slate-400">[]</span>
      }
      return (
        <>
          <span className="text-slate-400">[</span>
          {"\n"}
          {value.map((item, index) => (
            <span key={index}>
              {indentStr}
              {"  "}
              {formatValue(item, indent + 1)}
              {index < value.length - 1 && <span className="text-slate-400">,</span>}
              {"\n"}
            </span>
          ))}
          {indentStr}
          <span className="text-slate-400">]</span>
        </>
      )
    }

    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length === 0) {
        return <span className="text-slate-400">{"{}"}</span>
      }
      return (
        <>
          <span className="text-slate-400">{"{"}</span>
          {"\n"}
          {entries.map(([key, val], index) => (
            <span key={key}>
              {indentStr}
              {"  "}
              <span className="text-violet-400">"{key}"</span>
              <span className="text-slate-400">: </span>
              {formatValue(val, indent + 1)}
              {index < entries.length - 1 && <span className="text-slate-400">,</span>}
              {"\n"}
            </span>
          ))}
          {indentStr}
          <span className="text-slate-400">{"}"}</span>
        </>
      )
    }

    return <span className="text-slate-400">{String(value)}</span>
  }

  return <code>{formatValue(data)}</code>
}

// ============================================================================
// Location Map Component
// ============================================================================

// Custom marker icon (Leaflet default icons don't work well with bundlers)
const customIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Component to update map center when location changes
function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center, map])

  return null
}

// Full screen map component for the right side
type FullScreenMapProps = {
  data: IpapiData | null
}

function FullScreenMap({ data }: FullScreenMapProps) {
  const location = data?.location
  const company = data?.company

  const center = useMemo<[number, number]>(() => {
    if (location?.latitude && location?.longitude) {
      return [location.latitude, location.longitude]
    }
    return [35.9078, 127.7669] // Default: Korea center
  }, [location?.latitude, location?.longitude])

  const zoom = location?.latitude && location?.longitude ? 10 : 5

  const hasValidLocation = location?.latitude && location?.longitude

  return (
    <MapContainer
      center={center}
      className="h-full w-full"
      key={`${center[0]}-${center[1]}`}
      scrollWheelZoom={true}
      zoom={zoom}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapCenterUpdater center={center} />
      {hasValidLocation && data && (
        <Marker icon={customIcon} position={center}>
          <Popup>
            <div className="min-w-[220px] space-y-2">
              {/* IP Address */}
              <div className="border-b pb-2">
                <p className="font-mono font-semibold">{data.ip}</p>
              </div>

              {/* Company Info */}
              {company && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1 font-medium text-sm">
                    <Building2 className="h-3 w-3" />
                    {company.name}
                  </p>
                  {company.domain && (
                    <p className="text-muted-foreground text-xs">{company.domain}</p>
                  )}
                  {company.type && (
                    <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                      {company.type}
                    </span>
                  )}
                </div>
              )}

              {/* Location Info */}
              <div className="space-y-1 border-t pt-2">
                <p className="flex items-center gap-1 text-sm">
                  <MapPin className="h-3 w-3" />
                  {[location?.city, location?.state, location?.country].filter(Boolean).join(", ")}
                </p>
                {location?.country_code && (
                  <p className="text-muted-foreground text-xs">
                    {location.country_code} • {location.timezone}
                  </p>
                )}
                <p className="font-mono text-muted-foreground text-xs">
                  {location?.latitude?.toFixed(4)}, {location?.longitude?.toFixed(4)}
                </p>
              </div>

              {/* ASN Info */}
              {data.asn && (
                <div className="border-t pt-2">
                  <p className="text-muted-foreground text-xs">
                    AS{data.asn.asn} • {data.asn.org}
                  </p>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
