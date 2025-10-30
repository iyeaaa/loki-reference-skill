/**
 * Lead Upload Helper for Integration Tests
 *
 * Helper functions for uploading lead files to the API
 */

import { parseSSEResponse } from "./sse.helper"

/**
 * Upload an Excel file with leads to the API
 *
 * @param baseUrl - Base URL of the server
 * @param excelBuffer - Buffer containing the Excel file
 * @param workspaceId - Workspace ID to upload to
 * @param token - Authentication token
 * @param groupId - Optional customer group ID
 * @returns The result from the upload operation
 */
export async function uploadExcelFile(
  baseUrl: string,
  excelBuffer: Buffer,
  workspaceId: string,
  token: string,
  groupId?: string,
): Promise<any> {
  const file = new File([excelBuffer], "test.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

  const formData = new FormData()
  formData.append("file", file)
  formData.append("workspaceId", workspaceId)
  if (groupId) {
    formData.append("customerGroupId", groupId)
  }

  const response = await fetch(`${baseUrl}/api/v1/admin/lead-import/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  return parseSSEResponse(response)
}
