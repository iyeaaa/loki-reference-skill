import { AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ImportResult } from "@/lib/api/services/lead-import"

interface LeadImportArtifactProps {
  result: ImportResult
}

export function LeadImportArtifact({ result }: LeadImportArtifactProps) {
  return (
    <Card className="mt-4 border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          리드 임포트 완료
        </CardTitle>
        <CardDescription>소요 시간: {result.duration}ms</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Statistics */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className="text-base px-3 py-1">
            <CheckCircle2 className="mr-1 h-4 w-4" />
            성공: {result.success}건
          </Badge>
          <Badge variant="secondary" className="text-base px-3 py-1">
            <AlertCircle className="mr-1 h-4 w-4" />
            스킵: {result.skipped}건
          </Badge>
          {result.failed > 0 && (
            <Badge variant="destructive" className="text-base px-3 py-1">
              <XCircle className="mr-1 h-4 w-4" />
              실패: {result.failed}건
            </Badge>
          )}
        </div>

        {/* Detailed Statistics */}
        {result.details && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">리드 생성</div>
              <div className="font-medium">{result.details.leadsCreated}건</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">연락처 생성</div>
              <div className="font-medium">{result.details.contactsCreated}건</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">소셜미디어</div>
              <div className="font-medium">{result.details.socialMediaCreated}건</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">제품</div>
              <div className="font-medium">{result.details.productsCreated}건</div>
            </div>
          </div>
        )}

        {/* Skipped Leads */}
        {result.skippedLeads && result.skippedLeads.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>스킵된 항목 ({result.skippedLeads.length}건)</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {result.skippedLeads.slice(0, 10).map((skipped, index) => (
                  <div key={index} className="text-sm border-l-2 border-yellow-400 pl-2">
                    <div className="font-medium">
                      Row {skipped.rowNumber}: {skipped.companyName || "N/A"}
                    </div>
                    <div className="text-muted-foreground text-xs">{skipped.websiteUrl}</div>
                    <div className="text-yellow-700 dark:text-yellow-300">{skipped.reason}</div>
                  </div>
                ))}
                {result.skippedLeads.length > 10 && (
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    ...그 외 {result.skippedLeads.length - 10}건
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Errors */}
        {result.errors && result.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>실패한 항목 ({result.errors.length}건)</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {result.errors.slice(0, 10).map((error, index) => (
                  <div key={index} className="text-sm border-l-2 border-red-400 pl-2">
                    <div className="font-medium">
                      Row {error.row}: {error.companyName || "N/A"}
                    </div>
                    <div className="text-red-700 dark:text-red-300">{error.error}</div>
                  </div>
                ))}
                {result.errors.length > 10 && (
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    ...그 외 {result.errors.length - 10}건
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
