import { and, count, desc, eq, ilike, inArray, lte, ne, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "../db/index"
import { customerGroups } from "../db/schema/customer-groups"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emailReplies, emails as emailsTable } from "../db/schema/emails"
import { leadContacts } from "../db/schema/lead-details"
import { leads } from "../db/schema/leads"
import {
  sequenceEnrollments,
  sequenceStepExecutions,
  sequenceSteps,
  sequences,
} from "../db/schema/sequences"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"
import { calculateScheduledTime } from "../utils/timezone"

// ====================================
// SEQUENCE CRUD OPERATIONS
// ====================================

// GetSequence :one
export async function getSequence(id: string) {
  const result = await db
    .select({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      memo: sequences.memo,
      status: sequences.status,
      workflowData: sequences.workflowData,
      selectedLeadIds: sequences.selectedLeadIds,
      createdBy: sequences.createdBy,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
      workspaceName: workspaces.name,
      customerGroupName: customerGroups.name,
      createdByUsername: users.username,
      createdByEmail: users.email,
    })
    .from(sequences)
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
    .leftJoin(customerGroups, eq(sequences.customerGroupId, customerGroups.id))
    .leftJoin(users, eq(sequences.createdBy, users.id))
    .where(eq(sequences.id, id))
    .limit(1)

  return result[0]
}

// CreateSequence :one
export async function createSequence(data: {
  workspaceId: string
  customerGroupId?: string
  name: string
  description?: string
  memo?: string
  status?: "draft" | "ready" | "active" | "paused" | "archived"
  workflowData?: string
  selectedLeadIds?: string[] // Array of lead IDs to target
  createdBy?: string
}) {
  const { default: logger } = await import("../utils/logger")
  logger.info(
    {
      customerGroupId: data.customerGroupId,
      selectedLeadIds: data.selectedLeadIds,
      selectedLeadIdsLength: data.selectedLeadIds?.length,
    },
    "📝 Creating sequence with data",
  )

  const [newSequence] = await db
    .insert(sequences)
    .values({
      workspaceId: data.workspaceId,
      customerGroupId: data.customerGroupId,
      name: data.name,
      description: data.description || null,
      memo: data.memo || null,
      status: data.status || "draft",
      workflowData: data.workflowData || null,
      selectedLeadIds: data.selectedLeadIds ? JSON.stringify(data.selectedLeadIds) : null,
      createdBy: data.createdBy || null,
    })
    .returning({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      memo: sequences.memo,
      status: sequences.status,
      workflowData: sequences.workflowData,
      selectedLeadIds: sequences.selectedLeadIds,
      createdBy: sequences.createdBy,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
    })

  return newSequence
}

// UpdateSequence :one
export async function updateSequence(
  id: string,
  data: {
    name?: string
    description?: string
    memo?: string
    status?: "draft" | "ready" | "active" | "paused" | "archived"
    workflowData?: string
    customerGroupId?: string
    selectedLeadIds?: string[] // Array of lead IDs to target
  },
) {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.memo !== undefined) updateData.memo = data.memo
  if (data.status !== undefined) updateData.status = data.status
  if (data.workflowData !== undefined) updateData.workflowData = data.workflowData
  if (data.customerGroupId !== undefined) updateData.customerGroupId = data.customerGroupId
  if (data.selectedLeadIds !== undefined) {
    // Always stringify arrays, including empty arrays []
    const stringifiedLeadIds = Array.isArray(data.selectedLeadIds)
      ? JSON.stringify(data.selectedLeadIds)
      : null
    updateData.selectedLeadIds = stringifiedLeadIds
  }

  const [updatedSequence] = await db
    .update(sequences)
    .set(updateData)
    .where(eq(sequences.id, id))
    .returning({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      memo: sequences.memo,
      status: sequences.status,
      workflowData: sequences.workflowData,
      selectedLeadIds: sequences.selectedLeadIds,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
    })

  if (!updatedSequence) {
    throw new Error("Failed to update sequence")
  }

  // logger.info(
  //   {
  //     sequenceId: id,
  //     savedSequence: {
  //       customerGroupId: updatedSequence.customerGroupId,
  //       selectedLeadIds: updatedSequence.selectedLeadIds,
  //     },
  //   },
  //   "✅ Sequence updated successfully",
  // )

  return updatedSequence
}

// DeleteSequence :exec
export async function deleteSequence(id: string) {
  await db.delete(sequences).where(eq(sequences.id, id))
}

// CopySequence :one - 시퀀스 복사 (스텝 포함)
export async function copySequence(
  sequenceId: string,
  data?: {
    name?: string
    customerGroupId?: string
    selectedLeadIds?: string[]
    createdBy?: string
  },
) {
  // 1. 원본 시퀀스 조회
  const originalSequence = await db
    .select()
    .from(sequences)
    .where(eq(sequences.id, sequenceId))
    .limit(1)

  if (!originalSequence.length || !originalSequence[0]) {
    throw new Error("원본 시퀀스를 찾을 수 없습니다.")
  }

  const original = originalSequence[0]

  // 2. 중복 이름 체크 및 자동 넘버링
  let newName = data?.name || original.name
  if (!data?.name) {
    // 같은 워크스페이스에서 동일한 이름으로 시작하는 시퀀스 찾기
    const existingSequences = await db
      .select({ name: sequences.name })
      .from(sequences)
      .where(
        and(
          eq(sequences.workspaceId, original.workspaceId),
          or(eq(sequences.name, original.name), ilike(sequences.name, `${original.name} (%)`)),
        ),
      )

    // 숫자 추출 및 최대값 찾기
    const numbers: number[] = []
    for (const seq of existingSequences) {
      if (seq.name === original.name) {
        numbers.push(1)
      } else {
        const match = seq.name.match(/\((\d+)\)$/)
        if (match?.[1]) {
          numbers.push(parseInt(match[1], 10))
        }
      }
    }

    if (numbers.length > 0) {
      const maxNumber = Math.max(...numbers)
      newName = `${original.name} (${maxNumber + 1})`
    }
  }

  // 3. 새 시퀀스 생성
  const result = await db
    .insert(sequences)
    .values({
      workspaceId: original.workspaceId,
      customerGroupId: data?.customerGroupId || original.customerGroupId,
      name: newName,
      description: original.description,
      status: "draft", // 복사본은 항상 draft 상태로
      workflowData: original.workflowData,
      selectedLeadIds: data?.selectedLeadIds
        ? JSON.stringify(data.selectedLeadIds)
        : original.selectedLeadIds,
      createdBy: data?.createdBy || original.createdBy,
    })
    .returning({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      workflowData: sequences.workflowData,
      selectedLeadIds: sequences.selectedLeadIds,
      createdBy: sequences.createdBy,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
    })

  const copiedSequence = result[0]
  if (!copiedSequence) {
    throw new Error("시퀀스 복사에 실패했습니다.")
  }

  // 4. 원본 시퀀스의 스텝들 복사
  const originalSteps = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, sequenceId))
    .orderBy(sequenceSteps.stepOrder)

  if (originalSteps.length > 0) {
    const copiedStepsData = originalSteps.map((step) => ({
      sequenceId: copiedSequence.id,
      stepOrder: step.stepOrder,
      delayDays: step.delayDays,
      scheduledHour: step.scheduledHour,
      scheduledMinute: step.scheduledMinute,
      timezone: step.timezone,
      emailSubject: step.emailSubject,
      emailBodyText: step.emailBodyText,
      emailBodyHtml: step.emailBodyHtml,
      emailTemplateId: step.emailTemplateId,
      generationSource: step.generationSource,
    }))

    const { default: logger } = await import("../utils/logger")
    logger.info(
      {
        originalSequenceId: sequenceId,
        copiedSequenceId: copiedSequence.id,
        stepsCount: originalSteps.length,
        originalSteps: originalSteps.map((s) => ({
          id: s.id,
          stepOrder: s.stepOrder,
          scheduledHour: s.scheduledHour,
          scheduledMinute: s.scheduledMinute,
        })),
      },
      "📋 시퀀스 스텝 복사 중",
    )

    const insertedSteps = await db.insert(sequenceSteps).values(copiedStepsData).returning()

    logger.info(
      {
        copiedSequenceId: copiedSequence.id,
        insertedStepsCount: insertedSteps.length,
        insertedSteps: insertedSteps.map((s) => ({
          id: s.id,
          stepOrder: s.stepOrder,
          scheduledHour: s.scheduledHour,
          scheduledMinute: s.scheduledMinute,
        })),
      },
      "✅ 시퀀스 스텝 복사 완료 (새로운 스텝 ID로 생성됨)",
    )
  }

  return copiedSequence
}

// ====================================
// SEQUENCE QUERY OPERATIONS
// ====================================

