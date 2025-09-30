import { Download, FileText, Upload, X } from "lucide-react";
import { useId, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  parseCSV,
  validateCSVData,
  generateCSVTemplate,
  type LeadCSVData,
} from "@/lib/csv-utils";
import { useSuspenseWorkspaces } from "@/lib/api/hooks/workspaces";
import type { CustomerGroup } from "@/lib/api/types/customer-group";

interface CustomerGroupFormProps {
  customerGroup?: CustomerGroup;
  isEdit?: boolean;
  onSave: (customerGroupData: unknown) => Promise<void> | void;
  onCancel: () => void;
}

interface CSVUploadData {
  leads: LeadCSVData[];
  fileName: string;
  fileSize: number;
}

export function CustomerGroupForm({
  customerGroup,
  isEdit = false,
  onSave,
  onCancel,
}: CustomerGroupFormProps) {
  const {
    data: { workspaces },
  } = useSuspenseWorkspaces({ limit: 100 });

  const nameId = useId();
  const descriptionId = useId();
  const isDynamicId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: customerGroup?.name || "",
    description: customerGroup?.description || "",
    workspaceId: customerGroup?.workspaceId || "",
    isDynamic: customerGroup?.isDynamic ?? false,
  });

  // CSV 업로드 관련 상태
  const [csvData, setCsvData] = useState<CSVUploadData | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isProcessingCSV, setIsProcessingCSV] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      csvData: csvData?.leads || undefined,
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvErrors(["CSV 파일만 업로드 가능합니다."]);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB 제한
      setCsvErrors(["파일 크기는 5MB를 초과할 수 없습니다."]);
      return;
    }

    setIsProcessingCSV(true);
    setCsvErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const leads = parseCSV(csvText);
        console.log("leads", leads);
        const validation = validateCSVData(leads);

        if (validation.valid) {
          setCsvData({
            leads,
            fileName: file.name,
            fileSize: file.size,
          });
        } else {
          setCsvErrors(validation.errors);
        }
      } catch (error) {
        console.error("CSV parsing error:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "CSV 파일을 읽는 중 오류가 발생했습니다.";
        setCsvErrors([errorMessage]);
      } finally {
        setIsProcessingCSV(false);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleRemoveCSV = () => {
    setCsvData(null);
    setCsvErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate();
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "customer_group_template.csv";
    link.click();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 기본 정보 섹션 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">기본 정보</h3>

        <div className="space-y-2">
          <Label htmlFor={nameId}>그룹명</Label>
          <Input
            id={nameId}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="고객 그룹명을 입력하세요"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={descriptionId}>설명</Label>
          <Textarea
            id={descriptionId}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="그룹 설명을 입력하세요 (선택사항)"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspace">워크스페이스</Label>
          <Select
            value={formData.workspaceId}
            onValueChange={(value) =>
              setFormData({ ...formData, workspaceId: value })
            }
            disabled={isEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder="워크스페이스 선택" />
            </SelectTrigger>
            {workspaces && workspaces.length === 0 && (
              <SelectContent>
                <SelectItem disabled value="none">
                  워크스페이스가 없습니다.
                </SelectItem>
              </SelectContent>
            )}
            {workspaces && workspaces.length > 0 && (
              <SelectContent className="mt-2 max-h-64 overflow-y-auto">
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            )}
          </Select>
          {isEdit && (
            <p className="text-xs text-muted-foreground">
              워크스페이스는 수정 시 변경할 수 없습니다
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id={isDynamicId}
            checked={formData.isDynamic}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, isDynamic: !!checked })
            }
          />
          <Label htmlFor={isDynamicId} className="text-sm font-normal">
            동적 그룹 (조건에 따라 자동으로 멤버가 업데이트됨)
          </Label>
        </div>
      </div>

      {/* CSV 업로드 섹션 (생성 시에만) */}
      {!isEdit && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">리드 데이터 추가</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              템플릿 다운로드
            </Button>
          </div>

          {!csvData ? (
            <Card>
              <CardContent className="pt-6">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <div className="space-y-2">
                    <h4 className="text-lg font-medium">CSV 파일 업로드</h4>
                    <p className="text-sm text-muted-foreground">
                      리드 데이터가 포함된 CSV 파일을 업로드하여 그룹에 자동으로
                      추가하세요
                    </p>
                    <div className="pt-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingCSV}
                      >
                        {isProcessingCSV ? "처리 중..." : "CSV 파일 선택"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    업로드된 파일
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveCSV}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{csvData.fileName}</span>
                    <span className="text-muted-foreground">
                      {(csvData.fileSize / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {csvData.leads.length}개 리드
                    </Badge>
                    <Badge variant="outline">CSV</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    그룹 생성 시 이 리드들이 자동으로 추가됩니다.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CSV 에러 표시 */}
          {csvErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="space-y-1">
                  {csvErrors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="min-w-[100px]">
          {isEdit ? "수정 완료" : "생성"}
        </Button>
      </div>
    </form>
  );
}
