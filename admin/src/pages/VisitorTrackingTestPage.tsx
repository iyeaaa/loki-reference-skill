/**
 * Visitor Tracking Test Page
 *
 * Landing page replacement for testing IP-to-Company tracking.
 * Automatically tracks visitor on page load and displays results.
 */

import { motion } from "framer-motion"
import {
  Building2,
  CheckCircle2,
  Globe2,
  Loader2,
  MapPin,
  Network,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Timer,
  Wifi,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  shouldReduceMotion,
  staggerContainerFastVariants,
  staggerItemVariants,
} from "@/lib/animations"
import { cn } from "@/lib/utils"

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

function getFlagEmoji(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) {
    return ""
  }
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127_397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
}: {
  label: string
  value: string
  icon: React.ElementType
  variant?: "default" | "success" | "warning" | "muted"
}) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    muted: "text-muted-foreground",
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        <Icon className={cn("h-4 w-4", variantStyles[variant])} />
      </div>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={cn("font-medium text-sm", variantStyles[variant])}>{value}</p>
      </div>
    </div>
  )
}

function SecurityBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <Badge
      className={cn(
        "gap-1",
        active
          ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      )}
      variant="outline"
    >
      {active ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
      {label}
    </Badge>
  )
}

export default function VisitorTrackingTestPage() {
  const [trackingResult, setTrackingResult] = useState<TrackingResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reducedMotion = shouldReduceMotion()

  const visitorDetail = trackingResult?.data?.visitor ?? null

  const trackVisitor = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
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
  }, [])

  useEffect(() => {
    trackVisitor()
  }, [trackVisitor])

  const MotionDiv = reducedMotion ? "div" : motion.div

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Wifi className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">IP Intelligence</h1>
              <p className="text-muted-foreground text-xs">방문자 추적 테스트</p>
            </div>
          </div>
          <Button disabled={loading} onClick={trackVisitor} size="sm" variant="outline">
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            다시 분석
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <MotionDiv
          {...(!reducedMotion && {
            animate: "visible",
            initial: "hidden",
            variants: staggerContainerFastVariants,
          })}
          className="space-y-4"
        >
          {/* Status Banner */}
          <MotionDiv {...(!reducedMotion && { variants: staggerItemVariants })}>
            <Card
              className={cn(
                "border-l-4",
                loading
                  ? "border-l-blue-500"
                  : trackingResult?.success
                    ? "border-l-emerald-500"
                    : "border-l-red-500",
              )}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  ) : trackingResult?.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">
                      {loading
                        ? "분석 중..."
                        : trackingResult?.success
                          ? trackingResult.data?.isNewVisitor
                            ? "신규 방문자"
                            : "재방문자"
                          : "추적 실패"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {loading
                        ? "IP 정보를 수집하고 있습니다"
                        : trackingResult?.success
                          ? `IP Source: ${trackingResult.data?.ipSource || "unknown"}`
                          : error}
                    </p>
                  </div>
                </div>
                {trackingResult?.data?.visitorId && (
                  <Badge className="font-mono" variant="secondary">
                    {trackingResult.data.visitorId.slice(0, 8)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </MotionDiv>

          {/* Main Content Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Company Detection */}
            <MotionDiv {...(!reducedMotion && { variants: staggerItemVariants })}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-primary" />
                    회사 정보
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : visitorDetail?.companyName ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                          <Building2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-lg">
                            {visitorDetail.companyName}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {visitorDetail.companyDomain || "도메인 정보 없음"}
                          </p>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">유형</span>
                        <Badge variant="outline">{visitorDetail.companyType || "Unknown"}</Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-sm">회사 정보 없음</p>
                      <p className="text-muted-foreground text-xs">개인 인터넷 또는 VPN 사용 중</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </MotionDiv>

            {/* Location */}
            <MotionDiv {...(!reducedMotion && { variants: staggerItemVariants })}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4 text-primary" />
                    위치 정보
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ) : visitorDetail ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{getFlagEmoji(visitorDetail.countryCode)}</span>
                        <div>
                          <p className="font-semibold">
                            {visitorDetail.country || "Unknown"}
                            {visitorDetail.countryCode && (
                              <span className="ml-1 text-muted-foreground">
                                ({visitorDetail.countryCode})
                              </span>
                            )}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {[visitorDetail.city, visitorDetail.region]
                              .filter(Boolean)
                              .join(", ") || "상세 위치 정보 없음"}
                          </p>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">IP 주소</span>
                        <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                          {visitorDetail.ipAddress}
                        </code>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </MotionDiv>

            {/* Network Info */}
            <MotionDiv {...(!reducedMotion && { variants: staggerItemVariants })}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Network className="h-4 w-4 text-primary" />
                    네트워크 (ASN)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : visitorDetail ? (
                    <div className="space-y-3">
                      <StatCard
                        icon={Globe2}
                        label="ISP/조직"
                        value={visitorDetail.asnOrg || "Unknown"}
                        variant={visitorDetail.asnType === "business" ? "success" : "default"}
                      />
                      <StatCard
                        icon={Wifi}
                        label="네트워크 유형"
                        value={
                          visitorDetail.asnType === "business"
                            ? "기업 네트워크"
                            : visitorDetail.asnType === "isp"
                              ? "개인 인터넷 (ISP)"
                              : visitorDetail.asnType === "hosting"
                                ? "호스팅/데이터센터"
                                : visitorDetail.asnType || "Unknown"
                        }
                        variant={visitorDetail.asnType === "business" ? "success" : "muted"}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </MotionDiv>

            {/* Visit Stats */}
            <MotionDiv {...(!reducedMotion && { variants: staggerItemVariants })}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Timer className="h-4 w-4 text-primary" />
                    방문 기록
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : visitorDetail ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">총 방문 횟수</span>
                        <span className="font-bold text-2xl">{visitorDetail.visitCount}</span>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">첫 방문</p>
                          <p className="font-medium">
                            {new Date(visitorDetail.firstVisitAt).toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">마지막 방문</p>
                          <p className="font-medium">
                            {new Date(visitorDetail.lastVisitAt).toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </MotionDiv>
          </div>

          {/* Security Flags */}
          <MotionDiv {...(!reducedMotion && { variants: staggerItemVariants })}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-primary" />
                  보안 플래그
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-full" />
                ) : visitorDetail ? (
                  <div className="flex flex-wrap gap-2">
                    <SecurityBadge
                      active={visitorDetail.isVpn}
                      label={visitorDetail.isVpn ? "VPN" : "No VPN"}
                    />
                    <SecurityBadge
                      active={visitorDetail.isProxy}
                      label={visitorDetail.isProxy ? "Proxy" : "No Proxy"}
                    />
                    <SecurityBadge
                      active={visitorDetail.isTor}
                      label={visitorDetail.isTor ? "Tor" : "No Tor"}
                    />
                    <SecurityBadge
                      active={visitorDetail.isDatacenter}
                      label={visitorDetail.isDatacenter ? "Datacenter" : "No Datacenter"}
                    />
                    <Badge
                      className={cn(
                        "gap-1",
                        visitorDetail.isMobile
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-gray-50 text-gray-600",
                      )}
                      variant="outline"
                    >
                      <Smartphone className="h-3 w-3" />
                      {visitorDetail.isMobile ? "Mobile" : "Desktop"}
                    </Badge>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </MotionDiv>

          {/* Footer */}
          <div className="pt-2 text-center">
            <p className="text-muted-foreground text-xs">
              Workspace:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                {WORKSPACE_ID.slice(0, 8)}...
              </code>
              <span className="mx-2">•</span>
              <a className="text-primary hover:underline" href="/settings?tab=visitor-analytics">
                관리 페이지 열기
              </a>
            </p>
          </div>
        </MotionDiv>
      </div>
    </div>
  )
}
