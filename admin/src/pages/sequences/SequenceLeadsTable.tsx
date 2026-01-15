import { Building2, Calendar, Globe, Mail, MapPin, Search, Users } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSequenceLeads } from "@/lib/api/hooks/sequences"

type SequenceLeadsTableProps = {
  sequenceId: string
}

export function SequenceLeadsTable({ sequenceId }: SequenceLeadsTableProps) {
  const { t } = useTranslation()
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const limit = 10

  const { data: leadsData, isLoading } = useSequenceLeads(
    sequenceId,
    currentPage,
    limit,
    !!sequenceId,
  )

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("sequences.leads.title", "바이어 목록")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            {t("common.loading", "로딩 중...")}
          </div>
        </CardContent>
      </Card>
    )
  }

  const leads = leadsData?.data || []
  const totalPages = leadsData?.totalPages || 1
  const total = leadsData?.total || 0

  // 클라이언트 사이드 검색 필터링
  const filteredLeads = searchQuery.trim()
    ? leads.filter(
        (lead) =>
          lead.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lead.country?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : leads

  const formatDate = (dateString?: string | null) => {
    if (!dateString) {
      return "-"
    }
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const getStatusBadge = (status: string | null) => {
    if (!status) {
      return null
    }

    const statusConfig: Record<
      string,
      { labelKey: string; variant: "default" | "secondary" | "outline" }
    > = {
      new: { labelKey: "sequences.leads.status.new", variant: "default" },
      contacted: { labelKey: "sequences.leads.status.contacted", variant: "secondary" },
      qualified: { labelKey: "sequences.leads.status.qualified", variant: "default" },
      unqualified: { labelKey: "sequences.leads.status.unqualified", variant: "outline" },
      converted: { labelKey: "sequences.leads.status.converted", variant: "default" },
    }

    const config = statusConfig[status] || { labelKey: status, variant: "outline" as const }
    return <Badge variant={config.variant}>{t(config.labelKey, status)}</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t("sequences.leads.title", "바이어 목록")}</span>
          <Badge variant="secondary">
            {t("sequences.leads.totalCount", "총 {{count}}개", { count: total })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 검색 UI */}
        <div className="mb-4">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("sequences.leads.searchPlaceholder", "회사명, 이메일, 국가로 검색...")}
              value={searchQuery}
            />
          </div>
        </div>

        {filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">
              {searchQuery
                ? t("sequences.leads.noSearchResults", "검색 결과가 없습니다")
                : t("sequences.leads.noLeads", "아직 바이어가 없어요")}
            </p>
            {!searchQuery && (
              <p className="mt-1 text-muted-foreground/70 text-sm">
                {t(
                  "sequences.leads.noLeadsDescription",
                  "캠페인을 시작하면 린다가 바이어를 찾아드릴게요!",
                )}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sequences.leads.column.companyName", "회사명")}</TableHead>
                    <TableHead>{t("sequences.leads.column.email", "이메일")}</TableHead>
                    <TableHead>{t("sequences.leads.column.country", "국가")}</TableHead>
                    <TableHead>{t("sequences.leads.column.businessType", "업종")}</TableHead>
                    <TableHead>{t("sequences.leads.column.status", "상태")}</TableHead>
                    <TableHead>{t("sequences.leads.column.createdAt", "등록일")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow className="hover:bg-muted/50" key={lead.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span>{lead.companyName || lead.foundCompanyName || "-"}</span>
                            {lead.websiteUrl && (
                              <a
                                className="flex items-center gap-1 text-muted-foreground text-xs hover:underline"
                                href={lead.websiteUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                <Globe className="h-3 w-3" />
                                {lead.websiteUrl.replace(/^https?:\/\//, "").slice(0, 30)}
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.email ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {lead.email}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.country || lead.city ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {[lead.country, lead.city].filter(Boolean).join(", ")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{lead.businessType || "-"}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(lead.leadStatus)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(lead.createdAt)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  {t("sequences.leads.pagination.page", "페이지 {{current}} / {{total}}", {
                    current: currentPage,
                    total: totalPages,
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    size="sm"
                    variant="outline"
                  >
                    {t("common.previous", "이전")}
                  </Button>
                  <Button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    size="sm"
                    variant="outline"
                  >
                    {t("common.next", "다음")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
