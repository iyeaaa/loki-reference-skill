import { useMutation } from "@tanstack/react-query"
import { bulkEmailsApi } from "../services/bulk-emails"
import type { BulkEmailSendRequest } from "../types/bulk-email"

// Mutations
export function useBulkEmailSend() {
  return useMutation({
    mutationFn: (data: BulkEmailSendRequest) => bulkEmailsApi.send(data),
    // 개별 이메일 발송 시 toast를 표시하지 않음 (호출하는 쪽에서 처리)
  })
}
