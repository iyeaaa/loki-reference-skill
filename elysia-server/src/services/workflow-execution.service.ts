import sgMail from '@sendgrid/mail'
import { and, desc, eq, isNull, lte, sql } from 'drizzle-orm'
import { config } from '../config'
import { db } from '../db/index'
import { customerGroupMembers } from '../db/schema/customer-groups'
import { emails } from '../db/schema/emails'
import { leadContacts } from '../db/schema/lead-details'
import { leads } from '../db/schema/leads'
import { sequences } from '../db/schema/sequences'
import { workflowGeneratedEmails } from '../db/schema/workflow-emails'
import { workflowEnrollments, workflowExecutionLogs } from '../db/schema/workflow-executions'

// Initialize SendGrid
if (config.sendgrid.apiKey) {
  sgMail.setApiKey(config.sendgrid.apiKey)
}

// ====================================
// WORKFLOW DATA TYPES
// ====================================

interface WorkflowNode {
  id: string
  type: 'start' | 'emailDraft' | 'timer' | 'comment'
  position: { x: number; y: number }
  data: {
    subject?: string
    bodyText?: string
    delayDays?: number
    generationMode?: 'ai' | 'manual'
    aiPrompt?: string
    comment?: string
    [key: string]: any
  }
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  type?: string
}

interface WorkflowData {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

// ====================================
// ENROLLMENT MANAGEMENT
// ====================================

/**
 * 워크플로우에 lead 등록
 */
export async function enrollInWorkflow(data: {
  sequenceId: string
  leadId: string
  userEmailAccountId: string
  enrolledBy?: string
}) {
  const [enrollment] = await db
    .insert(workflowEnrollments)
    .values({
      sequenceId: data.sequenceId,
      leadId: data.leadId,
      userEmailAccountId: data.userEmailAccountId,
      enrolledBy: data.enrolledBy,
      status: 'active',
      currentNodeId: 'start',
    })
    .returning()

  if (!enrollment) {
    throw new Error('Failed to create enrollment')
  }

  // 시작 노드 실행 로그 생성
  await db.insert(workflowExecutionLogs).values({
    enrollmentId: enrollment.id,
    sequenceId: data.sequenceId,
    leadId: data.leadId,
    nodeId: 'start',
    nodeType: 'start',
    status: 'completed',
    startedAt: new Date(),
    completedAt: new Date(),
  })

  return enrollment
}

/**
 * 고객그룹의 모든 lead를 워크플로우에 일괄 등록
 */
export async function bulkEnrollInWorkflow(data: {
  sequenceId: string
  customerGroupId: string
  userEmailAccountId: string
  enrolledBy?: string
}) {
  // 고객그룹의 모든 lead 조회
  const groupLeads = await db
    .select({ leadId: customerGroupMembers.leadId })
    .from(customerGroupMembers)
    .where(eq(customerGroupMembers.groupId, data.customerGroupId))

  if (groupLeads.length === 0) {
    return { enrolledCount: 0, enrollments: [] }
  }

  // 각 lead를 워크플로우에 등록
  const enrollments = []
  for (const { leadId } of groupLeads) {
    try {
      if (!leadId) continue

      const enrollment = await enrollInWorkflow({
        sequenceId: data.sequenceId,
        leadId,
        userEmailAccountId: data.userEmailAccountId,
        enrolledBy: data.enrolledBy,
      })
      enrollments.push(enrollment)
    } catch (error) {
      console.error(`Failed to enroll lead ${leadId}:`, error)
    }
  }

  return {
    enrolledCount: enrollments.length,
    enrollments,
  }
}

/**
 * 워크플로우 등록 목록 조회
 */
export async function getWorkflowEnrollments(sequenceId: string, limit = 50, offset = 0) {
  return await db
    .select({
      id: workflowEnrollments.id,
      sequenceId: workflowEnrollments.sequenceId,
      leadId: workflowEnrollments.leadId,
      userEmailAccountId: workflowEnrollments.userEmailAccountId,
      status: workflowEnrollments.status,
      currentNodeId: workflowEnrollments.currentNodeId,
      enrolledAt: workflowEnrollments.enrolledAt,
      firstEmailSentAt: workflowEnrollments.firstEmailSentAt,
      lastEmailSentAt: workflowEnrollments.lastEmailSentAt,
      completedAt: workflowEnrollments.completedAt,
      stoppedReason: workflowEnrollments.stoppedReason,
      leadCompanyName: leads.companyName,
    })
    .from(workflowEnrollments)
    .leftJoin(leads, eq(workflowEnrollments.leadId, leads.id))
    .where(eq(workflowEnrollments.sequenceId, sequenceId))
    .orderBy(desc(workflowEnrollments.enrolledAt))
    .limit(limit)
    .offset(offset)
}

// ====================================
// WORKFLOW EXECUTION ENGINE
// ====================================

/**
 * 워크플로우 데이터 파싱
 */
function parseWorkflowData(workflowDataJson: string | null): WorkflowData | null {
  if (!workflowDataJson) return null
  try {
    return JSON.parse(workflowDataJson) as WorkflowData
  } catch (error) {
    console.error('Failed to parse workflow data:', error)
    return null
  }
}

/**
 * 다음 노드 찾기
 */
function getNextNode(currentNodeId: string, workflowData: WorkflowData): WorkflowNode | null {
  const outgoingEdge = workflowData.edges.find((edge) => edge.source === currentNodeId)
  if (!outgoingEdge) return null

  const nextNode = workflowData.nodes.find((node) => node.id === outgoingEdge.target)
  return nextNode || null
}

interface EnrollmentWithRelations {
  id: string
  sequenceId: string
  leadId: string
  userEmailAccountId: string
  status: string
  currentNodeId: string | null
  firstEmailSentAt: Date | null
  userEmailAccount: {
    emailAddress: string
    displayName: string | null
    apiKey: string
  }
  sequence: {
    id: string
    workspaceId: string
    workflowData: string | null
  } | null
}

/**
 * 이메일 초안 노드 실행
 */
async function executeEmailDraftNode(data: {
  enrollment: EnrollmentWithRelations
  node: WorkflowNode
  workflowData: WorkflowData
}): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const { enrollment, node } = data

