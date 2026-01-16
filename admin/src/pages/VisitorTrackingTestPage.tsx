/**
 * Visitor Tracking Test Page
 *
 * Landing page replacement for testing IP-to-Company tracking.
 * Automatically tracks visitor on page load and displays results.
 */

import {
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  MapPin,
  Shield,
  Smartphone,
  XCircle,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// 그린다에이아이 워크스페이스 ID
const WORKSPACE_ID = "e490d297-b55a-47f0-9577-8749fec6e77b"

type VisitorData = {
  ipAddress: string
  country: string | null
  countryCode: string | null
  city: string | null
  region: string | null
  companyName: string | null
  companyDomain: string | null
  companyType: string | null
  asnOrg: string | null
  asnType: string | null
  isVpn: boolean
  isProxy: boolean
  isTor: boolean
  isDatacenter: boolean
  isMobile: boolean
  visitCount: number
  firstVisitAt: string
  lastVisitAt: string
}

type TrackingResult = {
  success: boolean
  code: string
  message: string
  data?: {
    tracked: boolean
    isNewVisitor: boolean
    visitorId: string
    ipSource: string | null
    visitor: VisitorData | null
  }
}

export default function VisitorTrackingTestPage() {
  const [trackingResult, setTrackingResult] = useState<TrackingResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Visitor data from tracking result
  const visitorDetail = trackingResult?.data?.visitor ?? null

  useEffect(() => {
    const trackVisitor = async () => {
      try {
        // Single API call - returns all visitor data
        const trackResponse = await fetch("/api/v1/visitors/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: WORKSPACE_ID,
            landingPage: window.location.href,
            referrer: document.referrer || null,
          }),
        })

        const trackData: TrackingResult = await trackResponse.json()
        setTrackingResult(trackData)

        if (!trackData.success) {
          setError(trackData.message || "Tracking failed")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to track visitor")
      } finally {
        setLoading(false)
      }
    }

    trackVisitor()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-bold text-3xl text-gray-900">IP-to-Company Tracking Test</h1>
          <p className="mt-2 text-gray-600">
            이 페이지는 방문자 IP 추적 시스템을 테스트합니다.
            <br />
            페이지 로드 시 자동으로 IP를 분석하고 회사 정보를 식별합니다.
          </p>
        </div>

        {/* Tracking Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {loading ? (
                <Clock className="h-5 w-5 animate-spin text-blue-500" />
              ) : trackingResult?.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Tracking Status
            </CardTitle>
            <CardDescription>
              {loading
                ? "방문자 정보를 분석 중..."
                : trackingResult?.success
                  ? trackingResult.message
                  : error || "추적 실패"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : trackingResult?.data ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-gray-500 text-sm">Visitor ID</p>
                  <p className="font-mono text-xs">
                    {trackingResult.data.visitorId?.slice(0, 8)}...
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Status</p>
                  <Badge variant={trackingResult.data.isNewVisitor ? "default" : "secondary"}>
                    {trackingResult.data.isNewVisitor ? "New Visitor" : "Returning"}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">IP Source</p>
                  <Badge variant="outline">{trackingResult.data.ipSource || "unknown"}</Badge>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Country</p>
                  <p className="font-medium">{trackingResult.data.visitor?.country || "-"}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Company Detection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              Company Detection
            </CardTitle>
            <CardDescription>IP 기반 회사 식별 결과</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : visitorDetail?.companyName ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <Building2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-800 text-lg">
                      {visitorDetail.companyName}
                    </p>
                    <p className="text-green-600 text-sm">
                      {visitorDetail.companyDomain && `${visitorDetail.companyDomain} · `}
                      {visitorDetail.companyType || "Business"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-gray-600">
                  회사 정보를 식별할 수 없습니다.
                  <br />
                  <span className="text-gray-500 text-sm">
                    (개인 인터넷, VPN, 모바일 네트워크 등에서 접속시)
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-500" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : visitorDetail ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-gray-500 text-sm">Country</p>
                  <p className="font-medium">
                    {visitorDetail.country || "-"}
                    {visitorDetail.countryCode && ` (${visitorDetail.countryCode})`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Region</p>
                  <p className="font-medium">{visitorDetail.region || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">City</p>
                  <p className="font-medium">{visitorDetail.city || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">IP Address</p>
                  <p className="font-mono text-sm">{visitorDetail.ipAddress}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Network Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              Network (ASN)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : visitorDetail ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-gray-500 text-sm">ASN Organization</p>
                  <p className="font-medium">{visitorDetail.asnOrg || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Network Type</p>
                  <Badge variant={visitorDetail.asnType === "business" ? "default" : "secondary"}>
                    {visitorDetail.asnType || "unknown"}
                  </Badge>
                  <span className="ml-2 text-gray-500 text-sm">
                    {visitorDetail.asnType === "business"
                      ? "(회사 네트워크)"
                      : visitorDetail.asnType === "isp"
                        ? "(개인 인터넷)"
                        : ""}
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Security Flags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-yellow-500" />
              Security Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-12 w-full" />
            ) : visitorDetail ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant={visitorDetail.isVpn ? "destructive" : "outline"}>
                  {visitorDetail.isVpn ? "VPN" : "No VPN"}
                </Badge>
                <Badge variant={visitorDetail.isProxy ? "destructive" : "outline"}>
                  {visitorDetail.isProxy ? "Proxy" : "No Proxy"}
                </Badge>
                <Badge variant={visitorDetail.isTor ? "destructive" : "outline"}>
                  {visitorDetail.isTor ? "Tor" : "No Tor"}
                </Badge>
                <Badge variant={visitorDetail.isDatacenter ? "secondary" : "outline"}>
                  {visitorDetail.isDatacenter ? "Datacenter" : "Not Datacenter"}
                </Badge>
                <Badge variant={visitorDetail.isMobile ? "secondary" : "outline"}>
                  <Smartphone className="mr-1 h-3 w-3" />
                  {visitorDetail.isMobile ? "Mobile" : "Not Mobile"}
                </Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Visit History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Visit History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : visitorDetail ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-gray-500 text-sm">Visit Count</p>
                  <p className="font-bold text-2xl">{visitorDetail.visitCount}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">First Visit</p>
                  <p className="font-medium">
                    {new Date(visitorDetail.firstVisitAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Last Visit</p>
                  <p className="font-medium">
                    {new Date(visitorDetail.lastVisitAt).toLocaleString("ko-KR")}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Workspace: {WORKSPACE_ID}</p>
          <p className="mt-1">
            관리 페이지:{" "}
            <a className="text-blue-600 hover:underline" href="/settings/visitor-analytics">
              /settings/visitor-analytics
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
