import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import logger from "../utils/logger"

// S3 클라이언트 초기화
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
})

const BUCKET = process.env.AWS_S3_BUCKET || "send-grid-test-assets"
const REGION = process.env.AWS_REGION || "ap-northeast-2"

/**
 * S3 설정이 유효한지 확인
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  )
}

/**
 * 파일 확장자 추출
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  }
  return mimeToExt[mimeType] || "jpg"
}

/**
 * 고유한 파일 키 생성
 */
function generateUniqueKey(folder: string, userId: string, extension: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${folder}/${userId}/${timestamp}-${random}.${extension}`
}

/**
 * 프로필 이미지 업로드
 * @param userId 사용자 ID
 * @param fileBuffer 파일 버퍼
 * @param mimeType 파일 MIME 타입
 * @returns S3 URL
 */
export async function uploadProfileImage(
  userId: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const extension = getExtensionFromMimeType(mimeType)
  const key = generateUniqueKey("profile-images", userId, extension)

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        CacheControl: "max-age=31536000", // 1년 캐시
      }),
    )

    const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`
    logger.info({ userId, key, url }, "Profile image uploaded to S3")
    return url
  } catch (error) {
    logger.error({ error, userId, key }, "Failed to upload profile image to S3")
    throw new Error("Failed to upload image to S3")
  }
}

/**
 * 워크스페이스 로고 업로드
 * @param workspaceId 워크스페이스 ID
 * @param fileBuffer 파일 버퍼
 * @param mimeType 파일 MIME 타입
 * @returns S3 URL
 */
export async function uploadWorkspaceLogo(
  workspaceId: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const extension = getExtensionFromMimeType(mimeType)
  const key = generateUniqueKey("workspace-logos", workspaceId, extension)

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        CacheControl: "max-age=31536000",
      }),
    )

    const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`
    logger.info({ workspaceId, key, url }, "Workspace logo uploaded to S3")
    return url
  } catch (error) {
    logger.error({ error, workspaceId, key }, "Failed to upload workspace logo to S3")
    throw new Error("Failed to upload image to S3")
  }
}

/**
 * S3에서 이미지 삭제
 * @param imageUrl 삭제할 이미지 URL
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  // S3 URL이 아니면 스킵 (Google 프로필 이미지 등)
  if (!imageUrl.includes(BUCKET)) {
    return
  }

  const key = extractKeyFromUrl(imageUrl)
  if (!key) {
    logger.warn({ imageUrl }, "Could not extract key from S3 URL")
    return
  }

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }),
    )
    logger.info({ key }, "Image deleted from S3")
  } catch (error) {
    logger.error({ error, key }, "Failed to delete image from S3")
    // 삭제 실패해도 에러를 던지지 않음 (이미지가 이미 없을 수 있음)
  }
}

/**
 * S3 URL에서 key 추출
 */
function extractKeyFromUrl(url: string): string | null {
  try {
    // https://bucket.s3.region.amazonaws.com/key 형식
    const urlObj = new URL(url)
    const path = urlObj.pathname
    // 앞의 / 제거
    return path.startsWith("/") ? path.slice(1) : path
  } catch {
    return null
  }
}

/**
 * 이미지 URL이 S3 URL인지 확인
 */
export function isS3Url(url: string | null | undefined): boolean {
  if (!url) return false
  return url.includes(BUCKET) || (url.includes("s3.") && url.includes("amazonaws.com"))
}

/**
 * 이미지 URL이 Base64인지 확인
 */
export function isBase64Image(url: string | null | undefined): boolean {
  if (!url) return false
  return url.startsWith("data:image/")
}