  console.log(`[Workflow] Executing email draft node: ${node.id}`)

  // 생성된 이메일 찾기
  const generatedEmailResults = await db
    .select({
      id: workflowGeneratedEmails.id,
      sequenceId: workflowGeneratedEmails.sequenceId,
      nodeId: workflowGeneratedEmails.nodeId,
      leadId: workflowGeneratedEmails.leadId,
      subject: workflowGeneratedEmails.subject,
      bodyText: workflowGeneratedEmails.bodyText,
      bodyHtml: workflowGeneratedEmails.bodyHtml,
      status: workflowGeneratedEmails.status,
      contactEmail: leadContacts.contactValue,
    })
    .from(workflowGeneratedEmails)
    .leftJoin(
      leadContacts,
      and(
        eq(leadContacts.leadId, workflowGeneratedEmails.leadId),
        eq(leadContacts.contactType, 'email'),
        eq(leadContacts.isPrimary, true),
      ),
    )
    .where(
      and(
        eq(workflowGeneratedEmails.sequenceId, enrollment.sequenceId),
        eq(workflowGeneratedEmails.nodeId, node.id),
        eq(workflowGeneratedEmails.leadId, enrollment.leadId),
      ),
    )
    .limit(1)

  const generatedEmail = generatedEmailResults[0]

  if (!generatedEmail || generatedEmail.status === 'failed') {
    console.error(`[Workflow] No generated email found for node ${node.id}`)

    // 실행 로그에 실패 기록
    await db.insert(workflowExecutionLogs).values({
      enrollmentId: enrollment.id,
      sequenceId: enrollment.sequenceId,
      leadId: enrollment.leadId,
      nodeId: node.id,
      nodeType: 'emailDraft',
      nodeData: JSON.stringify(node.data),
      status: 'failed',
      errorMessage: 'No generated email found or email generation failed',
      startedAt: new Date(),
      completedAt: new Date(),
    })

    return { success: false, error: 'No generated email found' }
  }