// ListSequences :many
export async function listSequences(limit: number, offset: number) {
  const result = await db
    .select({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      selectedLeadIds: sequences.selectedLeadIds,
      createdBy: sequences.createdBy,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
      workspaceName: workspaces.name,
      customerGroupName: customerGroups.name,
      createdByUsername: users.username,
    })
    .from(sequences)
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
    .leftJoin(customerGroups, eq(sequences.customerGroupId, customerGroups.id))
    .leftJoin(users, eq(sequences.createdBy, users.id))
    .orderBy(desc(sequences.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListSequencesWithFilters :many
export async function listSequencesWithFilters(
  limit: number,
  offset: number,
  filters?: {
    status?: "draft" | "active" | "paused" | "archived"
    search?: string
    workspaceIds?: string[]
    createdByIds?: string[]
  },
) {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(sequences.status, filters.status))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(sequences.name, `%${filters.search}%`),
      ilike(sequences.description, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(sequences.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    const createdByCondition = or(...filters.createdByIds.map((id) => eq(sequences.createdBy, id)))
    if (createdByCondition) {
      conditions.push(createdByCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      createdBy: sequences.createdBy,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
      workspaceName: workspaces.name,
      createdByUsername: users.username,
      createdByEmail: users.email,
      stepsCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${sequenceSteps}
        WHERE ${sequenceSteps.sequenceId} = ${sequences.id}
      )`,
      currentMaxStep: sql<number>`(
        SELECT COALESCE(MAX(${sequenceEnrollments.currentStepOrder}), 0)::int
        FROM ${sequenceEnrollments}
        WHERE ${sequenceEnrollments.sequenceId} = ${sequences.id}
      )`,
      enrollmentsCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${sequenceEnrollments}
        WHERE ${sequenceEnrollments.sequenceId} = ${sequences.id}
      )`,
      completedEnrollmentsCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${sequenceEnrollments}
        WHERE ${sequenceEnrollments.sequenceId} = ${sequences.id}
        AND ${sequenceEnrollments.status} = 'completed'
      )`,
      sentCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${emailsTable}
        WHERE ${emailsTable.sequenceId} = ${sequences.id}
        AND ${emailsTable.direction} = 'outbound'
      )`,
      deliveredCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${emailsTable}
        WHERE ${emailsTable.sequenceId} = ${sequences.id}
        AND ${emailsTable.direction} = 'outbound'
        AND ${emailsTable.deliveredAt} IS NOT NULL
      )`,
      openedCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${emailsTable}
        WHERE ${emailsTable.sequenceId} = ${sequences.id}
        AND ${emailsTable.direction} = 'outbound'
        AND ${emailsTable.openedAt} IS NOT NULL
      )`,
      repliedCount: sql<number>`(
        SELECT COUNT(DISTINCT ${emailReplies.originalEmailId})::int
        FROM ${emailReplies}
        INNER JOIN ${emailsTable} ON ${emailReplies.originalEmailId} = ${emailsTable.id}
        WHERE ${emailsTable.sequenceId} = ${sequences.id}
        AND ${emailsTable.direction} = 'outbound'
      )`,
      customerGroupId: sequences.customerGroupId,
      customerGroupName: customerGroups.name,
      selectedLeadIds: sequences.selectedLeadIds,
      // Email metrics
      totalSent: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${emailsTable}
        WHERE ${emailsTable.sequenceId} = ${sequences.id}
        AND ${emailsTable.direction} = 'outbound'
        AND ${emailsTable.sentAt} IS NOT NULL
      )`,
      totalOpened: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${emailsTable}
        WHERE ${emailsTable.sequenceId} = ${sequences.id}
        AND ${emailsTable.direction} = 'outbound'
        AND ${emailsTable.openedAt} IS NOT NULL
      )`,
      totalReplied: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${emailsTable}
        WHERE ${emailsTable.sequenceId} = ${sequences.id}
        AND ${emailsTable.direction} = 'outbound'
        AND ${emailsTable.repliedAt} IS NOT NULL
      )`,
    })
    .from(sequences)
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
    .leftJoin(customerGroups, eq(sequences.customerGroupId, customerGroups.id))
    .leftJoin(users, eq(sequences.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(sequences.createdAt))
    .limit(limit)
    .offset(offset)

  // Calculate rates
  return result.map((seq) => ({
    ...seq,
    openRate: seq.totalSent > 0 ? Math.round((seq.totalOpened / seq.totalSent) * 100) : 0,
    replyRate: seq.totalSent > 0 ? Math.round((seq.totalReplied / seq.totalSent) * 100) : 0,
  }))
}

// GetSequencesByWorkspace :many
export async function getSequencesByWorkspace(workspaceId: string) {
  const result = await db
    .select({
      id: sequences.id,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      selectedLeadIds: sequences.selectedLeadIds,
      createdAt: sequences.createdAt,
      customerGroupName: customerGroups.name,
    })
    .from(sequences)
    .leftJoin(customerGroups, eq(sequences.customerGroupId, customerGroups.id))
    .where(eq(sequences.workspaceId, workspaceId))
    .orderBy(desc(sequences.createdAt))

  return result
}

// ====================================
// SEQUENCE STEPS OPERATIONS
// ====================================

// GetSequenceSteps :many (with execution count for each step)
export async function getSequenceSteps(sequenceId: string) {
  const result = await db
    .select({
      id: sequenceSteps.id,
      sequenceId: sequenceSteps.sequenceId,
      stepOrder: sequenceSteps.stepOrder,
      delayDays: sequenceSteps.delayDays,
      scheduledHour: sequenceSteps.scheduledHour,
      scheduledMinute: sequenceSteps.scheduledMinute,
      timezone: sequenceSteps.timezone,
      emailSubject: sequenceSteps.emailSubject,
      emailBodyText: sequenceSteps.emailBodyText,
      emailBodyHtml: sequenceSteps.emailBodyHtml,
      emailTemplateId: sequenceSteps.emailTemplateId,
      generationSource: sequenceSteps.generationSource,
      createdAt: sequenceSteps.createdAt,
      updatedAt: sequenceSteps.updatedAt,
    })
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, sequenceId))
    .orderBy(sequenceSteps.stepOrder)

  // Get execution counts for each step (how many times each step was sent)
  const executionCounts = await db
    .select({
      stepId: sequenceStepExecutions.stepId,
      executionCount: count(sequenceStepExecutions.id),
    })
    .from(sequenceStepExecutions)
    .where(
      and(
        inArray(
          sequenceStepExecutions.stepId,
          result.map((s) => s.id),
        ),
        // Only count sent executions (not pending or failed)
        eq(sequenceStepExecutions.status, "sent"),
      ),
    )
    .groupBy(sequenceStepExecutions.stepId)

  // Create a map of stepId -> executionCount
  const executionCountMap = new Map<string, number>()
  for (const ec of executionCounts) {
    executionCountMap.set(ec.stepId, ec.executionCount)
  }

  // Merge execution counts into result
  return result.map((step) => ({
    ...step,
    executionCount: executionCountMap.get(step.id) || 0,
  }))
}

// CreateSequenceStep :one
export async function createSequenceStep(data: {
  sequenceId: string
  stepOrder: number
  delayDays: number
  scheduledHour?: number
  scheduledMinute?: number
  timezone?: string
  emailSubject: string
  emailBodyText?: string
  emailBodyHtml?: string
  emailTemplateId?: string
  generationSource?: "ai" | "manual" | "template"
  attachments?: Array<{
    filename: string
    type: string
    content: string
  }> | null
}) {
  // Markdown을 HTML로 변환
  const { markdownToHtml } = await import("../utils/markdown")
  // emailBodyHtml이 이미 제공되면 그대로 사용 (서명 포함)
  // 없으면 emailBodyText를 markdownToHtml로 변환
  // 주의: data.emailBodyHtml이 undefined나 null일 때만 markdownToHtml 사용
  // 빈 문자열("")도 유효한 값이므로 체크해야 함
  const emailBodyHtml =
    data.emailBodyHtml !== undefined && data.emailBodyHtml !== null
      ? data.emailBodyHtml
      : data.emailBodyText
        ? markdownToHtml(data.emailBodyText)
        : null

  const [newStep] = await db
    .insert(sequenceSteps)
    .values({
      sequenceId: data.sequenceId,
      stepOrder: data.stepOrder,
      delayDays: data.delayDays,
      scheduledHour: data.scheduledHour ?? 9,
      scheduledMinute: data.scheduledMinute ?? 0,
      timezone: data.timezone ?? "Asia/Seoul",
      emailSubject: data.emailSubject,
      emailBodyText: data.emailBodyText || null,
      emailBodyHtml: emailBodyHtml,
      emailTemplateId: data.emailTemplateId || null,
      generationSource: data.generationSource ?? "manual",
      attachments: data.attachments || null,
    })
    .returning({
      id: sequenceSteps.id,
      sequenceId: sequenceSteps.sequenceId,
      stepOrder: sequenceSteps.stepOrder,
      delayDays: sequenceSteps.delayDays,
      scheduledHour: sequenceSteps.scheduledHour,
      scheduledMinute: sequenceSteps.scheduledMinute,
      timezone: sequenceSteps.timezone,
      emailSubject: sequenceSteps.emailSubject,
      generationSource: sequenceSteps.generationSource,
      attachments: sequenceSteps.attachments,
      createdAt: sequenceSteps.createdAt,
      updatedAt: sequenceSteps.updatedAt,
    })

  return newStep
}

// UpdateSequenceStep :one
export async function updateSequenceStep(
  id: string,
  data: {
    stepOrder: number
    delayDays: number
    scheduledHour?: number
    scheduledMinute?: number
    timezone?: string
    emailSubject: string
    emailBodyText?: string
    emailBodyHtml?: string
    emailTemplateId?: string
    generationSource?: "ai" | "manual" | "template"
    attachments?: Array<{
      filename: string
      type: string
      content: string
    }> | null
  },
) {
  const { default: logger } = await import("../utils/logger")

  // 1. 현재 스텝 정보 조회
  const [currentStep] = await db
    .select({
      id: sequenceSteps.id,
      sequenceId: sequenceSteps.sequenceId,
      stepOrder: sequenceSteps.stepOrder,
    })
    .from(sequenceSteps)
    .where(eq(sequenceSteps.id, id))
    .limit(1)

  if (!currentStep) {
    logger.error({ stepId: id }, "❌ Step not found")
    throw new Error("스텝을 찾을 수 없습니다.")
  }

  // 2. 이 스텝의 execution 상태 확인
  const executionStats = await db
    .select({
      sent: sql<number>`count(*) filter (where status = 'sent')`.as("sent"),
      pending: sql<number>`count(*) filter (where status = 'pending')`.as("pending"),
      failed: sql<number>`count(*) filter (where status = 'failed')`.as("failed"),
    })
    .from(sequenceStepExecutions)
    .where(eq(sequenceStepExecutions.stepId, id))

  const stats = executionStats[0] || { sent: 0, pending: 0, failed: 0 }

  // 3. 발송 이력이 있으면 수정 금지
  if (Number(stats.sent) > 0) {
    logger.warn(
      {
        stepId: id,
        stepOrder: currentStep.stepOrder,
        sentCount: stats.sent,
        pendingCount: stats.pending,
      },
      "❌ Cannot update step - already sent to customers",
    )

    throw new Error(
      `이 스텝은 이미 ${stats.sent}명의 고객에게 발송되었습니다.\n` +
        `발송된 스텝은 수정할 수 없습니다.\n` +
        (Number(stats.pending) > 0
          ? `(${stats.pending}명이 아직 대기 중이지만, 일관성을 위해 수정이 제한됩니다)\n`
          : "") +
        `\n해결 방법:\n` +
        `1. 새로운 스텝을 추가하거나\n` +
        `2. 시퀀스를 복제하여 새로 만들어주세요.`,
    )
  }

  // 4. 발송 이력이 없으면 수정 허용
  logger.info(
    {
      stepId: id,
      pendingCount: stats.pending,
      failedCount: stats.failed,
    },
    "✅ Step can be updated - no sent executions",
  )

  // 5. Markdown을 HTML로 변환
  const { markdownToHtml } = await import("../utils/markdown")

  // 디버깅: 입력 데이터 확인
  logger.info(
    {
      stepId: id,
      hasDataEmailBodyHtml: !!data.emailBodyHtml,
      dataEmailBodyHtmlLength: data.emailBodyHtml?.length || 0,
      dataEmailBodyHtmlPreview: data.emailBodyHtml?.substring(0, 200),
      dataEmailBodyHtmlEndsWith: data.emailBodyHtml?.substring(
        Math.max(0, (data.emailBodyHtml?.length || 0) - 100),
      ),
      hasDataEmailBodyText: !!data.emailBodyText,
      dataEmailBodyTextLength: data.emailBodyText?.length || 0,
      dataEmailBodyTextPreview: data.emailBodyText?.substring(0, 100),
      fullDataKeys: Object.keys(data),
      dataEmailBodyHtmlType: typeof data.emailBodyHtml,
      dataEmailBodyHtmlIsEmptyString: data.emailBodyHtml === "",
    },
    "📝 [SERVICE] updateSequenceStep - Input data",
  )

  // emailBodyHtml이 이미 제공되면 그대로 사용 (서명 포함)
  // 없으면 emailBodyText를 markdownToHtml로 변환
  // 주의: data.emailBodyHtml이 undefined나 null일 때만 markdownToHtml 사용
  // 빈 문자열("")도 유효한 값이므로 체크해야 함
  const emailBodyHtml =
    data.emailBodyHtml !== undefined && data.emailBodyHtml !== null
      ? data.emailBodyHtml
      : data.emailBodyText
        ? markdownToHtml(data.emailBodyText)
        : null

  // 디버깅: 최종 emailBodyHtml 확인
  logger.info(
    {
      stepId: id,
      finalEmailBodyHtmlLength: emailBodyHtml?.length || 0,
      finalEmailBodyHtmlPreview: emailBodyHtml?.substring(0, 200),
      finalEmailBodyHtmlEndsWith: emailBodyHtml?.substring(
        Math.max(0, (emailBodyHtml?.length || 0) - 100),
      ),
      isFromData: !!data.emailBodyHtml,
      isFromMarkdown: !data.emailBodyHtml && !!data.emailBodyText,
    },
    "📝 [SERVICE] updateSequenceStep - Final emailBodyHtml",
  )

  // 6. 스텝 정보 업데이트
  // emailBodyHtml을 명시적으로 설정하여 서명이 포함된 HTML이 저장되도록 함
  const { emailBodyHtml: _, ...dataWithoutEmailBodyHtml } = data
  const [updatedStep] = await db
    .update(sequenceSteps)
    .set({
      ...dataWithoutEmailBodyHtml,
      emailBodyHtml: emailBodyHtml, // 서명이 포함된 HTML 저장
      scheduledHour: data.scheduledHour ?? 9,
      scheduledMinute: data.scheduledMinute ?? 0,
      timezone: data.timezone ?? "Asia/Seoul",
      attachments: data.attachments || null,
      updatedAt: new Date(),
    })
    .where(eq(sequenceSteps.id, id))
    .returning({
      id: sequenceSteps.id,
      sequenceId: sequenceSteps.sequenceId,
      stepOrder: sequenceSteps.stepOrder,
      delayDays: sequenceSteps.delayDays,
      scheduledHour: sequenceSteps.scheduledHour,
      scheduledMinute: sequenceSteps.scheduledMinute,
      timezone: sequenceSteps.timezone,
      emailSubject: sequenceSteps.emailSubject,
      emailBodyText: sequenceSteps.emailBodyText,
      emailBodyHtml: sequenceSteps.emailBodyHtml,
      generationSource: sequenceSteps.generationSource,
      attachments: sequenceSteps.attachments,
      updatedAt: sequenceSteps.updatedAt,
    })

  // 7. pending execution은 스텝 정보를 참조하므로 별도 업데이트 불필요
  // Worker가 실행 시 최신 스텝 정보를 조회하여 사용함
  if (Number(stats.pending) > 0) {
    logger.info(
      {
        stepId: id,
        pendingExecutionsCount: stats.pending,
      },
      "✅ Pending executions will use updated step content when executed",
    )
  }

  return updatedStep
}

// DeleteSequenceStep :exec
export async function deleteSequenceStep(id: string) {
  const { default: logger } = await import("../utils/logger")

  // 1. 현재 스텝 정보 조회
  const [currentStep] = await db
    .select({
      id: sequenceSteps.id,
      sequenceId: sequenceSteps.sequenceId,
      stepOrder: sequenceSteps.stepOrder,
    })
    .from(sequenceSteps)
    .where(eq(sequenceSteps.id, id))
    .limit(1)

  if (!currentStep) {
    logger.error({ stepId: id }, "❌ Step not found")
    throw new Error("스텝을 찾을 수 없습니다.")
  }

  // 2. 이 스텝의 execution 상태 확인
  const executionStats = await db
    .select({
      sent: sql<number>`count(*) filter (where status = 'sent')`.as("sent"),
      pending: sql<number>`count(*) filter (where status = 'pending')`.as("pending"),
    })
    .from(sequenceStepExecutions)
    .where(eq(sequenceStepExecutions.stepId, id))

  const stats = executionStats[0] || { sent: 0, pending: 0 }

  // 3. 발송 이력이 있으면 삭제 금지
  if (Number(stats.sent) > 0) {
    logger.warn(
      {
        stepId: id,
        stepOrder: currentStep.stepOrder,
        sentCount: stats.sent,
        pendingCount: stats.pending,
      },
      "❌ Cannot delete step - already sent to customers",
    )

    throw new Error(
      `이 스텝은 이미 ${stats.sent}명의 고객에게 발송되었습니다.\n` +
        `발송된 스텝은 삭제할 수 없습니다.\n` +
        `\n시퀀스의 무결성을 위해 발송된 스텝은 보존되어야 합니다.`,
    )
  }

  // 4. 발송 이력이 없으면 삭제 허용
  logger.info(
    {
      stepId: id,
      pendingCount: stats.pending,
    },
    "✅ Step can be deleted - no sent executions",
  )

  // 5. pending execution도 함께 삭제
  if (Number(stats.pending) > 0) {
    await db
      .delete(sequenceStepExecutions)
      .where(
        and(eq(sequenceStepExecutions.stepId, id), eq(sequenceStepExecutions.status, "pending")),
      )

    logger.info(
      {
        stepId: id,
        deletedExecutionsCount: stats.pending,
      },
      "✅ Deleted pending executions",
    )
  }

  // 6. 스텝 삭제
  await db.delete(sequenceSteps).where(eq(sequenceSteps.id, id))

  logger.info({ stepId: id }, "✅ Step deleted successfully")
}

// ====================================
// SEQUENCE ENROLLMENTS OPERATIONS
// ====================================

// GetSequenceEnrollments :many
export async function getSequenceEnrollments(
  sequenceId: string,
  limit: number,
  offset: number,
  filters?: {
    companyName?: string
    opened?: boolean
    clicked?: boolean
    replied?: boolean
    delivered?: boolean
  },
) {
  // 이메일 관련 필터가 있는 경우, 서브쿼리로 처리
  if (
    filters?.opened !== undefined ||
    filters?.clicked !== undefined ||
    filters?.replied !== undefined ||
    filters?.delivered !== undefined
  ) {
    // 먼저 필터 조건에 맞는 leadId 목록을 가져옴
    const leadIdsQuery = db
      .selectDistinct({ leadId: emailsTable.leadId })
      .from(emailsTable)
      .where(
        and(
          eq(emailsTable.sequenceId, sequenceId),
          eq(emailsTable.direction, "outbound"),
          filters?.opened !== undefined
            ? filters.opened
              ? sql`${emailsTable.openedAt} IS NOT NULL`
              : sql`${emailsTable.openedAt} IS NULL`
            : undefined,
          filters?.clicked !== undefined
            ? filters.clicked
              ? sql`${emailsTable.clickedAt} IS NOT NULL`
              : sql`${emailsTable.clickedAt} IS NULL`
            : undefined,
          filters?.replied !== undefined
            ? filters.replied
              ? sql`${emailsTable.repliedAt} IS NOT NULL`
              : sql`${emailsTable.repliedAt} IS NULL`
            : undefined,
          filters?.delivered !== undefined
            ? filters.delivered
              ? sql`${emailsTable.deliveredAt} IS NOT NULL`
              : sql`${emailsTable.deliveredAt} IS NULL`
            : undefined,
        ),
      )

    const leadIds = await leadIdsQuery
    // console.log("LEAD IDs:", leadIds)
    const validLeadIds = leadIds.map((row) => row.leadId).filter((id): id is string => id !== null)

    // 조건에 맞는 enrollment가 없으면 빈 배열 반환
    if (validLeadIds.length === 0) {
      return []
    }

    // Build where conditions
    const conditions = [
      eq(sequenceEnrollments.sequenceId, sequenceId),
      sql`${sequenceEnrollments.leadId} IN (${sql.join(
        validLeadIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    ]

    // Search by company name
    if (filters?.companyName) {
      conditions.push(ilike(leads.companyName, `%${filters.companyName}%`))
    }

    const result = await db
      .select({
        id: sequenceEnrollments.id,
        sequenceId: sequenceEnrollments.sequenceId,
        leadId: sequenceEnrollments.leadId,
        userEmailAccountId: sequenceEnrollments.userEmailAccountId,
        currentStepOrder: sequenceEnrollments.currentStepOrder,
        status: sequenceEnrollments.status,
        enrolledBy: sequenceEnrollments.enrolledBy,
        enrolledAt: sequenceEnrollments.enrolledAt,
        firstEmailSentAt: sequenceEnrollments.firstEmailSentAt,
        lastEmailSentAt: sequenceEnrollments.lastEmailSentAt,
        completedAt: sequenceEnrollments.completedAt,
        stoppedAt: sequenceEnrollments.stoppedAt,
        nextStepScheduledAt: sequenceEnrollments.nextStepScheduledAt,
        leadCompanyName: leads.companyName,
        leadEmail: leadContacts.contactValue,
        emailAccountAddress: userEmailAccounts.emailAddress,
      })
      .from(sequenceEnrollments)
      .leftJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
      .leftJoin(
        leadContacts,
        and(
          eq(leadContacts.leadId, leads.id),
          eq(leadContacts.contactType, "email"),
          eq(leadContacts.isPrimary, true),
        ),
      )
      .leftJoin(userEmailAccounts, eq(sequenceEnrollments.userEmailAccountId, userEmailAccounts.id))
      .where(and(...conditions))
      .orderBy(desc(sequenceEnrollments.enrolledAt))
      .limit(limit)
      .offset(offset)

    return result
  }

  // 이메일 필터가 없으면 기존 로직
  const conditions = [eq(sequenceEnrollments.sequenceId, sequenceId)]

  // Search by company name
  if (filters?.companyName) {
    conditions.push(ilike(leads.companyName, `%${filters.companyName}%`))
  }

  const result = await db
    .select({
      id: sequenceEnrollments.id,
      sequenceId: sequenceEnrollments.sequenceId,
      leadId: sequenceEnrollments.leadId,
      userEmailAccountId: sequenceEnrollments.userEmailAccountId,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
      status: sequenceEnrollments.status,
      enrolledBy: sequenceEnrollments.enrolledBy,
      enrolledAt: sequenceEnrollments.enrolledAt,
      firstEmailSentAt: sequenceEnrollments.firstEmailSentAt,
      lastEmailSentAt: sequenceEnrollments.lastEmailSentAt,
      completedAt: sequenceEnrollments.completedAt,
      stoppedAt: sequenceEnrollments.stoppedAt,
      nextStepScheduledAt: sequenceEnrollments.nextStepScheduledAt,
      leadCompanyName: leads.companyName,
      leadEmail: leadContacts.contactValue,
      emailAccountAddress: userEmailAccounts.emailAddress,
    })
    .from(sequenceEnrollments)
    .leftJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
    .leftJoin(
      leadContacts,
      and(
        eq(leadContacts.leadId, leads.id),
        eq(leadContacts.contactType, "email"),
        eq(leadContacts.isPrimary, true),
      ),
    )
    .leftJoin(userEmailAccounts, eq(sequenceEnrollments.userEmailAccountId, userEmailAccounts.id))
    .where(and(...conditions))
    .orderBy(desc(sequenceEnrollments.enrolledAt))
    .limit(limit)
    .offset(offset)

  // console.log("RESULT:", result)

  return result
}

export async function getSequenceEnrollmentsNoContacts(
  sequenceId: string,
  limit: number,
  offset: number,
  filters?: {
    companyName?: string
    opened?: boolean
    clicked?: boolean
    replied?: boolean
    delivered?: boolean
  },
) {
  // Simple query - only fetch enrollment data without any joins
  const conditions = [eq(sequenceEnrollments.sequenceId, sequenceId)]

  // If email filters are provided, filter by leadIds that match email criteria
  if (
    filters?.opened !== undefined ||
    filters?.clicked !== undefined ||
    filters?.replied !== undefined ||
    filters?.delivered !== undefined
  ) {
    // Get leadIds that match email filters
    const leadIdsQuery = db
      .selectDistinct({ leadId: emailsTable.leadId })
      .from(emailsTable)
      .where(
        and(
          eq(emailsTable.sequenceId, sequenceId),
          eq(emailsTable.direction, "outbound"),
          filters?.opened !== undefined
            ? filters.opened
              ? sql`${emailsTable.openedAt} IS NOT NULL`
              : sql`${emailsTable.openedAt} IS NULL`
            : undefined,
          filters?.clicked !== undefined
            ? filters.clicked
              ? sql`${emailsTable.clickedAt} IS NOT NULL`
              : sql`${emailsTable.clickedAt} IS NULL`
            : undefined,
          filters?.replied !== undefined
            ? filters.replied
              ? sql`${emailsTable.repliedAt} IS NOT NULL`
              : sql`${emailsTable.repliedAt} IS NULL`
            : undefined,
          filters?.delivered !== undefined
            ? filters.delivered
              ? sql`${emailsTable.deliveredAt} IS NOT NULL`
              : sql`${emailsTable.deliveredAt} IS NULL`
            : undefined,
        ),
      )

    const leadIds = await leadIdsQuery
    const validLeadIds = leadIds.map((row) => row.leadId).filter((id): id is string => id !== null)

    if (validLeadIds.length === 0) {
      return []
    }

    conditions.push(
      sql`${sequenceEnrollments.leadId} IN (${sql.join(
        validLeadIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
  }

  // Note: companyName filter is ignored since we don't join to leads table

  const result = await db
    .select({
      id: sequenceEnrollments.id,
      sequenceId: sequenceEnrollments.sequenceId,
      leadId: sequenceEnrollments.leadId,
      userEmailAccountId: sequenceEnrollments.userEmailAccountId,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
      status: sequenceEnrollments.status,
      enrolledBy: sequenceEnrollments.enrolledBy,
      enrolledAt: sequenceEnrollments.enrolledAt,
      firstEmailSentAt: sequenceEnrollments.firstEmailSentAt,
      lastEmailSentAt: sequenceEnrollments.lastEmailSentAt,
      completedAt: sequenceEnrollments.completedAt,
      stoppedAt: sequenceEnrollments.stoppedAt,
      nextStepScheduledAt: sequenceEnrollments.nextStepScheduledAt,
    })
    .from(sequenceEnrollments)
    .where(and(...conditions))
    .orderBy(desc(sequenceEnrollments.enrolledAt))
    .limit(limit)
    .offset(offset)

  return result
}

// CreateSequenceEnrollment :one
export async function createSequenceEnrollment(data: {
  sequenceId: string
  leadId: string
  userEmailAccountId: string
  enrolledBy?: string
  status?: "active" | "paused" | "completed" | "stopped" | "bounced" | "unsubscribed"
}) {
  const [newEnrollment] = await db
    .insert(sequenceEnrollments)
    .values({
      sequenceId: data.sequenceId,
      leadId: data.leadId,
      userEmailAccountId: data.userEmailAccountId,
      enrolledBy: data.enrolledBy || null,
      status: data.status || "active",
    })
    .returning({
      id: sequenceEnrollments.id,
      sequenceId: sequenceEnrollments.sequenceId,
      leadId: sequenceEnrollments.leadId,
      userEmailAccountId: sequenceEnrollments.userEmailAccountId,
      status: sequenceEnrollments.status,
      enrolledAt: sequenceEnrollments.enrolledAt,
    })

  return newEnrollment
}

// UpdateEnrollmentStatus :one
export async function updateEnrollmentStatus(
  id: string,
  status: "active" | "paused" | "completed" | "stopped" | "bounced" | "unsubscribed",
) {
  const [updatedEnrollment] = await db
    .update(sequenceEnrollments)
    .set({
      status,
      stoppedAt: status === "stopped" ? new Date() : undefined,
      completedAt: status === "completed" ? new Date() : undefined,
    })
    .where(eq(sequenceEnrollments.id, id))
    .returning({
      id: sequenceEnrollments.id,
      status: sequenceEnrollments.status,
      completedAt: sequenceEnrollments.completedAt,
      stoppedAt: sequenceEnrollments.stoppedAt,
    })

  return updatedEnrollment
}

// ====================================
// STATISTICS
// ====================================

// CountSequences :one
export async function countSequences() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(sequences)

  return result[0]?.count ?? 0
}

// CountSequencesWithFilters :one
export async function countSequencesWithFilters(filters?: {
  status?: "draft" | "active" | "paused" | "archived"
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}) {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(sequences.status, filters.status))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(sequences.name, `%${filters.search}%`),
      ilike(sequences.description, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(sequences.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    const createdByCondition = or(...filters.createdByIds.map((id) => eq(sequences.createdBy, id)))
    if (createdByCondition) {
      conditions.push(createdByCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sequences)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// CountEnrollments :one
export async function countEnrollments(
  sequenceId: string,
  filters?: {
    companyName?: string
    opened?: boolean
    clicked?: boolean
    replied?: boolean
    delivered?: boolean
  },
) {
  // 이메일 관련 필터가 있는 경우, 서브쿼리로 처리
  if (
    filters?.opened !== undefined ||
    filters?.clicked !== undefined ||
    filters?.replied !== undefined ||
    filters?.delivered !== undefined
  ) {
    // 먼저 필터 조건에 맞는 enrollmentId 목록을 가져옴
    const leadIdsQuery = db
      .selectDistinct({ leadId: emailsTable.leadId })
      .from(emailsTable)
      .where(
        and(
          eq(emailsTable.sequenceId, sequenceId),
          eq(emailsTable.direction, "outbound"),
          filters?.opened !== undefined
            ? filters.opened
              ? sql`${emailsTable.openedAt} IS NOT NULL`
              : sql`${emailsTable.openedAt} IS NULL`
            : undefined,
          filters?.clicked !== undefined
            ? filters.clicked
              ? sql`${emailsTable.clickedAt} IS NOT NULL`
              : sql`${emailsTable.clickedAt} IS NULL`
            : undefined,
          filters?.replied !== undefined
            ? filters.replied
              ? sql`${emailsTable.repliedAt} IS NOT NULL`
              : sql`${emailsTable.repliedAt} IS NULL`
            : undefined,
          filters?.delivered !== undefined
            ? filters.delivered
              ? sql`${emailsTable.deliveredAt} IS NOT NULL`
              : sql`${emailsTable.deliveredAt} IS NULL`
            : undefined,
        ),
      )

    const leadIds = await leadIdsQuery
    const validLeadIds = leadIds.map((row) => row.leadId).filter((id): id is string => id !== null)

    // 조건에 맞는 enrollment가 없으면 0 반환
    if (validLeadIds.length === 0) {
      return 0
    }

    // Build where conditions
    const conditions = [
      eq(sequenceEnrollments.sequenceId, sequenceId),
      sql`${sequenceEnrollments.leadId} IN (${sql.join(
        validLeadIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    ]

    // Search by company name
    if (filters?.companyName) {
      conditions.push(ilike(leads.companyName, `%${filters.companyName}%`))
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sequenceEnrollments)
      .leftJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
      .where(and(...conditions))

    return result[0]?.count ?? 0
  }

  // 이메일 필터가 없으면 기존 로직
  const conditions = [eq(sequenceEnrollments.sequenceId, sequenceId)]

  // Search by company name
  if (filters?.companyName) {
    conditions.push(ilike(leads.companyName, `%${filters.companyName}%`))
  }

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sequenceEnrollments)
    .leftJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
    .where(and(...conditions))

  return result[0]?.count ?? 0
}

// HasAnyEnrollments - Check if sequence has any enrollments (step-based or workflow-based)
export async function hasAnyEnrollments(sequenceId: string) {
  // Check step-based enrollments
  const stepBasedCount = await countEnrollments(sequenceId)
  if (stepBasedCount > 0) {
    return true
  }

  // Check workflow-based enrollments
  const { workflowEnrollments } = await import("../db/schema/workflow-executions")
  const workflowResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowEnrollments)
    .where(eq(workflowEnrollments.sequenceId, sequenceId))

  const workflowCount = workflowResult[0]?.count ?? 0
  return workflowCount > 0
}

// ====================================
// BULK OPERATIONS
// ====================================

// BulkUpdateStatus :exec
export async function bulkUpdateStatus(
  sequenceIds: string[],
  status: "draft" | "active" | "paused" | "archived",
) {
  const sequenceCondition = or(...sequenceIds.map((id) => eq(sequences.id, id)))
  if (!sequenceCondition) {
    return 0
  }

  const result = await db
    .update(sequences)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(sequenceCondition)
    .returning({ id: sequences.id })

  return result.length
}

// BulkDelete :exec
export async function bulkDelete(sequenceIds: string[]) {
  const sequenceCondition = or(...sequenceIds.map((id) => eq(sequences.id, id)))
  if (!sequenceCondition) {
    return 0
  }

  const result = await db.delete(sequences).where(sequenceCondition).returning({ id: sequences.id })

  return result.length
}

// BulkEnroll :exec
export async function bulkEnroll(data: {
  sequenceId: string
  leadIds: string[]
  userEmailAccountId: string
  enrolledBy?: string
}) {
  const values = data.leadIds.map((leadId) => ({
    sequenceId: data.sequenceId,
    leadId,
    userEmailAccountId: data.userEmailAccountId,
    enrolledBy: data.enrolledBy || null,
  }))

  const result = await db
    .insert(sequenceEnrollments)
    .values(values)
    .returning({ id: sequenceEnrollments.id })

  return result.length
}

// BulkUnenroll :exec
export async function bulkUnenroll(enrollmentIds: string[]) {
  const enrollmentCondition = or(...enrollmentIds.map((id) => eq(sequenceEnrollments.id, id)))
  if (!enrollmentCondition) {
    return 0
  }

  const result = await db
    .update(sequenceEnrollments)
    .set({
      status: "stopped",
      stoppedAt: new Date(),
    })
    .where(enrollmentCondition)
    .returning({ id: sequenceEnrollments.id })

  return result.length
}

// ====================================
// ADVANCED ENROLLMENT OPERATIONS
// ====================================

// BulkEnrollWithScheduling - Enroll leads and create step executions with scheduling
export async function bulkEnrollWithScheduling(data: {
  sequenceId: string
  leadIds: string[]
  userEmailAccountId: string
  enrolledBy?: string
}) {
  const { default: logger } = await import("../utils/logger")

  logger.info(
    {
      sequenceId: data.sequenceId,
      leadCount: data.leadIds.length,
      userEmailAccountId: data.userEmailAccountId,
    },
    "🔄 [STEP-BASED] Starting bulk enrollment with scheduling",
  )

  // Get sequence steps to create schedules
  const steps = await getSequenceSteps(data.sequenceId)

  if (steps.length === 0) {
    logger.error({ sequenceId: data.sequenceId }, "❌ [STEP-BASED] No steps found in sequence")
    throw new Error("시퀀스에 스텝이 없습니다.")
  }

  logger.info(
    {
      sequenceId: data.sequenceId,
      stepsCount: steps.length,
      steps: steps.map((s) => ({
        stepOrder: s.stepOrder,
        delayDays: s.delayDays,
        scheduledHour: s.scheduledHour,
        scheduledMinute: s.scheduledMinute,
        timezone: s.timezone,
      })),
    },
    "📋 [STEP-BASED] Found sequence steps",
  )

  // Filter leads with valid email contacts
  const leadCondition = or(...data.leadIds.map((id) => eq(leads.id, id)))
  if (!leadCondition) {
    logger.warn({ sequenceId: data.sequenceId }, "⚠️ [STEP-BASED] No lead IDs provided")
    return {
      enrolledCount: 0,
      updatedCount: 0,
      totalSteps: steps.length,
      scheduledExecutions: 0,
    }
  }

  const leadsWithEmails = await db
    .select({
      leadId: leads.id,
      email: leadContacts.contactValue,
    })
    .from(leads)
    .innerJoin(leadContacts, eq(leads.id, leadContacts.leadId))
    .where(
      and(leadCondition, eq(leadContacts.contactType, "email"), eq(leadContacts.isPrimary, true)),
    )

  if (leadsWithEmails.length === 0) {
    logger.error(
      { sequenceId: data.sequenceId, requestedLeadCount: data.leadIds.length },
      "❌ [STEP-BASED] No leads with valid email found",
    )
    throw new Error("이메일이 있는 리드가 없습니다.")
  }

  logger.info(
    {
      sequenceId: data.sequenceId,
      totalLeads: data.leadIds.length,
      leadsWithEmail: leadsWithEmails.length,
    },
    "✅ [STEP-BASED] Found leads with valid email",
  )

  const validLeadIds = leadsWithEmails.map((l) => l.leadId)

  // Check for existing enrollments
  const existingEnrollments = await db
    .select({
      id: sequenceEnrollments.id,
      leadId: sequenceEnrollments.leadId,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
      status: sequenceEnrollments.status,
    })
    .from(sequenceEnrollments)
    .where(
      and(
        eq(sequenceEnrollments.sequenceId, data.sequenceId),
        or(...validLeadIds.map((id) => eq(sequenceEnrollments.leadId, id))),
      ),
    )

  // Separate active, paused, and completed enrollments
  const activeEnrollments = existingEnrollments.filter((e) => e.status === "active")
  const pausedEnrollments = existingEnrollments.filter((e) => e.status === "paused")
  const completedEnrollments = existingEnrollments.filter((e) => e.status === "completed")
  const completedLeadIds = new Set(completedEnrollments.map((e) => e.leadId))

  // Activate paused enrollments (from chatbot-generated sequences)
  if (pausedEnrollments.length > 0) {
    logger.info(
      {
        sequenceId: data.sequenceId,
        pausedCount: pausedEnrollments.length,
        pausedLeadIds: pausedEnrollments.map((e) => e.leadId),
      },
      "🔄 [STEP-BASED] Activating paused enrollments",
    )

    // Update paused enrollments to active
    const pausedEnrollmentIds = pausedEnrollments.map((e) => e.id)
    await db
      .update(sequenceEnrollments)
      .set({
        status: "active",
        // nextStepScheduledAt will be set below when creating step executions
      })
      .where(or(...pausedEnrollmentIds.map((id) => eq(sequenceEnrollments.id, id))))

    // Move activated enrollments to activeEnrollments list for step execution creation
    activeEnrollments.push(...pausedEnrollments.map((e) => ({ ...e, status: "active" as const })))

    logger.info(
      {
        sequenceId: data.sequenceId,
        activatedCount: pausedEnrollments.length,
      },
      "✅ [STEP-BASED] Activated paused enrollments",
    )
  }

  // Check if all leads are already completed
  if (completedLeadIds.size === validLeadIds.length) {
    logger.warn(
      {
        sequenceId: data.sequenceId,
        completedCount: completedLeadIds.size,
        totalRequested: validLeadIds.length,
      },
      "⚠️ [STEP-BASED] All leads are already completed in this sequence",
    )
    throw new Error("모든 리드가 이미 완료된 시퀀스입니다. 중복 실행을 방지합니다.")
  }

  const existingLeadIds = new Set(existingEnrollments.map((e) => e.leadId))
  let newLeadIds = validLeadIds.filter((id) => !existingLeadIds.has(id))

  // ====================================
  // 🔍 이메일 중복 체크 (같은 시퀀스 내)
  // ====================================
  if (newLeadIds.length > 0) {
    // 이 시퀀스에 이미 등록된 모든 enrollment의 이메일 주소 조회
    const existingEnrollmentsWithEmails = await db
      .select({
        enrollmentId: sequenceEnrollments.id,
        leadId: sequenceEnrollments.leadId,
        email: leadContacts.contactValue,
      })
      .from(sequenceEnrollments)
      .innerJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
      .innerJoin(
        leadContacts,
        and(
          eq(leadContacts.leadId, leads.id),
          eq(leadContacts.contactType, "email"),
          eq(leadContacts.isPrimary, true),
        ),
      )
      .where(eq(sequenceEnrollments.sequenceId, data.sequenceId))

    // 이미 등록된 이메일 주소 Set
    const enrolledEmails = new Set(existingEnrollmentsWithEmails.map((e) => e.email.toLowerCase()))

    logger.info(
      {
        sequenceId: data.sequenceId,
        enrolledEmailsCount: enrolledEmails.size,
      },
      "📧 [STEP-BASED] Found existing enrolled emails in this sequence",
    )

    // 새로 등록하려는 lead들의 이메일과 비교
    const leadEmailMap = new Map(leadsWithEmails.map((l) => [l.leadId, l.email.toLowerCase()]))

    const duplicateEmailLeads: Array<{ leadId: string; email: string }> = []
    const filteredNewLeadIds = newLeadIds.filter((leadId) => {
      const email = leadEmailMap.get(leadId)
      if (email && enrolledEmails.has(email)) {
        duplicateEmailLeads.push({ leadId, email })
        return false // 중복 이메일이므로 제외
      }
      return true // 중복되지 않으므로 등록 가능
    })

    if (duplicateEmailLeads.length > 0) {
      logger.warn(
        {
          sequenceId: data.sequenceId,
          duplicateCount: duplicateEmailLeads.length,
          duplicates: duplicateEmailLeads.map((d) => ({
            leadId: d.leadId,
            email: d.email,
          })),
        },
        "⚠️ [STEP-BASED] Skipping leads with duplicate emails already enrolled in this sequence",
      )
    }

    newLeadIds = filteredNewLeadIds
  }

  // Count duplicates for logging
  const duplicateEmailCount =
    validLeadIds.filter((id) => !existingLeadIds.has(id)).length - newLeadIds.length

  logger.info(
    {
      sequenceId: data.sequenceId,
      totalValidLeads: validLeadIds.length,
      existingEnrollments: existingEnrollments.length,
      activeEnrollments: activeEnrollments.length,
      pausedEnrollmentsActivated: pausedEnrollments.length,
      completedEnrollments: completedLeadIds.size,
      duplicateEmailsSkipped: duplicateEmailCount,
      newLeadsToEnroll: newLeadIds.length,
    },
    "📊 [STEP-BASED] Checked existing enrollments and duplicate emails",
  )

  // Create enrollments only for new leads
  let newEnrollments: Array<{ id: string; leadId: string; enrolledAt: Date }> = []
  if (newLeadIds.length > 0) {
    const enrollmentValues = newLeadIds.map((leadId) => ({
      sequenceId: data.sequenceId,
      leadId,
      userEmailAccountId: data.userEmailAccountId,
      enrolledBy: data.enrolledBy || null,
      currentStepOrder: 0,
      status: "active" as const,
    }))

    newEnrollments = await db.insert(sequenceEnrollments).values(enrollmentValues).returning({
      id: sequenceEnrollments.id,
      leadId: sequenceEnrollments.leadId,
      enrolledAt: sequenceEnrollments.enrolledAt,
    })

    logger.info(
      {
        sequenceId: data.sequenceId,
        enrollmentsCreated: newEnrollments.length,
        enrollmentIds: newEnrollments.map((e) => e.id),
      },
      "✅ [STEP-BASED] Created new enrollments",
    )
  }

  // Combine active enrollments and new enrollments for processing
  // (Skip completed enrollments to prevent re-sending)
  const enrollments = [
    ...activeEnrollments.map((e) => ({
      id: e.id,
      leadId: e.leadId,
      enrolledAt: new Date(),
      isExisting: true,
      currentStepOrder: e.currentStepOrder,
    })),
    ...newEnrollments.map((e) => ({
      id: e.id,
      leadId: e.leadId,
      enrolledAt: e.enrolledAt,
      isExisting: false,
      currentStepOrder: 0,
    })),
  ]

  logger.info(
    {
      sequenceId: data.sequenceId,
      totalEnrollments: enrollments.length,
      newEnrollments: newEnrollments.length,
      activeEnrollments: activeEnrollments.length,
      skippedCompleted: completedLeadIds.size,
      enrollmentIds: enrollments.map((e) => e.id),
    },
    "✅ [STEP-BASED] Processing enrollments (skipped completed to prevent duplicates)",
  )

  // For active enrollments, get their existing step executions
  let existingStepExecutions: Array<{
    enrollmentId: string
    stepId: string
    stepOrder: number
    scheduledAt: Date
  }> = []

  if (activeEnrollments.length > 0) {
    existingStepExecutions = await db
      .select({
        enrollmentId: sequenceStepExecutions.enrollmentId,
        stepId: sequenceStepExecutions.stepId,
        stepOrder: sequenceStepExecutions.stepOrder,
        scheduledAt: sequenceStepExecutions.scheduledAt,
      })
      .from(sequenceStepExecutions)
      .where(or(...activeEnrollments.map((e) => eq(sequenceStepExecutions.enrollmentId, e.id))))
  }

  // Create maps for quick lookup
  // enrollmentId -> Set of existing stepIds
  const existingStepExecutionsMap = new Map<string, Set<string>>()
  // (enrollmentId + stepId) -> scheduledAt
  const existingStepScheduleMap = new Map<string, Date>()

  for (const exec of existingStepExecutions) {
    if (!existingStepExecutionsMap.has(exec.enrollmentId)) {
      existingStepExecutionsMap.set(exec.enrollmentId, new Set())
    }
    const existingSet = existingStepExecutionsMap.get(exec.enrollmentId)
    if (existingSet) {
      existingSet.add(exec.stepId)
    }
    // Store scheduledAt with compound key
    existingStepScheduleMap.set(`${exec.enrollmentId}:${exec.stepId}`, exec.scheduledAt)
  }

  logger.info(
    {
      sequenceId: data.sequenceId,
      existingExecutionsCount: existingStepExecutions.length,
    },
    "📊 [STEP-BASED] Loaded existing step executions",
  )

  // Create step executions for each enrollment with KST scheduling
  const stepExecutionValues = []

  for (const enrollment of enrollments) {
    const existingStepIds = existingStepExecutionsMap.get(enrollment.id) || new Set()

    // Always start from enrolledAt, then update baseDate as we traverse steps
    let baseDate = new Date(enrollment.enrolledAt)

    logger.debug(
      {
        enrollmentId: enrollment.id,
        leadId: enrollment.leadId,
        isExisting: enrollment.isExisting,
        existingStepsCount: existingStepIds.size,
        initialBaseDate: baseDate.toISOString(),
      },
      enrollment.isExisting
        ? "📅 [STEP-BASED] Processing existing enrollment - will only add new steps"
        : "📅 [STEP-BASED] Processing new enrollment - will add all steps",
    )

    for (const step of steps) {
      // Skip if this step already has an execution for this enrollment
      if (existingStepIds.has(step.id)) {
        // Get the scheduled time of this existing step to use as base for next step
        const existingScheduledAt = existingStepScheduleMap.get(`${enrollment.id}:${step.id}`)

        if (existingScheduledAt) {
          baseDate = existingScheduledAt
          logger.debug(
            {
              enrollmentId: enrollment.id,
              stepId: step.id,
              stepOrder: step.stepOrder,
              scheduledAt: baseDate.toISOString(),
            },
            "⏭️ [STEP-BASED] Skipping existing step, updated baseDate",
          )
        } else {
          logger.debug(
            {
              enrollmentId: enrollment.id,
              stepId: step.id,
              stepOrder: step.stepOrder,
            },
            "⏭️ [STEP-BASED] Skipping existing step (no execution found)",
          )
        }
        continue
      }

      // Calculate scheduled time in KST
      const scheduledAt = calculateScheduledTime(
        baseDate,
        step.delayDays,
        step.scheduledHour ?? 9,
        step.scheduledMinute ?? 0,
        step.timezone ?? "Asia/Seoul",
      )

      logger.debug(
        {
          enrollmentId: enrollment.id,
          stepOrder: step.stepOrder,
          delayDays: step.delayDays,
          scheduledHour: step.scheduledHour ?? 9,
          scheduledMinute: step.scheduledMinute ?? 0,
          timezone: step.timezone ?? "Asia/Seoul",
          baseDate: baseDate.toISOString(),
          scheduledAt: scheduledAt.toISOString(),
        },
        "⏰ [STEP-BASED] Scheduled step execution",
      )

      stepExecutionValues.push({
        enrollmentId: enrollment.id,
        stepId: step.id,
        stepOrder: step.stepOrder,
        status: "pending" as const,
        scheduledAt,
        generationSource: step.generationSource,
      })

      // Use this step's scheduled time as the base for the next step
      baseDate = scheduledAt
    }
  }

  if (stepExecutionValues.length > 0) {
    await db.insert(sequenceStepExecutions).values(stepExecutionValues)
    logger.info(
      {
        sequenceId: data.sequenceId,
        totalExecutions: stepExecutionValues.length,
        executionsPerEnrollment: steps.length,
      },
      "✅ [STEP-BASED] Created step executions",
    )
  }

  // Update nextStepScheduledAt for enrollments
  for (const enrollment of enrollments) {
    const firstStep = steps[0]
    if (!firstStep) continue

    // Calculate first step scheduled time in KST
    const nextScheduledAt = calculateScheduledTime(
      new Date(enrollment.enrolledAt),
      firstStep.delayDays,
      firstStep.scheduledHour ?? 9,
      firstStep.scheduledMinute ?? 0,
      firstStep.timezone ?? "Asia/Seoul",
    )

    await db
      .update(sequenceEnrollments)
      .set({ nextStepScheduledAt: nextScheduledAt })
      .where(eq(sequenceEnrollments.id, enrollment.id))

    logger.debug(
      {
        enrollmentId: enrollment.id,
        nextStepScheduledAt: nextScheduledAt.toISOString(),
      },
      "📅 [STEP-BASED] Updated enrollment next step schedule",
    )
  }

  const result = {
    enrolledCount: newEnrollments.length,
    updatedCount: activeEnrollments.length - pausedEnrollments.length, // Subtract paused since we added them
    activatedPausedCount: pausedEnrollments.length,
    skippedCompleted: completedLeadIds.size,
    totalSteps: steps.length,
    scheduledExecutions: stepExecutionValues.length,
  }

  logger.info(
    {
      sequenceId: data.sequenceId,
      ...result,
    },
    "🎉 [STEP-BASED] Bulk enrollment with scheduling completed successfully",
  )

  return result
}

// GetLeadsWithEmails - Get leads from a list that have email contacts
export async function getLeadsWithEmails(leadIds: string[]) {
  const leadCondition = or(...leadIds.map((id) => eq(leads.id, id)))
  if (!leadCondition) {
    return []
  }

  const result = await db
    .select({
      leadId: leads.id,
      companyName: leads.companyName,
      email: leadContacts.contactValue,
      isPrimary: leadContacts.isPrimary,
    })
    .from(leads)
    .innerJoin(leadContacts, eq(leads.id, leadContacts.leadId))
    .where(and(leadCondition, eq(leadContacts.contactType, "email")))
    .orderBy(leads.companyName, desc(leadContacts.isPrimary))

  return result
}

// GetEnrollmentStepExecutions - Get all step executions for an enrollment
export async function getEnrollmentStepExecutions(enrollmentId: string) {
  const result = await db
    .select({
      id: sequenceStepExecutions.id,
      stepId: sequenceStepExecutions.stepId,
      stepOrder: sequenceStepExecutions.stepOrder,
      status: sequenceStepExecutions.status,
      scheduledAt: sequenceStepExecutions.scheduledAt,
      executedAt: sequenceStepExecutions.executedAt,
      emailId: sequenceStepExecutions.emailId,
      errorMessage: sequenceStepExecutions.errorMessage,
      generationSource: sequenceStepExecutions.generationSource,
      emailSubject: sequenceSteps.emailSubject,
    })
    .from(sequenceStepExecutions)
    .innerJoin(sequenceSteps, eq(sequenceStepExecutions.stepId, sequenceSteps.id))
    .where(eq(sequenceStepExecutions.enrollmentId, enrollmentId))
    .orderBy(sequenceStepExecutions.stepOrder)

  return result
}

// GetPendingStepExecutions - Get step executions that need to be sent
export async function getPendingStepExecutions(limit: number = 100) {
  const { default: logger } = await import("../utils/logger")
  const now = new Date()

  logger.debug(
    {
      currentTime: now.toISOString(),
      limit,
    },
    "🔍 [STEP-BASED] Querying pending step executions",
  )

  const result = await db
    .select({
      executionId: sequenceStepExecutions.id,
      enrollmentId: sequenceStepExecutions.enrollmentId,
      stepId: sequenceStepExecutions.stepId,
      stepOrder: sequenceStepExecutions.stepOrder,
      scheduledAt: sequenceStepExecutions.scheduledAt,
      emailSubject: sequenceSteps.emailSubject,
      emailBodyText: sequenceSteps.emailBodyText,
      emailBodyHtml: sequenceSteps.emailBodyHtml,
      attachments: sql<Array<{
        filename: string
        type: string
        content: string
      }> | null>`${sequenceSteps.attachments}`,
      leadId: sequenceEnrollments.leadId,
      leadCompanyName: leads.companyName,
      emailAccountId: sequenceEnrollments.userEmailAccountId,
      sequenceId: sequenceEnrollments.sequenceId,
      sequenceName: sequences.name,
      workspaceId: sequences.workspaceId,
      userId: sequences.createdBy, // 시퀀스 생성자 ID를 userId로 사용
    })
    .from(sequenceStepExecutions)
    .innerJoin(sequenceSteps, eq(sequenceStepExecutions.stepId, sequenceSteps.id))
    .innerJoin(sequenceEnrollments, eq(sequenceStepExecutions.enrollmentId, sequenceEnrollments.id))
    .innerJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
    .innerJoin(sequences, eq(sequenceEnrollments.sequenceId, sequences.id))
    .where(
      and(
        eq(sequenceStepExecutions.status, "pending"),
        lte(sequenceStepExecutions.scheduledAt, now),
        eq(sequenceEnrollments.status, "active"),
        eq(sequences.status, "active"),
        ne(leads.leadStatus, "unsubscribed"), // Exclude unsubscribed leads
      ),
    )
    .orderBy(sequenceStepExecutions.scheduledAt)
    .limit(limit)

  if (result.length > 0) {
    logger.info(
      {
        count: result.length,
        sequences: [...new Set(result.map((r) => r.sequenceName))],
        earliestSchedule: result[0]?.scheduledAt,
      },
      "📬 [STEP-BASED] Found pending step executions",
    )
  }

  return result
}

// UpdateStepExecutionStatus - Update step execution status after sending
export async function updateStepExecutionStatus(
  executionId: string,
  status: "scheduled" | "sent" | "delivered" | "failed" | "skipped",
  errorMessage?: string,
  emailId?: string,
) {
  const updateData: {
    status: "scheduled" | "sent" | "delivered" | "failed" | "skipped"
    executedAt?: Date
    errorMessage?: string | null
    emailId?: string | null
  } = {
    status,
    errorMessage: errorMessage || null,
    emailId: emailId || null,
  }

  // Only set executedAt for final states (not for "scheduled")
  if (status !== "scheduled") {
    updateData.executedAt = new Date()
  }

  const [updated] = await db
    .update(sequenceStepExecutions)
    .set(updateData)
    .where(eq(sequenceStepExecutions.id, executionId))
    .returning({
      id: sequenceStepExecutions.id,
      enrollmentId: sequenceStepExecutions.enrollmentId,
      stepOrder: sequenceStepExecutions.stepOrder,
    })

  return updated
}

// UpdateEnrollmentProgress - Update enrollment progress after step execution
export async function updateEnrollmentProgress(enrollmentId: string, stepOrder: number) {
  const { default: logger } = await import("../utils/logger")

  logger.debug(
    {
      enrollmentId,
      stepOrder,
    },
    "📊 [STEP-BASED] Updating enrollment progress",
  )

  // Get total steps for this enrollment
  const enrollment = await db
    .select({
      sequenceId: sequenceEnrollments.sequenceId,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
    })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1)

  if (!enrollment[0]) {
    logger.error({ enrollmentId }, "❌ [STEP-BASED] Enrollment not found")
    return null
  }

  const steps = await getSequenceSteps(enrollment[0].sequenceId)
  const isLastStep = stepOrder >= steps.length

  logger.info(
    {
      enrollmentId,
      sequenceId: enrollment[0].sequenceId,
      currentStepOrder: stepOrder,
      totalSteps: steps.length,
      isLastStep,
    },
    "📈 [STEP-BASED] Enrollment progress check",
  )

  const updateData: {
    currentStepOrder: number
    lastEmailSentAt: Date
    firstEmailSentAt?: Date
    status?: "active" | "paused" | "completed" | "stopped"
    completedAt?: Date
    nextStepScheduledAt?: Date | null
  } = {
    currentStepOrder: stepOrder,
    lastEmailSentAt: new Date(),
  }

  // If first email
  const enr = await db
    .select({ firstEmailSentAt: sequenceEnrollments.firstEmailSentAt })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1)

  if (!enr[0]?.firstEmailSentAt) {
    updateData.firstEmailSentAt = new Date()
    logger.info({ enrollmentId }, "🎉 [STEP-BASED] First email sent for this enrollment")
  }

  // If last step, mark as completed
  if (isLastStep) {
    updateData.status = "completed"
    updateData.completedAt = new Date()
    updateData.nextStepScheduledAt = null
    logger.info(
      { enrollmentId, sequenceId: enrollment[0].sequenceId },
      "🏁 [STEP-BASED] Enrollment completed - all steps sent",
    )
  } else {
    // Schedule next step with KST timezone
    const nextStep = steps.find((s) => s.stepOrder === stepOrder + 1)
    if (nextStep) {
      const baseDate = new Date()
      const nextScheduledAt = calculateScheduledTime(
        baseDate,
        nextStep.delayDays,
        nextStep.scheduledHour ?? 9,
        nextStep.scheduledMinute ?? 0,
        nextStep.timezone ?? "Asia/Seoul",
      )
      updateData.nextStepScheduledAt = nextScheduledAt
      logger.info(
        {
          enrollmentId,
          nextStepOrder: nextStep.stepOrder,
          nextStepDelayDays: nextStep.delayDays,
          nextScheduledAt: nextScheduledAt.toISOString(),
        },
        "⏭️ [STEP-BASED] Scheduled next step",
      )
    }
  }

  const [updated] = await db
    .update(sequenceEnrollments)
    .set(updateData)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .returning({
      id: sequenceEnrollments.id,
      status: sequenceEnrollments.status,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
    })

  if (updated) {
    logger.info(
      {
        enrollmentId: updated.id,
        status: updated.status,
        currentStepOrder: updated.currentStepOrder,
      },
      "✅ [STEP-BASED] Enrollment progress updated",
    )

    // If enrollment is completed, check if all enrollments are completed
    if (updated.status === "completed") {
      await checkAndUpdateSequenceCompletion(enrollment[0].sequenceId)
    }
  }

  return updated
}

// CheckAndUpdateSequenceCompletion - Check if all enrollments are completed and update sequence status
async function checkAndUpdateSequenceCompletion(sequenceId: string) {
  const { default: logger } = await import("../utils/logger")

  logger.debug({ sequenceId }, "🔍 [SEQUENCE-COMPLETION] Checking sequence completion")

  // Get all enrollments for this sequence
  const enrollments = await db
    .select({
      id: sequenceEnrollments.id,
      status: sequenceEnrollments.status,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
    })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.sequenceId, sequenceId))

  if (enrollments.length === 0) {
    logger.warn({ sequenceId }, "⚠️ [SEQUENCE-COMPLETION] No enrollments found")
    return
  }

  // Check if all enrollments are completed
  const allCompleted = enrollments.every((enrollment) => enrollment.status === "completed")

  logger.info(
    {
      sequenceId,
      totalEnrollments: enrollments.length,
      completedEnrollments: enrollments.filter((e) => e.status === "completed").length,
      allCompleted,
    },
    "📊 [SEQUENCE-COMPLETION] Completion status check",
  )

  if (allCompleted) {
    // Update sequence status to completed (all enrollments finished)
    await db
      .update(sequences)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(sequences.id, sequenceId))

    logger.info(
      { sequenceId },
      "🎉 [SEQUENCE-COMPLETION] Sequence marked as completed - all enrollments finished",
    )
  }
}

