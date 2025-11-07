/**
 * OpenAI API Key Management Service
 * Workspace별 API 키 관리 및 Round-robin 로직
 */

import { and, asc, eq } from "drizzle-orm"
import { db } from "../db"
import { openaiApiKeys } from "../db/schema"
import logger from "../utils/logger"

/**
 * 간단한 XOR 기반 암호화/복호화 (실제 프로덕션에서는 더 강력한 암호화 사용 권장)
 */
const ENCRYPTION_KEY =
  process.env.API_KEY_ENCRYPTION_SECRET || "your-secret-key-change-in-production"

function encryptApiKey(apiKey: string): string {
  let encrypted = ""
  for (let i = 0; i < apiKey.length; i++) {
    encrypted += String.fromCharCode(
      apiKey.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length),
    )
  }
  return Buffer.from(encrypted).toString("base64")
}

function decryptApiKey(encrypted: string): string {
  const decrypted = Buffer.from(encrypted, "base64").toString()
  let apiKey = ""
  for (let i = 0; i < decrypted.length; i++) {
    apiKey += String.fromCharCode(
      decrypted.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length),
    )
  }
  return apiKey
}

/**
 * Workspace의 모든 활성 API 키 조회
 */
export async function getApiKeys(workspaceId: string) {
  const keys = await db.query.openaiApiKeys.findMany({
    where: and(eq(openaiApiKeys.workspaceId, workspaceId), eq(openaiApiKeys.isActive, true)),
    orderBy: [asc(openaiApiKeys.orderIndex)],
  })

  return keys.map((key) => ({
    ...key,
    apiKey: `${key.apiKey.substring(0, 7)}...${key.apiKey.substring(key.apiKey.length - 4)}`, // 마스킹
  }))
}

/**
 * Workspace의 활성 API 키 개수 조회
 */
export async function getActiveApiKeyCount(workspaceId: string): Promise<number> {
  const keys = await db.query.openaiApiKeys.findMany({
    where: and(eq(openaiApiKeys.workspaceId, workspaceId), eq(openaiApiKeys.isActive, true)),
  })

  return keys.length
}

/**
 * 특정 API 키 조회 (복호화된 전체 키)
 */
export async function getDecryptedApiKey(id: string, workspaceId: string): Promise<string | null> {
  const key = await db.query.openaiApiKeys.findFirst({
    where: and(eq(openaiApiKeys.id, id), eq(openaiApiKeys.workspaceId, workspaceId)),
  })

  if (!key) return null

  return decryptApiKey(key.apiKey)
}

/**
 * Round-robin으로 다음 사용할 API 키 가져오기
 */
export async function getNextApiKey(workspaceId: string): Promise<string | null> {
  const keys = await db.query.openaiApiKeys.findMany({
    where: and(eq(openaiApiKeys.workspaceId, workspaceId), eq(openaiApiKeys.isActive, true)),
    orderBy: [asc(openaiApiKeys.orderIndex)],
  })

  if (keys.length === 0) {
    // workspace에 설정된 API 키가 없으면 환경 변수에서 가져오기
    logger.warn({ workspaceId }, "No API keys configured for workspace, using default from env")
    return process.env.OPENAI_API_KEY || null
  }

  // Round-robin: lastUsedAt이 가장 오래된 키 선택
  let selectedKey = keys[0] as (typeof keys)[0] & object
  for (const key of keys) {
    if (!key.lastUsedAt) {
      selectedKey = key
      break
    }
    if (!selectedKey.lastUsedAt || key.lastUsedAt < selectedKey.lastUsedAt) {
      selectedKey = key
    }
  }

  // 사용 기록 업데이트
  await db
    .update(openaiApiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: selectedKey.usageCount + 1,
    })
    .where(eq(openaiApiKeys.id, selectedKey.id))

  logger.info(
    {
      workspaceId,
      keyId: selectedKey.id,
      keyName: selectedKey.name,
      usageCount: selectedKey.usageCount + 1,
    },
    "Selected API key for use",
  )

  return decryptApiKey(selectedKey.apiKey)
}

/**
 * API 키 생성
 */
export async function createApiKey(data: {
  workspaceId: string
  name: string
  apiKey: string
  orderIndex?: number
}) {
  // 기존 키 개수 확인하여 orderIndex 자동 설정
  const existingKeys = await db.query.openaiApiKeys.findMany({
    where: eq(openaiApiKeys.workspaceId, data.workspaceId),
  })

  const orderIndex = data.orderIndex ?? existingKeys.length

  const [newKey] = await db
    .insert(openaiApiKeys)
    .values({
      workspaceId: data.workspaceId,
      name: data.name,
      apiKey: encryptApiKey(data.apiKey),
      orderIndex,
    })
    .returning()

  if (!newKey) {
    throw new Error("Failed to create API key")
  }

  logger.info(
    { workspaceId: data.workspaceId, keyId: newKey.id, keyName: data.name },
    "API key created",
  )

  return {
    ...newKey,
    apiKey: `${data.apiKey.substring(0, 7)}...${data.apiKey.substring(data.apiKey.length - 4)}`,
  }
}

/**
 * API 키 수정
 */
export async function updateApiKey(
  id: string,
  workspaceId: string,
  data: {
    name?: string
    apiKey?: string
    orderIndex?: number
    isActive?: boolean
  },
) {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.apiKey !== undefined) updateData.apiKey = encryptApiKey(data.apiKey)
  if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  const [updatedKey] = await db
    .update(openaiApiKeys)
    .set(updateData)
    .where(and(eq(openaiApiKeys.id, id), eq(openaiApiKeys.workspaceId, workspaceId)))
    .returning()

  if (!updatedKey) {
    throw new Error("API key not found")
  }

  logger.info({ workspaceId, keyId: id }, "API key updated")

  return {
    ...updatedKey,
    apiKey: updatedKey.apiKey
      ? `${updatedKey.apiKey.substring(0, 7)}...${updatedKey.apiKey.substring(updatedKey.apiKey.length - 4)}`
      : updatedKey.apiKey,
  }
}

/**
 * API 키 삭제
 */
export async function deleteApiKey(id: string, workspaceId: string) {
  const [deletedKey] = await db
    .delete(openaiApiKeys)
    .where(and(eq(openaiApiKeys.id, id), eq(openaiApiKeys.workspaceId, workspaceId)))
    .returning()

  if (!deletedKey) {
    throw new Error("API key not found")
  }

  logger.info({ workspaceId, keyId: id }, "API key deleted")

  return deletedKey
}

/**
 * API 키 순서 재정렬
 */
export async function reorderApiKeys(
  workspaceId: string,
  keyOrder: { id: string; orderIndex: number }[],
) {
  const promises = keyOrder.map(({ id, orderIndex }) =>
    db
      .update(openaiApiKeys)
      .set({ orderIndex, updatedAt: new Date() })
      .where(and(eq(openaiApiKeys.id, id), eq(openaiApiKeys.workspaceId, workspaceId))),
  )

  await Promise.all(promises)

  logger.info({ workspaceId, count: keyOrder.length }, "API keys reordered")
}