  // 이메일 발송 (Email Sequence Worker 방식 적용)
  try {
    const toEmail = generatedEmail.contactEmail || ''
    if (!toEmail) {
      throw new Error('No contact email found')
    }

    // Use account-specific API key or default
    const apiKey = enrollment.userEmailAccount.apiKey || config.sendgrid.apiKey
    if (!apiKey) {
      throw new Error('SendGrid API key not configured')
    }

    // Set API key for this request
    sgMail.setApiKey(apiKey)

    // Prepare email message
    const msg: any = {
      to: toEmail,
      from: {
        email: enrollment.userEmailAccount.emailAddress,
        name: enrollment.userEmailAccount.displayName || enrollment.userEmailAccount.emailAddress,
      },
      subject: generatedEmail.subject,
    }

    // Set body
    if (generatedEmail.bodyText) {
      msg.text = generatedEmail.bodyText
    }
    if (generatedEmail.bodyHtml) {
      msg.html = generatedEmail.bodyHtml
    }

    // Send email via SendGrid
    const [response]: any = await sgMail.send(msg)
    const messageId = response.headers['x-message-id'] as string

    // 발송된 이메일 DB에 저장
    const sentEmailResults = await db
      .insert(emails)
      .values({
        workspaceId: enrollment.sequence?.workspaceId || '',
        userEmailAccountId: enrollment.userEmailAccountId,
        leadId: enrollment.leadId,
        sequenceId: enrollment.sequenceId,
        direction: 'outbound',
        fromEmail: enrollment.userEmailAccount.emailAddress,
        toEmail,
        subject: generatedEmail.subject,
        bodyText: generatedEmail.bodyText,
        bodyHtml: generatedEmail.bodyHtml,
        status: 'sent',
        sentAt: new Date(),
        sendgridMessageId: messageId,
      })
      .returning()

    const sentEmail = sentEmailResults[0]
    if (!sentEmail) {
      throw new Error('Failed to save sent email')
    }

    // 실행 로그 생성
    await db.insert(workflowExecutionLogs).values({
      enrollmentId: enrollment.id,
      sequenceId: enrollment.sequenceId,
      leadId: enrollment.leadId,
      nodeId: node.id,
      nodeType: 'emailDraft',
      nodeData: JSON.stringify(node.data),
      status: 'completed',
      generatedEmailId: generatedEmail.id,
      emailId: sentEmail.id,
      sentAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
    })

    // enrollment 업데이트
    await db
      .update(workflowEnrollments)
      .set({
        lastEmailSentAt: new Date(),
        firstEmailSentAt: enrollment.firstEmailSentAt || new Date(),
      })
      .where(eq(workflowEnrollments.id, enrollment.id))

    console.log(`[Workflow] ✓ Email sent successfully: ${sentEmail.id}, MessageID: ${messageId}`)

    return { success: true, emailId: sentEmail.id }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Workflow] ✗ Failed to send email:`, errorMessage)

    // 실행 로그에 실패 기록
    await db.insert(workflowExecutionLogs).values({
      enrollmentId: enrollment.id,
      sequenceId: enrollment.sequenceId,
      leadId: enrollment.leadId,
      nodeId: node.id,
      nodeType: 'emailDraft',
      nodeData: JSON.stringify(node.data),
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      generatedEmailId: generatedEmail.id,
      startedAt: new Date(),
      completedAt: new Date(),
    })

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * 타이머 노드 실행 (스케줄링)
 */
async function executeTimerNode(data: {
  enrollment: EnrollmentWithRelations
  node: WorkflowNode
  workflowData: WorkflowData
}): Promise<{ success: boolean; scheduledFor?: Date; nextNodeId?: string; completed?: boolean }> {
  const { enrollment, node } = data
  const delayDays = node.data.delayDays || 1

  console.log(`[Workflow] Scheduling timer node: ${node.id} (${delayDays} days)`)

  const scheduledFor = new Date()
  scheduledFor.setDate(scheduledFor.getDate() + delayDays)

  // 다음 노드 찾기
  const nextNode = getNextNode(node.id, data.workflowData)

  if (!nextNode) {
    console.log(`[Workflow] No next node after timer ${node.id}, completing enrollment`)

    await db
      .update(workflowEnrollments)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(workflowEnrollments.id, enrollment.id))

    return { success: true, completed: true }
  }

  // 타이머 실행 로그 생성 (pending 상태)
  await db.insert(workflowExecutionLogs).values({
    enrollmentId: enrollment.id,
    sequenceId: enrollment.sequenceId,
    leadId: enrollment.leadId,
    nodeId: node.id,
    nodeType: 'timer',
    nodeData: JSON.stringify(node.data),
    status: 'pending',
    scheduledFor,
    delayDays,
    waitStartedAt: new Date(),
    startedAt: new Date(),
  })

  // 다음 노드 실행 로그 생성 (scheduled 상태)
  await db.insert(workflowExecutionLogs).values({
    enrollmentId: enrollment.id,
    sequenceId: enrollment.sequenceId,
    leadId: enrollment.leadId,
    nodeId: nextNode.id,
    nodeType: nextNode.type,
    nodeData: JSON.stringify(nextNode.data),
    status: 'pending',
    scheduledFor,
  })

  // enrollment 업데이트
  await db
    .update(workflowEnrollments)
    .set({
      currentNodeId: nextNode.id,
    })
    .where(eq(workflowEnrollments.id, enrollment.id))

  console.log(`[Workflow] ✓ Timer scheduled for ${scheduledFor.toISOString()}`)

  return { success: true, scheduledFor, nextNodeId: nextNode.id }
}

/**
 * 워크플로우 실행 (단일 enrollment)
 */
export async function executeWorkflow(enrollmentId: string): Promise<{
  success: boolean
  error?: string
  emailId?: string
  scheduledFor?: Date
  nextNodeId?: string
  completed?: boolean
}> {
  // enrollment 조회 (관련 데이터 join)
  const enrollmentResults = await db
    .select({
      id: workflowEnrollments.id,
      sequenceId: workflowEnrollments.sequenceId,
      leadId: workflowEnrollments.leadId,
      userEmailAccountId: workflowEnrollments.userEmailAccountId,
      status: workflowEnrollments.status,
      currentNodeId: workflowEnrollments.currentNodeId,
      firstEmailSentAt: workflowEnrollments.firstEmailSentAt,
      sequence: {
        id: sequences.id,
        workspaceId: sequences.workspaceId,
        workflowData: sequences.workflowData,
      },
    })
    .from(workflowEnrollments)
    .leftJoin(sequences, eq(workflowEnrollments.sequenceId, sequences.id))
    .where(eq(workflowEnrollments.id, enrollmentId))
    .limit(1)

  const enrollment = enrollmentResults[0]

  if (!enrollment || enrollment.status !== 'active') {
    return { success: false, error: 'Enrollment not found or not active' }
  }

  if (!enrollment.sequence) {
    return { success: false, error: 'Sequence not found' }
  }

  // 워크플로우 데이터 파싱
  const workflowData = parseWorkflowData(enrollment.sequence.workflowData)
  if (!workflowData) {
    return { success: false, error: 'Invalid workflow data' }
  }

  // 현재 노드 찾기
  const currentNode = workflowData.nodes.find((n) => n.id === enrollment.currentNodeId)
  if (!currentNode) {
    return { success: false, error: 'Current node not found' }
  }

  // 시작 노드는 스킵
  if (currentNode.type === 'start') {
    const nextNode = getNextNode(currentNode.id, workflowData)
    if (nextNode) {
      await db
        .update(workflowEnrollments)
        .set({ currentNodeId: nextNode.id })
        .where(eq(workflowEnrollments.id, enrollmentId))

      return executeWorkflow(enrollmentId) // 재귀 호출
    }
  }

  // user_email_account 조회
  const enrollmentWithAccount = await db.query.workflowEnrollments.findFirst({
    where: eq(workflowEnrollments.id, enrollmentId),
    with: {
      userEmailAccount: true,
      sequence: true,
    },
  })

  if (!enrollmentWithAccount) {
    return { success: false, error: 'Enrollment not found' }
  }

  const enrichedEnrollment = {
    ...enrollment,
    userEmailAccount: enrollmentWithAccount.userEmailAccount,
    sequence: enrollmentWithAccount.sequence,
  }

  // 노드 타입별 실행
  if (currentNode.type === 'emailDraft') {
    const result = await executeEmailDraftNode({
      enrollment: enrichedEnrollment,
      node: currentNode,
      workflowData,
    })

    if (!result.success) {
      return result
    }

    // 다음 노드로 이동
    const nextNode = getNextNode(currentNode.id, workflowData)
    if (nextNode) {
      await db
        .update(workflowEnrollments)
        .set({ currentNodeId: nextNode.id })
        .where(eq(workflowEnrollments.id, enrollmentId))

      // 다음 노드가 타이머가 아니면 즉시 실행
      if (nextNode.type !== 'timer') {
        return executeWorkflow(enrollmentId)
      }
      return executeWorkflow(enrollmentId) // 타이머 노드도 실행 (스케줄링)
    } else {
      // 더 이상 노드가 없으면 완료
      await db
        .update(workflowEnrollments)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(workflowEnrollments.id, enrollmentId))

      return { success: true, completed: true }
    }
  } else if (currentNode.type === 'timer') {
    return executeTimerNode({
      enrollment: enrichedEnrollment,
      node: currentNode,
      workflowData,
    })
  }

  return { success: false, error: 'Unknown node type' }
}

/**
 * 스케줄된 워크플로우 실행 대기 중인 항목 조회
 * 활성화된 시퀀스만 처리
 */
export async function getPendingWorkflowExecutions(limit = 50) {
  const now = new Date()

  return await db
    .select({
      enrollmentId: workflowExecutionLogs.enrollmentId,
      nodeId: workflowExecutionLogs.nodeId,
      nodeType: workflowExecutionLogs.nodeType,
      scheduledFor: workflowExecutionLogs.scheduledFor,
      sequenceStatus: sequences.status,
    })
    .from(workflowExecutionLogs)
    .innerJoin(sequences, eq(workflowExecutionLogs.sequenceId, sequences.id))
    .innerJoin(workflowEnrollments, eq(workflowExecutionLogs.enrollmentId, workflowEnrollments.id))
    .where(
      and(
        eq(workflowExecutionLogs.status, 'pending'),
        lte(workflowExecutionLogs.scheduledFor, now),
        isNull(workflowExecutionLogs.repliedDuringWait),
        eq(sequences.status, 'active'), // 활성 시퀀스만
        eq(workflowEnrollments.status, 'active'), // 활성 enrollment만
      ),
    )
    .limit(limit)
}

// ====================================
// STATISTICS
// ====================================

/**
 * 노드별 통계 조회
 */
export async function getNodeStatistics(sequenceId: string, nodeId: string) {
  // 발송 수 (completed emailDraft logs)
  const [sentResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowExecutionLogs)
    .where(
      and(
        eq(workflowExecutionLogs.sequenceId, sequenceId),
        eq(workflowExecutionLogs.nodeId, nodeId),
        eq(workflowExecutionLogs.nodeType, 'emailDraft'),
        eq(workflowExecutionLogs.status, 'completed'),
      ),
    )

  // 답장 수 (stopped with reply reason)
  const [repliedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowEnrollments)
    .where(
      and(
        eq(workflowEnrollments.sequenceId, sequenceId),
        eq(workflowEnrollments.status, 'stopped'),
        sql`${workflowEnrollments.stoppedReason} LIKE '%reply%'`,
      ),
    )

  // 대기 중 (pending timer logs for this node)
  const [waitingResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowExecutionLogs)
    .where(
      and(
        eq(workflowExecutionLogs.sequenceId, sequenceId),
        eq(workflowExecutionLogs.nodeId, nodeId),
        eq(workflowExecutionLogs.nodeType, 'timer'),
        eq(workflowExecutionLogs.status, 'pending'),
      ),
    )

  return {
    nodeId,
    sentCount: sentResult?.count || 0,
    repliedCount: repliedResult?.count || 0,
    waitingCount: waitingResult?.count || 0,
  }
}