// ====================================
// SEQUENCE METRICS OPERATIONS
// ====================================

// GetSequenceMetrics - Get comprehensive metrics for a sequence
export async function getSequenceMetrics(sequenceId: string) {
  const { default: logger } = await import("../utils/logger")

  logger.debug({ sequenceId }, "📊 [METRICS] Getting sequence metrics")

  // 1. Get enrollment statistics
  const enrollmentStats = await db
    .select({
      status: sequenceEnrollments.status,
      count: sql<number>`count(*)::int`,
    })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.sequenceId, sequenceId))
    .groupBy(sequenceEnrollments.status)

  // 2. Get email statistics directly from emails table (more reliable)
  const emailStatsResult = await db
    .select({
      totalSent: sql<number>`COUNT(*)::int`,
      delivered: sql<number>`COUNT(CASE WHEN ${emailsTable.deliveredAt} IS NOT NULL THEN 1 END)::int`,
      opened: sql<number>`COUNT(CASE WHEN ${emailsTable.openedAt} IS NOT NULL THEN 1 END)::int`,
      clicked: sql<number>`COUNT(CASE WHEN ${emailsTable.clickedAt} IS NOT NULL THEN 1 END)::int`,
      bounced: sql<number>`COUNT(CASE WHEN ${emailsTable.status} = 'bounced' THEN 1 END)::int`,
      dropped: sql<number>`COUNT(CASE WHEN ${emailsTable.status} = 'failed' THEN 1 END)::int`,
      unsubscribed: sql<number>`COUNT(CASE WHEN ${emailsTable.status} = 'unsubscribed' THEN 1 END)::int`,
    })
    .from(emailsTable)
    .where(and(eq(emailsTable.sequenceId, sequenceId), eq(emailsTable.direction, "outbound")))

  const emailStats = emailStatsResult[0] || {
    totalSent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    dropped: 0,
    unsubscribed: 0,
  }

  // 4. Get last sent email timestamp
  const lastSentResult = await db
    .select({ lastSentAt: emailsTable.sentAt })
    .from(emailsTable)
    .where(and(eq(emailsTable.sequenceId, sequenceId), eq(emailsTable.direction, "outbound")))
    .orderBy(desc(emailsTable.sentAt))
    .limit(1)

  // 5. Get replied emails count and reply time statistics from email_replies table
  // Join with reply email to get actual reply sent_at time
  const replyEmail = alias(emailsTable, "reply_email")
  const repliedDataResult = await db
    .select({
      originalEmailId: emailReplies.originalEmailId,
      originalSentAt: emailsTable.sentAt,
      replyEmailId: emailReplies.replyEmailId,
      replySentAt: replyEmail.sentAt,
      aiSummary: emailReplies.aiSummary,
      sentiment: emailReplies.sentiment,
      intent: emailReplies.intent,
    })
    .from(emailReplies)
    .innerJoin(emailsTable, eq(emailReplies.originalEmailId, emailsTable.id))
    .leftJoin(replyEmail, eq(emailReplies.replyEmailId, replyEmail.id))
    .where(and(eq(emailsTable.direction, "outbound"), eq(emailsTable.sequenceId, sequenceId)))

  const repliedCount = repliedDataResult.length

  // Calculate reply time statistics (in minutes)
  const replyTimes: number[] = []
  const replySummaries: Array<{
    originalEmailId: string
    replyTime: number
    aiSummary: string | null
    sentiment: string | null
    intent: string | null
  }> = []

  for (const reply of repliedDataResult) {
    // Use reply email's sent_at if available, otherwise fall back to original email's replied_at
    const replyTime = reply.replySentAt || null
    if (reply.originalSentAt && replyTime) {
      const replyTimeMinutes =
        (new Date(replyTime).getTime() - new Date(reply.originalSentAt).getTime()) / (1000 * 60)
      if (replyTimeMinutes > 0) {
        replyTimes.push(replyTimeMinutes)
        replySummaries.push({
          originalEmailId: reply.originalEmailId,
          replyTime: replyTimeMinutes,
          aiSummary: reply.aiSummary,
          sentiment: reply.sentiment,
          intent: reply.intent,
        })
      }
    }
  }

  const avgTimeToReply =
    replyTimes.length > 0
      ? replyTimes.reduce((sum, time) => sum + time, 0) / replyTimes.length
      : undefined
  const minTimeToReply = replyTimes.length > 0 ? Math.min(...replyTimes) : undefined
  const maxTimeToReply = replyTimes.length > 0 ? Math.max(...replyTimes) : undefined

  // Process enrollment statistics
  const enrollmentCounts = {
    total: 0,
    active: 0,
    completed: 0,
    paused: 0,
    stopped: 0,
    bounced: 0,
    unsubscribed: 0,
  }

  enrollmentStats.forEach((stat) => {
    enrollmentCounts.total += stat.count
    enrollmentCounts[stat.status as keyof typeof enrollmentCounts] = stat.count
  })

  // Email statistics now directly from emails table
  const emailCounts = {
    totalSent: emailStats.totalSent,
    delivered: emailStats.delivered,
    opened: emailStats.opened,
    clicked: emailStats.clicked,
    bounced: emailStats.bounced,
    dropped: emailStats.dropped,
    unsubscribed: emailStats.unsubscribed,
  }

  // Calculate rates
  // 오픈률, 클릭률, 답장률은 실제 전달된 이메일만 기준으로 계산
  const deliveredCount = emailCounts.delivered
  const openRate = deliveredCount > 0 ? (emailCounts.opened / deliveredCount) * 100 : 0
  const clickRate = deliveredCount > 0 ? (emailCounts.clicked / deliveredCount) * 100 : 0
  const replyRate = deliveredCount > 0 ? (repliedCount / deliveredCount) * 100 : 0
  const bounceRate =
    emailCounts.totalSent > 0 ? (emailCounts.bounced / emailCounts.totalSent) * 100 : 0

  // // 디버깅: 이메일 카운트 로깅
  // logger.info(
  //   {
  //     sequenceId,
  //     emailCounts: {
  //       totalSent: emailCounts.totalSent,
  //       delivered: emailCounts.delivered,
  //       opened: emailCounts.opened,
  //       clicked: emailCounts.clicked,
  //       bounced: emailCounts.bounced,
  //     },
  //     calculatedRates: {
  //       openRate,
  //       clickRate,
  //       bounceRate,
  //     },
  //     calculationDetails: {
  //       deliveredCount,
  //       usingDeliveredEvent: emailCounts.delivered > 0,
  //     },
  //   },
  //   "🔍 [DEBUG] Email counts and calculated rates",
  // )

  const metrics = {
    // 발송 통계
    totalSent: emailCounts.totalSent,
    delivered: emailCounts.delivered,
    bounced: emailCounts.bounced,
    dropped: emailCounts.dropped,

    // 참여 통계
    opened: emailCounts.opened,
    clicked: emailCounts.clicked,
    replied: repliedCount,
    unsubscribed: emailCounts.unsubscribed,

    // 성과 지표
    openRate: Math.round(openRate * 10) / 10,
    clickRate: Math.round(clickRate * 10) / 10,
    replyRate: Math.round(replyRate * 10) / 10,
    bounceRate: Math.round(bounceRate * 10) / 10,

    // 시퀀스 진행도
    totalEnrollments: enrollmentCounts.total,
    activeEnrollments: enrollmentCounts.active,
    completedEnrollments: enrollmentCounts.completed,
    pausedEnrollments: enrollmentCounts.paused,

    // 시간별 통계
    lastSentAt: lastSentResult[0]?.lastSentAt?.toISOString(),
    avgTimeToReply: avgTimeToReply ? Math.round(avgTimeToReply * 10) / 10 : undefined,
    minTimeToReply: minTimeToReply ? Math.round(minTimeToReply * 10) / 10 : undefined,
    maxTimeToReply: maxTimeToReply ? Math.round(maxTimeToReply * 10) / 10 : undefined,

    // 회신 상세 정보
    replySummaries: replySummaries.slice(0, 10), // 최대 10개만 반환
  }

  // logger.info(
  //   {
  //     sequenceId,
  //     metrics: {
  //       totalSent: metrics.totalSent,
  //       delivered: metrics.delivered,
  //       openRate: metrics.openRate,
  //       clickRate: metrics.clickRate,
  //       totalEnrollments: metrics.totalEnrollments,
  //     },
  //   },
  //   "📊 [METRICS] Sequence metrics calculated",
  // )

  return metrics
}

