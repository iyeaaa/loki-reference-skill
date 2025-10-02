import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { SequenceStep } from "@/lib/api/types/sequence";

interface SequenceStepFormProps {
  step?: SequenceStep;
  stepOrder: number;
  onSave: (stepData: {
    stepOrder: number;
    delayDays: number;
    emailSubject: string;
    emailBodyText?: string;
    emailBodyHtml?: string;
  }) => void;
  onCancel: () => void;
}

export function SequenceStepForm({
  step,
  stepOrder,
  onSave,
  onCancel,
}: SequenceStepFormProps) {
  const stepOrderId = useId();
  const subjectId = useId();
  const delayDaysId = useId();
  const bodyTextId = useId();

  const [formData, setFormData] = useState({
    stepOrder: step?.stepOrder ?? stepOrder,
    delayDays: step?.delayDays ?? 0,
    emailSubject: step?.emailSubject || "",
    emailBodyText: step?.emailBodyText || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={stepOrderId}>
            스텝 순서 <span className="text-red-500">*</span>
          </Label>
          <Input
            id={stepOrderId}
            type="number"
            min="1"
            value={formData.stepOrder}
            onChange={(e) =>
              setFormData({
                ...formData,
                stepOrder: parseInt(e.target.value, 10) || 1,
              })
            }
            required
            placeholder="예: 1"
          />
          <p className="text-xs text-muted-foreground">이메일 발송 순서</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={delayDaysId}>
            발송 지연 일수 <span className="text-red-500">*</span>
          </Label>
          <Input
            id={delayDaysId}
            type="number"
            min="0"
            value={formData.delayDays}
            onChange={(e) =>
              setFormData({
                ...formData,
                delayDays: parseInt(e.target.value, 10) || 0,
              })
            }
            required
            placeholder="예: 3"
          />
          <p className="text-xs text-muted-foreground">
            이전 스텝 후 며칠 뒤 발송
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={subjectId}>
          이메일 제목 <span className="text-red-500">*</span>
        </Label>
        <Input
          id={subjectId}
          value={formData.emailSubject}
          onChange={(e) =>
            setFormData({ ...formData, emailSubject: e.target.value })
          }
          required
          maxLength={500}
          placeholder="예: K-Beauty Partnership Opportunity with {{company_name}}"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={bodyTextId}>이메일 본문</Label>
        <RichTextEditor
          value={formData.emailBodyText || ""}
          onChange={(value) =>
            setFormData({ ...formData, emailBodyText: value })
          }
          placeholder={`Dear {{company_name}} team,

I hope this email finds you well. I am reaching out from a Korean beauty company specializing in innovative skincare and cosmetics products.

We noticed your business in {{city}}, {{country}} and believe there could be a great partnership opportunity. Our K-Beauty products are currently exported to over 30 countries and have received excellent feedback from international buyers.

Would you be interested in exploring a distribution partnership? We offer:
• Competitive pricing for wholesale buyers
• High-quality Korean beauty products with proven results
• Full marketing and product training support
• Flexible MOQ (Minimum Order Quantity)

I would love to schedule a brief call to discuss how we can work together.

Best regards,
[Your Name]
[Your Company]`}
          height="300px"
        />
        <div className="text-xs text-muted-foreground space-y-2 mt-2">
          <p className="font-medium">사용 가능한 변수:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="space-y-1">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                회사 정보:
              </p>
              <ul className="space-y-0.5 ml-2">
                <li>{"{{회사명}}"}</li>
                <li>{"{{웹사이트}}"}</li>
                <li>{"{{업종}}"}</li>
                <li>{"{{설명}}"}</li>
                <li>{"{{직원수}}"}</li>
                <li>{"{{설립연도}}"}</li>
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                위치 정보:
              </p>
              <ul className="space-y-0.5 ml-2">
                <li>{"{{국가}}"}</li>
                <li>{"{{도시}}"}</li>
                <li>{"{{주/도}}"}</li>
                <li>{"{{주소}}"}</li>
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                연락처:
              </p>
              <ul className="space-y-0.5 ml-2">
                <li>{"{{담당자명}}"}</li>
                <li>{"{{이메일}}"}</li>
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                리드 관리:
              </p>
              <ul className="space-y-0.5 ml-2">
                <li>{"{{리드소스}}"}</li>
                <li>{"{{리드상태}}"}</li>
                <li>{"{{리드점수}}"}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="min-w-[100px]">
          {step ? "수정 완료" : "스텝 추가"}
        </Button>
      </div>
    </form>
  );
}
