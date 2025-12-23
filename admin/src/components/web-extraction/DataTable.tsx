import { ExternalLink } from "lucide-react"
import type React from "react"
import { useMemo } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExtractionResult } from "@/lib/api/types/web-extraction"
import { formatCollectedAt, normalizeUrl } from "@/utils/web-extraction.utils"
import { TooltipCell } from "./TooltipCell"

type DataTableProps = {
  data: ExtractionResult[]
}

/**
 * Data table component for displaying extraction results
 */
export function DataTable({ data }: DataTableProps) {
  // Collect all unique custom search criteria keys
  const customCriteriaKeys = useMemo(() => {
    const keysSet = new Set<string>()
    data.forEach((item) => {
      if (item.custom_search_results) {
        Object.keys(item.custom_search_results).forEach((key) => {
          keysSet.add(key)
        })
      }
    })
    return Array.from(keysSet)
  }, [data])
  // Handle website link click safely
  const handleWebsiteClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string | null | undefined,
  ) => {
    e.preventDefault()
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl) {
      toast.error("유효하지 않은 URL입니다.")
      return
    }

    try {
      // Validate URL format
      new URL(normalizedUrl)
      window.open(normalizedUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error("유효하지 않은 URL 형식입니다.")
      console.error("Invalid URL:", normalizedUrl, error)
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-max table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 w-[160px] max-w-[160px] border-r bg-background p-1">
                  Website URL
                </TableHead>
                <TableHead className="w-[120px] max-w-[120px] border-r p-1">
                  Found Company
                </TableHead>
                <TableHead className="w-[160px] max-w-[160px] border-r p-1">Email</TableHead>
                <TableHead className="w-[200px] max-w-[200px] border-r p-1">Description</TableHead>
                <TableHead className="w-[150px] max-w-[150px] border-r p-1">Address</TableHead>
                <TableHead className="w-[70px] max-w-[70px] border-r p-1">Country</TableHead>
                <TableHead className="w-[80px] max-w-[80px] border-r p-1">City</TableHead>
                <TableHead className="w-[60px] max-w-[60px] border-r p-1">State</TableHead>
                <TableHead className="w-[70px] max-w-[70px] border-r p-1">Founded</TableHead>
                <TableHead className="w-[110px] max-w-[110px] border-r p-1">Phone</TableHead>
                <TableHead className="w-[120px] max-w-[120px] border-r p-1">Facebook</TableHead>
                <TableHead className="w-[120px] max-w-[120px] border-r p-1">Instagram</TableHead>
                <TableHead className="w-[120px] max-w-[120px] border-r p-1">Twitter</TableHead>
                <TableHead className="w-[120px] max-w-[120px] border-r p-1">LinkedIn</TableHead>
                <TableHead className="w-[70px] max-w-[70px] border-r p-1">Employees</TableHead>
                <TableHead className="w-[150px] max-w-[150px] border-r p-1">Products</TableHead>
                <TableHead className="w-[130px] max-w-[130px] border-r p-1">Sectors</TableHead>
                <TableHead className="w-[130px] max-w-[130px] border-r p-1">Categories</TableHead>
                <TableHead className="w-[120px] max-w-[120px] border-r p-1">Industries</TableHead>
                {/* Dynamic custom search criteria columns */}
                {customCriteriaKeys.map((key) => (
                  <>
                    <TableHead className="w-[80px] max-w-[80px] border-r p-1" key={`${key}-result`}>
                      {key}
                    </TableHead>
                    <TableHead
                      className="w-[200px] max-w-[200px] border-r p-1"
                      key={`${key}-reasons`}
                    >
                      {key} (근거)
                    </TableHead>
                  </>
                ))}
                <TableHead className="w-[70px] max-w-[70px] border-r p-1">Crawl Time</TableHead>
                <TableHead className="w-[70px] max-w-[70px] border-r p-1">GPT Time</TableHead>
                <TableHead className="w-[110px] max-w-[110px] border-r p-1">Collected At</TableHead>
                <TableHead className="w-[150px] max-w-[150px] border-r p-1">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={`${item.website_url}-${index}`}>
                  <TableCell className="sticky left-0 z-10 border-r bg-background p-1">
                    <TooltipCell content={item.website_url}>
                      {item.website_url ? (
                        <a
                          className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                          href={normalizeUrl(item.website_url) || "#"}
                          onClick={(e) => handleWebsiteClick(e, item.website_url)}
                        >
                          <span className="line-clamp-3 max-w-[140px] break-all">
                            {item.website_url}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.found_company_name}>
                      <div className="line-clamp-3 break-words">
                        {item.found_company_name || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.email}>
                      <div className="line-clamp-3 max-w-[140px] break-all">
                        {item.email || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.description}>
                      <div className="line-clamp-3 max-w-[180px] break-words">
                        {item.description || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.address}>
                      <div className="line-clamp-3 break-words">{item.address || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.country}>
                      <div className="line-clamp-3 break-words">{item.country || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.city}>
                      <div className="line-clamp-3 break-words">{item.city || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.state}>
                      <div className="line-clamp-3 break-words">{item.state || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.founded_year}>
                      <div className="line-clamp-3 break-words">{item.founded_year || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.phone_number}>
                      <div className="line-clamp-3 break-words">{item.phone_number || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.facebook_url}>
                      {item.facebook_url ? (
                        <a
                          className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                          href={normalizeUrl(item.facebook_url) || "#"}
                          onClick={(e) => handleWebsiteClick(e, item.facebook_url)}
                        >
                          <span className="line-clamp-3 max-w-[100px] break-all">
                            {item.facebook_url}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.instagram_url}>
                      {item.instagram_url ? (
                        <a
                          className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                          href={normalizeUrl(item.instagram_url) || "#"}
                          onClick={(e) => handleWebsiteClick(e, item.instagram_url)}
                        >
                          <span className="line-clamp-3 max-w-[100px] break-all">
                            {item.instagram_url}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.twitter_url}>
                      {item.twitter_url ? (
                        <a
                          className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                          href={normalizeUrl(item.twitter_url) || "#"}
                          onClick={(e) => handleWebsiteClick(e, item.twitter_url)}
                        >
                          <span className="line-clamp-3 max-w-[100px] break-all">
                            {item.twitter_url}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.linkedin_url}>
                      {item.linkedin_url ? (
                        <a
                          className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                          href={normalizeUrl(item.linkedin_url) || "#"}
                          onClick={(e) => handleWebsiteClick(e, item.linkedin_url)}
                        >
                          <span className="line-clamp-3 max-w-[100px] break-all">
                            {item.linkedin_url}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.employee_count?.toString()}>
                      <div className="line-clamp-3 break-words">{item.employee_count || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.products}>
                      <div className="line-clamp-3 max-w-[130px] break-words">
                        {item.products || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.business_sectors}>
                      <div className="line-clamp-3 max-w-[110px] break-words">
                        {item.business_sectors || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.product_categories}>
                      <div className="line-clamp-3 max-w-[110px] break-words">
                        {item.product_categories || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.industry_types}>
                      <div className="line-clamp-3 max-w-[100px] break-words">
                        {item.industry_types || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  {/* Dynamic custom search criteria cells */}
                  {customCriteriaKeys.map((key) => {
                    const criteriaResult = item.custom_search_results?.[key]
                    const result = criteriaResult?.result || "-"
                    const reasons = criteriaResult?.reasons || []
                    const isTrue = result.toLowerCase() === "true"
                    const isFalse = result.toLowerCase() === "false"

                    return (
                      <>
                        <TableCell className="border-r p-1 text-center" key={`${key}-result`}>
                          <TooltipCell content={result}>
                            {isTrue ? (
                              <Badge className="bg-green-600" variant="default">
                                true
                              </Badge>
                            ) : isFalse ? (
                              <Badge variant="secondary">false</Badge>
                            ) : (
                              <span className="text-muted-foreground">{result}</span>
                            )}
                          </TooltipCell>
                        </TableCell>
                        <TableCell className="border-r p-1" key={`${key}-reasons`}>
                          <TooltipCell content={reasons.join(" | ")}>
                            <div className="space-y-1 text-xs">
                              {reasons.length > 0 ? (
                                reasons.map((reason, idx) => (
                                  <div className="line-clamp-1 break-words" key={idx}>
                                    {idx + 1}. {reason}
                                  </div>
                                ))
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TooltipCell>
                        </TableCell>
                      </>
                    )
                  })}
                  <TableCell className="border-r p-1 text-right">
                    <TooltipCell
                      content={item.crawl_time_seconds ? `${item.crawl_time_seconds}s` : null}
                    >
                      <div className="line-clamp-3 break-words">
                        {item.crawl_time_seconds ? `${item.crawl_time_seconds}s` : "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1 text-right">
                    <TooltipCell
                      content={item.gpt_time_seconds ? `${item.gpt_time_seconds}s` : null}
                    >
                      <div className="line-clamp-3 break-words">
                        {item.gpt_time_seconds ? `${item.gpt_time_seconds}s` : "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1 text-muted-foreground text-xs">
                    <TooltipCell content={formatCollectedAt(item.collected_at)}>
                      <div className="line-clamp-3 break-words">
                        {formatCollectedAt(item.collected_at)}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.error_message}>
                      {item.error_message ? (
                        <span className="line-clamp-3 block break-words text-red-600 text-xs">
                          {item.error_message}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TooltipCell>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
