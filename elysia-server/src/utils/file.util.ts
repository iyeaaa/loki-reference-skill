import type { SendGridAttachment } from "../models/email.model"
import logger from "./logger"

/**
 * Convert File/Blob to Base64 string for SendGrid attachment
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return buffer.toString("base64")
}

/**
 * Convert uploaded files to SendGrid attachment format
 */
export async function convertFilesToAttachments(files: File[]): Promise<SendGridAttachment[]> {
  const attachments: SendGridAttachment[] = []

  for (const file of files) {
    try {
      const content = await fileToBase64(file)

      attachments.push({
        content,
        filename: file.name,
        type: file.type || "application/octet-stream",
        disposition: "attachment",
      })

      logger.info(
        {
          filename: file.name,
          type: file.type,
          size: file.size,
        },
        "Converted file to attachment",
      )
    } catch (error) {
      logger.error(
        {
          err: error,
          filename: file.name,
        },
        "Failed to convert file to attachment",
      )
      throw error
    }
  }

  return attachments
}

/**
 * Validate file size (SendGrid limit: 30MB total)
 */
export function validateFileSize(files: File[], maxSizeBytes: number = 30 * 1024 * 1024): boolean {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  return totalSize <= maxSizeBytes
}

/**
 * Get total file size in bytes
 */
export function getTotalFileSize(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0)
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`
}
