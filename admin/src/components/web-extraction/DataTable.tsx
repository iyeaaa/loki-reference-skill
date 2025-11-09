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

interface DataTableProps {
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
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px] border-r p-1 sticky left-0 bg-background z-10">
                  Website URL
                </TableHead>
                <TableHead className="min-w-[150px] border-r p-1">Found Company</TableHead>
                <TableHead className="min-w-[200px] max-w-[200px] border-r p-1">Email</TableHead>
                <TableHead className="min-w-[250px] border-r p-1">Description</TableHead>
                <TableHead className="min-w-[200px] border-r p-1">Address</TableHead>
                <TableHead className="min-w-[100px] border-r p-1">Country</TableHead>
                <TableHead className="min-w-[120px] border-r p-1">City</TableHead>
                <TableHead className="min-w-[80px] border-r p-1">State</TableHead>
                <TableHead className="min-w-[100px] border-r p-1">Founded</TableHead>
                <TableHead className="min-w-[130px] border-r p-1">Phone</TableHead>
                <TableHead className="min-w-[150px] border-r p-1">Facebook</TableHead>
                <TableHead className="min-w-[150px] border-r p-1">Instagram</TableHead>
                <TableHead className="min-w-[150px] border-r p-1">Twitter</TableHead>
                <TableHead className="min-w-[150px] border-r p-1">LinkedIn</TableHead>
                <TableHead className="min-w-[100px] border-r p-1">Employees</TableHead>
                <TableHead className="min-w-[200px] border-r p-1">Products</TableHead>
                <TableHead className="min-w-[180px] border-r p-1">Sectors</TableHead>
                <TableHead className="min-w-[180px] border-r p-1">Categories</TableHead>
                <TableHead className="min-w-[150px] border-r p-1">Industries</TableHead>
                {/* Dynamic custom search criteria columns */}
                {customCriteriaKeys.map((key) => (
                  <>
                    <TableHead key={`${key}-result`} className="min-w-[120px] border-r p-1">
                      {key}
                    </TableHead>
                    <TableHead key={`${key}-reasons`} className="min-w-[300px] border-r p-1">
                      {key} (근거)
                    </TableHead>
                  </>
                ))}
                <TableHead className="min-w-[100px] border-r p-1">Crawl Time</TableHead>
                <TableHead className="min-w-[100px] border-r p-1">GPT Time</TableHead>
                <TableHead className="min-w-[150px] border-r p-1">Collected At</TableHead>
                <TableHead className="min-w-[200px] border-r p-1">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={`${item.website_url}-${index}`}>
                  <TableCell className="border-r p-1 sticky left-0 bg-background z-10">
                    <TooltipCell content={item.website_url}>
                      {item.website_url ? (
                        <a
                          href={normalizeUrl(item.website_url) || "#"}
                          onClick={(e) => handleWebsiteClick(e, item.website_url)}
                          className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
                        >
                          <span className="line-clamp-2 break-all max-w-[180px]">
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
                      <div className="line-clamp-2 break-words">
                        {item.found_company_name || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.email}>
                      <div className="line-clamp-2 break-all max-w-[200px]">
                        {item.email || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.description}>
                      <div className="line-clamp-2 break-words max-w-[230px]">
                        {item.description || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.address}>
                      <div className="line-clamp-2 break-words">{item.address || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.country}>
                      <div className="line-clamp-2 break-words">{item.country || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.city}>
                      <div className="line-clamp-2 break-words">{item.city || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.state}>
                      <div className="line-clamp-2 break-words">{item.state || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.founded_year}>
                      <div className="line-clamp-2 break-words">{item.founded_year || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.phone_number}>
                      <div className="line-clamp-2 break-words">{item.phone_number || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    {item.facebook_url ? (
                      <TooltipCell content={item.facebook_url}>
                        <a
                          href={normalizeUrl(item.facebook_url) || "#"}
                          onClick={(e) => handleWebsiteClick(e, item.facebook_url)}
                          className="text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span className="line-clamp-2 break-all max-w-[140px]">
                            {item.facebook_url}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </TooltipCell>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="border-r p-1">
                    {item.instagram_url ? (
                      <TooltipCell content={item.instagram_url}>
                        <a
                          href={normalizeUrl(item.instagram_url) || "#"}
                          onClick={(e) => handleWebsiteClick(e, item.instagram_url)}
                          className="text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span className="line-clamp-2 break-all max-w-[140px]">
                            {item.instagram_url}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </TooltipCell>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="border-r p-1">
                    {item.twitter_url ? (
                      <TooltipCell content={item.twitter_url}>
                        <a
                          href={normalizeUrl(item.twitter_url) || "#"}
                          onClick={(e) => handleWebsiteClick(e, item.twitter_url)}
                          className="text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span className="line-clamp-2 break-all max-w-[140px]">
                            {item.twitter_url}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </TooltipCell>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="border-r p-1">
                    {item.linkedin_url ? (
                      <TooltipCell content={item.linkedin_url}>
                        <a
                          href={normalizeUrl(item.linkedin_url) || "#"}
                          onClick={(e) => handleWebsiteClick(e, item.linkedin_url)}
                          className="text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span className="line-clamp-2 break-all max-w-[140px]">
                            {item.linkedin_url}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </TooltipCell>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.employee_count?.toString()}>
                      <div className="line-clamp-2 break-words">{item.employee_count || "-"}</div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.products}>
                      <div className="line-clamp-2 break-words max-w-[180px]">
                        {item.products || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.business_sectors}>
                      <div className="line-clamp-2 break-words max-w-[160px]">
                        {item.business_sectors || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.product_categories}>
                      <div className="line-clamp-2 break-words max-w-[160px]">
                        {item.product_categories || "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.industry_types}>
                      <div className="line-clamp-2 break-words max-w-[130px]">
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
                        <TableCell key={`${key}-result`} className="border-r p-1 text-center">
                          <TooltipCell content={result}>
                            {isTrue ? (
                              <Badge variant="default" className="bg-green-600">
                                true
                              </Badge>
                            ) : isFalse ? (
                              <Badge variant="secondary">false</Badge>
                            ) : (
                              <span className="text-muted-foreground">{result}</span>
                            )}
                          </TooltipCell>
                        </TableCell>
                        <TableCell key={`${key}-reasons`} className="border-r p-1">
                          <TooltipCell content={reasons.join(" | ")}>
                            <div className="text-xs space-y-1">
                              {reasons.length > 0 ? (
                                reasons.map((reason, idx) => (
                                  <div key={idx} className="line-clamp-1 break-words">
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
                      <div className="line-clamp-2 break-words">
                        {item.crawl_time_seconds ? `${item.crawl_time_seconds}s` : "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1 text-right">
                    <TooltipCell
                      content={item.gpt_time_seconds ? `${item.gpt_time_seconds}s` : null}
                    >
                      <div className="line-clamp-2 break-words">
                        {item.gpt_time_seconds ? `${item.gpt_time_seconds}s` : "-"}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1 text-muted-foreground text-xs">
                    <TooltipCell content={formatCollectedAt(item.collected_at)}>
                      <div className="line-clamp-2 break-words">
                        {formatCollectedAt(item.collected_at)}
                      </div>
                    </TooltipCell>
                  </TableCell>
                  <TableCell className="border-r p-1">
                    <TooltipCell content={item.error_message}>
                      {item.error_message ? (
                        <span className="text-red-600 text-xs line-clamp-2 break-words block">
                          {item.error_message}
                        </span>
                      ) : (
                        "-"
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
