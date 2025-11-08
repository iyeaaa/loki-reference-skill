/**
 * Web Data Extraction Utility Functions
 */

/**
 * Format file size to human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

/**
 * Format date for API key display
 */
export const formatDate = (dateString: string | null): string => {
  if (!dateString) return "사용 안함"
  const date = new Date(dateString)
  return date.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Format collected_at date for table display
 */
export const formatCollectedAt = (dateString: string | null | undefined): string => {
  if (!dateString) return "-"
  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return dateString

    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  } catch {
    return dateString
  }
}

/**
 * Mask API key for secure display
 */
export const maskApiKey = (key: string): string => {
  if (key.length <= 8) return "•".repeat(key.length)
  return `${key.slice(0, 7)}${"•".repeat(Math.max(0, key.length - 11))}${key.slice(-4)}`
}

/**
 * Normalize URL to ensure it has a protocol
 */
export const normalizeUrl = (url: string | null | undefined): string | null => {
  if (!url || url.trim() === "") return null

  const trimmedUrl = url.trim()

  // If it already has a protocol, return as is
  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl
  }

  // If it starts with //, add https:
  if (trimmedUrl.startsWith("//")) {
    return `https:${trimmedUrl}`
  }

  // Otherwise, add https://
  return `https://${trimmedUrl}`
}

/**
 * Validate and count URLs in uploaded file
 */
export const validateAndCountUrls = async (
  file: File,
): Promise<{ count: number; error: string | null }> => {
  try {
    const fileExtension = file.name.toLowerCase().split(".").pop()

    if (fileExtension === "csv") {
      const text = await file.text()
      const lines = text.split("\n").filter((line) => line.trim())
      if (lines.length === 0) {
        return { count: 0, error: "파일이 비어있습니다" }
      }

      // Find header row
      const headerLine = lines[0]
      const headers = headerLine.split(",").map((h) => h.trim().toLowerCase())
      const urlColumnIndex = headers.indexOf("website_url")

      if (urlColumnIndex === -1) {
        return { count: 0, error: "website_url 컬럼을 찾을 수 없습니다" }
      }

      // Count non-empty URLs
      const urlCount = lines.slice(1).filter((line) => {
        const values = line.split(",")
        const url = values[urlColumnIndex]?.trim()
        return url && url.length > 0
      }).length

      return { count: urlCount, error: null }
    }

    if (fileExtension === "xlsx" || fileExtension === "xls") {
      // Dynamic import to avoid loading xlsx unless needed
      const XLSX = await import("xlsx")

      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      if (!worksheet) {
        return { count: 0, error: "시트를 읽을 수 없습니다" }
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

      if (jsonData.length === 0) {
        return { count: 0, error: "파일이 비어있습니다" }
      }

      // Find header row
      const headerRow = jsonData[0] as string[]
      const urlColumnIndex = headerRow.findIndex(
        (h) => String(h).trim().toLowerCase() === "website_url",
      )

      if (urlColumnIndex === -1) {
        return { count: 0, error: "website_url 컬럼을 찾을 수 없습니다" }
      }

      // Count non-empty URLs
      const urlCount = jsonData.slice(1).filter((row) => {
        const url = String(row[urlColumnIndex] || "").trim()
        return url && url.length > 0
      }).length

      return { count: urlCount, error: null }
    }

    return { count: 0, error: "지원하지 않는 파일 형식입니다" }
  } catch (err) {
    console.error("File validation error:", err)
    return { count: 0, error: "파일을 읽는 중 오류가 발생했습니다" }
  }
}