// GetOverallSequenceStats - Get overall statistics across all active sequences
export async function getOverallSequenceStats(workspaceId?: string) {
  const { default: logger } = await import("../utils/logger")

  logger.debug({ workspaceId }, "📊 [METRICS] Getting overall sequence statistics")

  // Build where clause for workspace filter
  const whereClause = workspaceId
    ? and(ne(sequences.status, "draft"), eq(sequences.workspaceId, workspaceId))
    : ne(sequences.status, "draft")

  // 1. Get count of sequences by status (excluding draft)
  const sequenceStatusCounts = await db
    .select({
      status: sequences.status,
      count: sql<number>`count(*)::int`,
    })
    .from(sequences)
    .where(whereClause)
    .groupBy(sequences.status)

  // 2. Get overall email statistics from all non-draft sequences
  const sequenceIds = await db.select({ id: sequences.id }).from(sequences).where(whereClause)

  const seqIds = sequenceIds.map((s) => s.id)

  // If no sequences found, return zeros
  if (seqIds.length === 0) {
    return {
      totalSequences: 0,
      activeSequences: 0,
      pausedSequences: 0,
      completedSequences: 0,
      archivedSequences: 0,
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalReplied: 0,
      openRate: 0,
      replyRate: 0,
    }
  }

  const emailStatsResult = await db
    .select({
      totalSent: sql<number>`COUNT(*)::int`,
      delivered: sql<number>`COUNT(CASE WHEN ${emailsTable.deliveredAt} IS NOT NULL THEN 1 END)::int`,
      opened: sql<number>`COUNT(CASE WHEN ${emailsTable.openedAt} IS NOT NULL THEN 1 END)::int`,
    })
    .from(emailsTable)
    .where(and(inArray(emailsTable.sequenceId, seqIds), eq(emailsTable.direction, "outbound")))

  const emailStats = emailStatsResult[0] || {
    totalSent: 0,
    delivered: 0,
    opened: 0,
  }

  // 3. Get replied emails count
  const repliedCountResult = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${emailReplies.originalEmailId})::int`,
    })
    .from(emailReplies)
    .innerJoin(emailsTable, eq(emailReplies.originalEmailId, emailsTable.id))
    .where(and(eq(emailsTable.direction, "outbound"), inArray(emailsTable.sequenceId, seqIds)))

  const repliedCount = repliedCountResult[0]?.count || 0

  // Process sequence status counts
  const statusCounts: Record<string, number> = {
    active: 0,
    paused: 0,
    completed: 0,
    archived: 0,
    ready: 0,
  }

  let totalSequences = 0
  sequenceStatusCounts.forEach((stat) => {
    totalSequences += stat.count
    if (stat.status in statusCounts) {
      statusCounts[stat.status] = stat.count
    }
  })

  // Calculate rates
  const deliveredCount = emailStats.delivered
  const openRate = deliveredCount > 0 ? (emailStats.opened / deliveredCount) * 100 : 0
  const replyRate = deliveredCount > 0 ? (repliedCount / deliveredCount) * 100 : 0

  const stats = {
    totalSequences,
    activeSequences: statusCounts.active,
    pausedSequences: statusCounts.paused,
    completedSequences: statusCounts.completed,
    archivedSequences: statusCounts.archived,
    readySequences: statusCounts.ready,
    totalSent: emailStats.totalSent,
    totalDelivered: emailStats.delivered,
    totalOpened: emailStats.opened,
    totalReplied: repliedCount,
    openRate: Math.round(openRate * 10) / 10,
    replyRate: Math.round(replyRate * 10) / 10,
  }

  logger.info(
    {
      workspaceId,
      stats: {
        totalSequences: stats.totalSequences,
        totalDelivered: stats.totalDelivered,
        openRate: stats.openRate,
        replyRate: stats.replyRate,
      },
    },
    "📊 [METRICS] Overall sequence statistics calculated",
  )

  return stats
}

// GetEnrollmentMetrics - Get detailed metrics for a specific enrollment
export async function getEnrollmentMetrics(enrollmentId: string) {
  const { default: logger } = await import("../utils/logger")

  logger.debug({ enrollmentId }, "📊 [METRICS] Getting enrollment metrics")

  // 1. Get enrollment details
  const enrollmentResult = await db
    .select({
      id: sequenceEnrollments.id,
      sequenceId: sequenceEnrollments.sequenceId,
      leadId: sequenceEnrollments.leadId,
      companyName: leads.companyName,
      emailAddress: userEmailAccounts.emailAddress,
      status: sequenceEnrollments.status,
      enrolledAt: sequenceEnrollments.enrolledAt,
      currentStep: sequenceEnrollments.currentStepOrder,
      firstEmailSentAt: sequenceEnrollments.firstEmailSentAt,
      lastEmailSentAt: sequenceEnrollments.lastEmailSentAt,
    })
    .from(sequenceEnrollments)
    .innerJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
    .innerJoin(userEmailAccounts, eq(sequenceEnrollments.userEmailAccountId, userEmailAccounts.id))
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1)

  if (enrollmentResult.length === 0) {
    throw new Error("Enrollment not found")
  }

  const enrollment = enrollmentResult[0]
  if (!enrollment) {
    throw new Error("Enrollment not found")
  }

  // 2. Get total steps for this sequence
  const stepsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sequenceSteps)
    .innerJoin(sequenceEnrollments, eq(sequenceSteps.sequenceId, sequenceEnrollments.sequenceId))
    .where(eq(sequenceEnrollments.id, enrollmentId))

  const totalSteps = stepsResult[0]?.count || 0

  // 3. Get total emails sent - use emails table directly for accuracy
  // emails 테이블에 레코드가 있으면 발송된 것으로 간주
  const emailsSentFromTable = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(emailsTable)
    .where(
      and(
        eq(emailsTable.sequenceId, enrollment.sequenceId),
        eq(emailsTable.leadId, enrollment.leadId),
        eq(emailsTable.direction, "outbound"),
      ),
    )

  const emailsSent = emailsSentFromTable[0]?.count || 0

  logger.info(
    {
      enrollmentId,
      emailsSent,
      leadId: enrollment.leadId,
      sequenceId: enrollment.sequenceId,
    },
    "🔍 [DEBUG] Emails sent count from emails table",
  )

  // 4. Get email statistics directly from emails table
  // Use sequenceId and leadId to find emails for this enrollment
  // (since sequence_step_executions.emailId might be null)
  const emailStatsResult = await db
    .select({
      totalEmails: sql<number>`COUNT(*)::int`,
      delivered: sql<number>`COUNT(CASE WHEN ${emailsTable.deliveredAt} IS NOT NULL THEN 1 END)::int`,
      opened: sql<number>`COUNT(CASE WHEN ${emailsTable.openedAt} IS NOT NULL THEN 1 END)::int`,
      clicked: sql<number>`COUNT(CASE WHEN ${emailsTable.clickedAt} IS NOT NULL THEN 1 END)::int`,
      bounced: sql<number>`COUNT(CASE WHEN ${emailsTable.status} = 'bounced' THEN 1 END)::int`,
      failed: sql<number>`COUNT(CASE WHEN ${emailsTable.status} IN ('failed', 'spam') THEN 1 END)::int`,
    })
    .from(emailsTable)
    .where(
      and(
        eq(emailsTable.sequenceId, enrollment.sequenceId),
        eq(emailsTable.leadId, enrollment.leadId),
        eq(emailsTable.direction, "outbound"),
      ),
    )

  const emailStatsFromTable = emailStatsResult[0] || {
    totalEmails: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    failed: 0,
  }

  // 5. Get replied emails count for this enrollment
  const repliedCountResult = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${emailReplies.originalEmailId})::int`,
    })
    .from(emailReplies)
    .innerJoin(emailsTable, eq(emailReplies.originalEmailId, emailsTable.id))
    .where(
      and(
        eq(emailsTable.direction, "outbound"),
        eq(emailsTable.sequenceId, enrollment.sequenceId),
        eq(emailsTable.leadId, enrollment.leadId),
      ),
    )

  const repliedCount = repliedCountResult[0]?.count || 0

  // Process email statistics
  const emailCounts = {
    emailsSent: emailsSent, // Use actual sent count from sequence_step_executions
    emailsDelivered: emailStatsFromTable.delivered,
    emailsOpened: emailStatsFromTable.opened,
    emailsClicked: emailStatsFromTable.clicked,
    emailsReplied: repliedCount,
    emailsBounced: emailStatsFromTable.bounced,
    emailsFailed: emailStatsFromTable.failed,
  }

  // Calculate rates
  // 오픈률, 클릭률, 답장률은 실제 전달된 이메일만 기준으로 계산
  const deliveredCount = emailCounts.emailsDelivered
  const openRate = deliveredCount > 0 ? (emailCounts.emailsOpened / deliveredCount) * 100 : 0
  const clickRate = deliveredCount > 0 ? (emailCounts.emailsClicked / deliveredCount) * 100 : 0
  const replyRate = deliveredCount > 0 ? (repliedCount / deliveredCount) * 100 : 0
  const bounceRate =
    emailCounts.emailsSent > 0 ? (emailCounts.emailsBounced / emailCounts.emailsSent) * 100 : 0

  const metrics = {
    companyName: enrollment.companyName || "알 수 없음",
    emailAddress: enrollment.emailAddress || "",
    enrollmentId: enrollment.id,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    currentStep: enrollment.currentStep,
    totalSteps: totalSteps,

    // 이메일 발송 통계
    emailsSent: emailCounts.emailsSent,
    emailsDelivered: emailCounts.emailsDelivered,
    emailsOpened: emailCounts.emailsOpened,
    emailsClicked: emailCounts.emailsClicked,
    emailsReplied: emailCounts.emailsReplied,
    emailsBounced: emailCounts.emailsBounced,
    emailsFailed: emailCounts.emailsFailed,

    // 성과 지표
    openRate: Math.round(openRate * 10) / 10,
    clickRate: Math.round(clickRate * 10) / 10,
    replyRate: Math.round(replyRate * 10) / 10,
    bounceRate: Math.round(bounceRate * 10) / 10,

    // 시간 통계
    firstEmailSentAt: enrollment.firstEmailSentAt?.toISOString(),
    lastEmailSentAt: enrollment.lastEmailSentAt?.toISOString(),

    // 상세 이메일 이력
    emailHistory: await getEmailHistoryForEnrollment(enrollmentId),
  }

  logger.info(
    {
      enrollmentId,
      companyName: metrics.companyName,
      emailsSent: metrics.emailsSent,
      emailsReplied: metrics.emailsReplied,
      openRate: metrics.openRate,
      clickRate: metrics.clickRate,
      replyRate: metrics.replyRate,
    },
    "📊 [METRICS] Enrollment metrics calculated",
  )

  return metrics
}

