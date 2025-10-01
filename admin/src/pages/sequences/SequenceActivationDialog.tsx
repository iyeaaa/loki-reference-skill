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

interface SequenceActivationDialogProps {
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-blue-900 font-medium">활성화 시 다음 사항이 검증됩니다:</p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>워크플로우 설정 여부</li>
                <li>모든 노드의 필수 데이터</li>
                <li>노드 간 연결 상태</li>
                <li>순환 참조 여부</li>
              </ul>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-900">
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
