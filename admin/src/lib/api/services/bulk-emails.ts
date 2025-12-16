import { apiFetch } from "@/lib/api/client"
import type { BulkEmailSendRequest, BulkEmailSendResponse } from "../types/bulk-email"

export const bulkEmailsApi = {
  send: (data: BulkEmailSendRequest) =>
    apiFetch<BulkEmailSendResponse>("/api/v1/bulk-emails/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}
