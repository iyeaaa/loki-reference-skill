/**
 * Google Drive Service
 * Google Drive 공유 URL에서 파일을 다운로드하는 서비스 (API 인증 불필요)
 */

import logger from "../utils/logger"

/**
 * Google Drive URL에서 File ID 추출
 *
 * 지원 형식:
 * - https://drive.google.com/file/d/{FILE_ID}/view
 * - https://drive.google.com/open?id={FILE_ID}
 * - https://drive.google.com/uc?id={FILE_ID}
 */
export function extractFileIdFromUrl(url: string): string | null {
  try {
    // 패턴 1: /file/d/{FILE_ID}/
    const pattern1 = /\/file\/d\/([^/]+)\//
    const match1 = url.match(pattern1)
    if (match1) return match1[1] || null

    // 패턴 2: ?id={FILE_ID} 또는 &id={FILE_ID}
    const pattern2 = /[?&]id=([^&]+)/
    const match2 = url.match(pattern2)
    if (match2) return match2[1] || null

    // 직접 File ID인 경우
    if (url.length > 20 && !url.includes("/") && !url.includes("?")) {
      return url
    }

    return null
  } catch (error) {
    logger.error({ error, url }, "Failed to extract file ID from URL")
    return null
  }
}

/**
 * Google Drive 공유 URL에서 파일 다운로드 (API 인증 불필요)
 *
 * 사용 방법:
 * 1. Google Drive에서 파일 우클릭 → "링크 복사"
 * 2. URL 입력: https://drive.google.com/file/d/{FILE_ID}/view
 * 3. 서버가 자동으로 다운로드
 *
 * 주의: 파일이 "링크가 있는 모든 사용자"로 공유되어 있어야 함
 */
export async function downloadDriveFileFromUrl(driveUrl: string): Promise<{
  fileName: string
  fileBuffer: Buffer
  mimeType: string
}> {
  try {
    // URL에서 File ID 추출
    const fileId = extractFileIdFromUrl(driveUrl)
    if (!fileId) {
      throw new Error("Invalid Google Drive URL. Please check the URL format.")
    }

    logger.info({ fileId, driveUrl }, "Downloading from Drive URL")

    // Google Drive 다운로드 URL 생성
    // 공개 공유 링크는 인증 없이 다운로드 가능
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`

    const response = await fetch(downloadUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })

    if (!response.ok) {
      // 파일이 비공개일 수 있음
      if (response.status === 403) {
        throw new Error(
          "File is not publicly accessible. Please set sharing to 'Anyone with the link can view'",
        )
      }
      throw new Error(`Failed to download file: ${response.statusText}`)
    }

    // Content-Disposition 헤더에서 파일명 추출
    const contentDisposition = response.headers.get("content-disposition")
    let fileName = "downloaded-file.csv"
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition)
      if (matches?.[1]) {
        fileName = matches[1].replace(/['"]/g, "")
      }
    }

    // Content-Type에서 MIME 타입 추출
    const mimeType = response.headers.get("content-type") || "text/csv"

    const arrayBuffer = await response.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    logger.info(
      { fileId, fileName, downloadedSize: fileBuffer.length, mimeType },
      "Drive file downloaded successfully",
    )

    // 파일 확장자 확인 및 수정
    if (mimeType.includes("csv") && !fileName.endsWith(".csv")) {
      fileName = `${fileName}.csv`
    }

    return {
      fileName,
      fileBuffer,
      mimeType,
    }
  } catch (error) {
    logger.error({ error, driveUrl }, "Failed to download from Drive URL")
    throw error
  }
}

/**
 * Google Drive 공유 링크 유효성 검증
 */
export function validateDriveUrl(url: string): { isValid: boolean; message?: string } {
  const fileId = extractFileIdFromUrl(url)

  if (!fileId) {
    return {
      isValid: false,
      message: "Invalid Google Drive URL format",
    }
  }

  if (fileId.length < 20) {
    return {
      isValid: false,
      message: "File ID seems too short",
    }
  }

  return { isValid: true }
}
