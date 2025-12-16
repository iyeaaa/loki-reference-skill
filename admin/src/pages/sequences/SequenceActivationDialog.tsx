import { AlertTriangle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type SequenceActivationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  sequenceName: string
}

export function SequenceActivationDialog({
  open,
  onOpenChange,
  onConfirm,
  sequenceName,
}: SequenceActivationDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            시퀀스 활성화
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p className="font-medium text-gray-900">
              "{sequenceName}" 시퀀스를 활성화하시겠습니까?
            </p>
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="font-medium text-blue-900 text-sm">활성화 시 다음 사항이 검증됩니다:</p>
              <ul className="list-inside list-disc space-y-1 text-blue-800 text-sm">
                <li>워크플로우 설정 여부</li>
                <li>모든 노드의 필수 데이터</li>
                <li>노드 간 연결 상태</li>
                <li>순환 참조 여부</li>
              </ul>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-orange-900 text-sm">
                ⚠️ 활성화되면 워크플로우가 자동으로 실행됩니다
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>활성화</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