// GetEmailHistoryForEnrollment - Get detailed email history for an enrollment
async function getEmailHistoryForEnrollment(enrollmentId: string) {
  const { default: logger } = await import("../utils/logger")

  logger.debug({ enrollmentId }, "📧 [HISTORY] Getting email history for enrollment")

  // Get emails through sequence_step_executions
  const emailHistory = await db
    .select({
      stepOrder: sequenceStepExecutions.stepOrder,
      subject: emailsTable.subject,
      sentAt: emailsTable.sentAt,
      status: emailsTable.status,
      openCount: emailsTable.openCount,
      clickCount: emailsTable.clickCount,
      deliveredAt: emailsTable.deliveredAt,
      openedAt: emailsTable.openedAt,
      clickedAt: emailsTable.clickedAt,
      repliedAt: emailsTable.repliedAt,
      bounceType: emailsTable.bounceType,
      bounceReason: emailsTable.bounceReason,
      errorMessage: emailsTable.errorMessage,
    })
    .from(sequenceStepExecutions)
    .innerJoin(emailsTable, eq(sequenceStepExecutions.emailId, emailsTable.id))
    .where(eq(sequenceStepExecutions.enrollmentId, enrollmentId))
    .orderBy(sequenceStepExecutions.stepOrder)

  return emailHistory.map((email) => ({
    stepOrder: email.stepOrder,
    subject: email.subject || "제목 없음",
    sentAt: email.sentAt?.toISOString() || "",
    status: email.status,
    openCount: email.openCount || 0,
    clickCount: email.clickCount || 0,
    deliveredAt: email.deliveredAt?.toISOString(),
    openedAt: email.openedAt?.toISOString(),
    clickedAt: email.clickedAt?.toISOString(),
    repliedAt: email.repliedAt?.toISOString(),
    bounceType: email.bounceType,
    bounceReason: email.bounceReason,
    errorMessage: email.errorMessage,
  }))
}
