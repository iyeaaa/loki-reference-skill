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

interface LeadPreviewArtifactProps {
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
    <div className="flex flex-col h-full">
      {/* Header Section */}
      <div className="flex-none px-2 pt-3 pb-2 space-y-2">
        <h2 className="text-base font-semibold">{t("chatbot.leadPreview.title")}</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-xs font-medium">
            <FileSpreadsheet className="h-3 w-3" />
            {data.sheetName}
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs font-medium">
            {t("chatbot.leadPreview.totalRecords", { count: data.totalRows })}
          </Badge>
          <span className="text-xs text-muted-foreground">
            • {t("chatbot.leadPreview.duplicateNote")}
          </span>
        </div>
      </div>

      {/* Data Preview Section */}
      <div className="flex-1 min-h-0 px-2">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-scroll overflow-y-auto h-[calc(100vh-350px)] min-h-[400px]">
              <TooltipProvider delayDuration={300}>
                <Table className="table-fixed w-full">
                  <TableHeader className="sticky top-0 bg-background z-10 border-b">
                    <TableRow>
                      <TableHead className="w-[50px] text-xs font-medium sticky left-0 bg-white dark:bg-background z-20 border-r">
                        #
                      </TableHead>
                      <TableHead className="w-[120px] text-xs font-medium">
                        {t("chatbot.leadPreview.column.company")}
                      </TableHead>
                      <TableHead className="w-[140px] text-xs font-medium">
                        {t("chatbot.leadPreview.column.website")}
                      </TableHead>
                      <TableHead className="w-[160px] text-xs font-medium">
                        {t("chatbot.leadPreview.column.email")}
                      </TableHead>
                      <TableHead className="w-[120px] text-xs font-medium">
                        {t("chatbot.leadPreview.column.phone")}
                      </TableHead>
                      <TableHead className="w-[160px] text-xs font-medium">
                        {t("chatbot.leadPreview.column.address")}
                      </TableHead>
                      <TableHead className="w-[120px] text-xs font-medium">
                        {t("chatbot.leadPreview.column.sector")}
                      </TableHead>
                      <TableHead className="w-[120px] text-xs font-medium">
                        {t("chatbot.leadPreview.column.industry")}
                      </TableHead>
                      <TableHead className="w-[140px] text-xs font-medium">
                        {t("chatbot.leadPreview.column.product")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.leads.map((lead, index) => (
                      <TableRow
                        key={lead.rowNumber}
                        className={index % 2 === 0 ? "bg-muted/30" : ""}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground sticky left-0 bg-white dark:bg-background z-10 border-r">
                          {lead.rowNumber}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {lead.companyName ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate cursor-default">{lead.companyName}</div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs break-words bg-background border border-border text-foreground shadow-md"
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
                                  href={
                                    lead.websiteUrl.startsWith("http")
                                      ? lead.websiteUrl
                                      : `https://${lead.websiteUrl}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="truncate block text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {lead.websiteUrl}
                                </a>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs break-words bg-background border border-border text-foreground shadow-md"
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
                                <div className="truncate cursor-default">
                                  {lead.emails[0]}
                                  {lead.emails.length > 1 && (
                                    <span className="text-muted-foreground ml-1">
                                      +{lead.emails.length - 1}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs break-words bg-background border border-border text-foreground shadow-md"
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
                                <div className="truncate cursor-default">
                                  {lead.phoneNumbers[0]}
                                  {lead.phoneNumbers.length > 1 && (
                                    <span className="text-muted-foreground ml-1">
                                      +{lead.phoneNumbers.length - 1}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs break-words bg-background border border-border text-foreground shadow-md"
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
                                <div className="truncate cursor-default">{lead.address}</div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs break-words bg-background border border-border text-foreground shadow-md"
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
                                <div className="truncate cursor-default flex items-center gap-0.5">
                                  {lead.businessSectors.slice(0, 2).map((sector, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 shrink-0"
                                    >
                                      {sector}
                                    </Badge>
                                  ))}
                                  {lead.businessSectors.length > 2 && (
                                    <span className="text-muted-foreground text-[10px] shrink-0">
                                      +{lead.businessSectors.length - 2}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs bg-background border border-border text-foreground shadow-md"
                              >
                                <div className="flex flex-wrap gap-1">
                                  {lead.businessSectors.map((sector, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0"
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
                                <div className="truncate cursor-default flex items-center gap-0.5">
                                  {lead.industryTypes.slice(0, 2).map((industry, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 shrink-0"
                                    >
                                      {industry}
                                    </Badge>
                                  ))}
                                  {lead.industryTypes.length > 2 && (
                                    <span className="text-muted-foreground text-[10px] shrink-0">
                                      +{lead.industryTypes.length - 2}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs bg-background border border-border text-foreground shadow-md"
                              >
                                <div className="flex flex-wrap gap-1">
                                  {lead.industryTypes.map((industry, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0"
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
                                <div className="truncate cursor-default">
                                  {lead.products[0]}
                                  {lead.products.length > 1 && (
                                    <span className="text-muted-foreground ml-1">
                                      +{lead.products.length - 1}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs break-words bg-background border border-border text-foreground shadow-md"
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
      <div className="flex-none px-2 py-2 border-t bg-background">
        <div className="flex items-center gap-2">
          <Button
            onClick={onReject}
            variant="outline"
            disabled={isProcessing}
            className="gap-1.5 flex-1"
            size="default"
          >
            <XCircle className="h-4 w-4" />
            {t("chatbot.button.cancel")}
          </Button>
          <Button
            onClick={onApprove}
            disabled={isProcessing}
            className="gap-1.5 flex-1"
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
