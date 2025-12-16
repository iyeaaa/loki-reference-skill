import { CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { PreviewLeadData } from "@/lib/api/services/lead-import"

type LeadPreviewArtifactProps = {
  data: {
    totalRows: number
    previewRows: number
    leads: PreviewLeadData[]
    sheetName: string
  }
  onApprove: () => void
  onReject: () => void
  isProcessing?: boolean
}

export function LeadPreviewArtifact({
  data,
  onApprove,
  onReject,
  isProcessing = false,
}: LeadPreviewArtifactProps) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col">
      {/* Header Section */}
      <div className="flex-none space-y-2 px-2 pt-3 pb-2">
        <h2 className="font-semibold text-base">{t("chatbot.leadPreview.title")}</h2>
        <div className="flex items-center gap-2">
          <Badge className="gap-1 font-medium text-xs" variant="secondary">
            <FileSpreadsheet className="h-3 w-3" />
            {data.sheetName}
          </Badge>
          <Badge className="gap-1 font-medium text-xs" variant="outline">
            {t("chatbot.leadPreview.totalRecords", { count: data.totalRows })}
          </Badge>
          <span className="text-muted-foreground text-xs">
            • {t("chatbot.leadPreview.duplicateNote")}
          </span>
        </div>
      </div>

      {/* Data Preview Section */}
      <div className="min-h-0 flex-1 px-2">
        <Card>
          <CardContent className="p-0">
            <div className="h-[calc(100vh-350px)] min-h-[400px] overflow-y-auto overflow-x-scroll">
              <TooltipProvider delayDuration={300}>
                <Table className="w-full table-fixed">
                  <TableHeader className="sticky top-0 z-10 border-b bg-background">
                    <TableRow>
                      <TableHead className="sticky left-0 z-20 w-[50px] border-r bg-white font-medium text-xs dark:bg-background">
                        #
                      </TableHead>
                      <TableHead className="w-[120px] font-medium text-xs">
                        {t("chatbot.leadPreview.column.company")}
                      </TableHead>
                      <TableHead className="w-[140px] font-medium text-xs">
                        {t("chatbot.leadPreview.column.website")}
                      </TableHead>
                      <TableHead className="w-[160px] font-medium text-xs">
                        {t("chatbot.leadPreview.column.email")}
                      </TableHead>
                      <TableHead className="w-[120px] font-medium text-xs">
                        {t("chatbot.leadPreview.column.phone")}
                      </TableHead>
                      <TableHead className="w-[160px] font-medium text-xs">
                        {t("chatbot.leadPreview.column.address")}
                      </TableHead>
                      <TableHead className="w-[120px] font-medium text-xs">
                        {t("chatbot.leadPreview.column.sector")}
                      </TableHead>
                      <TableHead className="w-[120px] font-medium text-xs">
                        {t("chatbot.leadPreview.column.industry")}
                      </TableHead>
                      <TableHead className="w-[140px] font-medium text-xs">
                        {t("chatbot.leadPreview.column.product")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.leads.map((lead, index) => (
                      <TableRow
                        className={index % 2 === 0 ? "bg-muted/30" : ""}
                        key={lead.rowNumber}
                      >
                        <TableCell className="sticky left-0 z-10 border-r bg-white font-mono text-muted-foreground text-xs dark:bg-background">
                          {lead.rowNumber}
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          {lead.companyName ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-default truncate">{lead.companyName}</div>
                              </TooltipTrigger>
                              <TooltipContent
                                className="max-w-xs break-words border border-border bg-background text-foreground shadow-md"
                                side="top"
                              >
                                {lead.companyName}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.websiteUrl ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  className="block truncate text-blue-600 hover:text-blue-800 hover:underline"
                                  href={
                                    lead.websiteUrl.startsWith("http")
                                      ? lead.websiteUrl
                                      : `https://${lead.websiteUrl}`
                                  }
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {lead.websiteUrl}
                                </a>
                              </TooltipTrigger>
                              <TooltipContent
                                className="max-w-xs break-words border border-border bg-background text-foreground shadow-md"
                                side="top"
                              >
                                {lead.websiteUrl}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.emails && lead.emails.length > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-default truncate">
                                  {lead.emails[0]}
                                  {lead.emails.length > 1 && (
                                    <span className="ml-1 text-muted-foreground">
                                      +{lead.emails.length - 1}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                className="max-w-xs break-words border border-border bg-background text-foreground shadow-md"
                                side="top"
                              >
                                {lead.emails.join(", ")}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.phoneNumbers && lead.phoneNumbers.length > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-default truncate">
                                  {lead.phoneNumbers[0]}
                                  {lead.phoneNumbers.length > 1 && (
                                    <span className="ml-1 text-muted-foreground">
                                      +{lead.phoneNumbers.length - 1}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                className="max-w-xs break-words border border-border bg-background text-foreground shadow-md"
                                side="top"
                              >
                                {lead.phoneNumbers.join(", ")}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.address ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-default truncate">{lead.address}</div>
                              </TooltipTrigger>
                              <TooltipContent
                                className="max-w-xs break-words border border-border bg-background text-foreground shadow-md"
                                side="top"
                              >
                                {lead.address}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.businessSectors && lead.businessSectors.length > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex cursor-default items-center gap-0.5 truncate">
                                  {lead.businessSectors.slice(0, 2).map((sector, idx) => (
                                    <Badge
                                      className="shrink-0 px-1.5 py-0 text-[10px]"
                                      key={idx}
                                      variant="outline"
                                    >
                                      {sector}
                                    </Badge>
                                  ))}
                                  {lead.businessSectors.length > 2 && (
                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                      +{lead.businessSectors.length - 2}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                className="max-w-xs border border-border bg-background text-foreground shadow-md"
                                side="top"
                              >
                                <div className="flex flex-wrap gap-1">
                                  {lead.businessSectors.map((sector, idx) => (
                                    <Badge
                                      className="px-1.5 py-0 text-[10px]"
                                      key={idx}
                                      variant="outline"
                                    >
                                      {sector}
                                    </Badge>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.industryTypes && lead.industryTypes.length > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex cursor-default items-center gap-0.5 truncate">
                                  {lead.industryTypes.slice(0, 2).map((industry, idx) => (
                                    <Badge
                                      className="shrink-0 px-1.5 py-0 text-[10px]"
                                      key={idx}
                                      variant="secondary"
                                    >
                                      {industry}
                                    </Badge>
                                  ))}
                                  {lead.industryTypes.length > 2 && (
                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                      +{lead.industryTypes.length - 2}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                className="max-w-xs border border-border bg-background text-foreground shadow-md"
                                side="top"
                              >
                                <div className="flex flex-wrap gap-1">
                                  {lead.industryTypes.map((industry, idx) => (
                                    <Badge
                                      className="px-1.5 py-0 text-[10px]"
                                      key={idx}
                                      variant="secondary"
                                    >
                                      {industry}
                                    </Badge>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.products && lead.products.length > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-default truncate">
                                  {lead.products[0]}
                                  {lead.products.length > 1 && (
                                    <span className="ml-1 text-muted-foreground">
                                      +{lead.products.length - 1}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                className="max-w-xs break-words border border-border bg-background text-foreground shadow-md"
                                side="top"
                              >
                                {lead.products.join(", ")}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Section */}
      <div className="flex-none border-t bg-background px-2 py-2">
        <div className="flex items-center gap-2">
          <Button
            className="flex-1 gap-1.5"
            disabled={isProcessing}
            onClick={onReject}
            size="default"
            variant="outline"
          >
            <XCircle className="h-4 w-4" />
            {t("chatbot.button.cancel")}
          </Button>
          <Button
            className="flex-1 gap-1.5"
            disabled={isProcessing}
            onClick={onApprove}
            size="default"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isProcessing ? t("chatbot.leadPreview.processing") : t("chatbot.leadPreview.approve")}
          </Button>
        </div>
      </div>
    </div>
  )
}
